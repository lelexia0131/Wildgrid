import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facilityLibrary } from '../src/engine/facilityRegistry';
import { evaluate } from '../src/engine/placementRules';
import { occupied } from '../src/engine/boardGeometry';
import { boardCells, cellBit, domainsWithClues, placementDomains, staticPositions } from '../src/engine/placementDomains';
import { hasRoleSwap, tileFacilities } from '../src/engine/facilityConstruction';
import { mapQuality, terrainDistribution, terrainPlacementScores, terrainRegions } from '../src/engine/mapQuality';
import { campConnections } from '../src/engine/placementRules';
import { SURVIVAL_DIFFICULTIES } from '../src/game-modes/survival/survivalDifficulty';
import { reasonLevel, reasonedDomains } from '../src/engine/logicalSolver';
import { solveLevel } from '../src/engine/solver';
import { generateMap, planTerrain, seeded, MapGenerationConstraintError, MapGenerationSearchError } from '../src/engine/mapGeneration';
import { facilityRestrictionError } from '../src/game-modes/survival/survivalFacilities';
import { generationBudgets, inventoryViolations } from '../src/engine/generationConfig';
import type { Level } from '../src/engine/types';

test('shared placement domains agree with the real static gameplay evaluator, including all rotations', () => {
  for (const size of [6, 8]) for (const piece of facilityLibrary) {
    const level: Level = { id: 0, name: '', chapter: '', tip: '', size, pieces: [piece], terrain: [{r:1,c:1,kind:'water'},{r:3,c:2,kind:'forest'},{r:4,c:4,kind:'mountain'}], rows: Array(size).fill(3), cols: Array(size).fill(2) };
    const token = (at: {r:number;c:number;rotation:number}) => occupied(piece, {...at,id:piece.id}).map(p=>`${p.r},${p.c}`).sort().join(';');
    const actual = new Set<string>();
    for (let rotation=0;rotation<4;rotation++) for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
      const at={r,c,rotation,id:piece.id};
      if (evaluate(level,[at],{staticOnly:true}).status !== 'INVALID') actual.add(token(at));
    }
    assert.deepEqual(new Set(staticPositions(piece,level).map(p=>token(p.at))),actual,`${size}/${piece.id}`);
  }
});

const make = (pieces: Level['pieces'], terrain: Level['terrain'], rows: number[], cols: number[]): Level => ({ id:0,name:'',chapter:'',tip:'',size:3,pieces,terrain,rows,cols });
test('logical cardinality handles interchangeable IDs; ambiguity and interrupted searches never prove uniqueness', () => {
  const identical = make([{id:'a',kind:'camp',shape:'single'},{id:'b',kind:'camp',shape:'single'}],[{r:0,c:0,kind:'water'}],[1,1,0],[1,1,0]);
  assert.equal(reasonLevel({...identical,terrain:Array.from({length:9},(_,i)=>({r:Math.floor(i/3),c:i%3,kind:'water' as const}))}).contradiction,true);
  const solved=reasonLevel(identical);
  assert.equal(solved.solved,true); assert.equal(evaluate(identical,solved.placements).won,true); assert.equal(solveLevel(identical,2).count,1);
  const ambiguous=make([{id:'c',kind:'camp',shape:'single'},{id:'f',kind:'fire',shape:'single'}],[{r:1,c:1,kind:'water'},{r:1,c:2,kind:'water'}],[2,0,0],[0,1,1]);
  assert.equal(solveLevel(ambiguous,2).count,2);
  assert.equal(reasonLevel(ambiguous,{maxAssumptions:24,maxDepth:2}).solved,false);
  const interrupted=solveLevel(ambiguous,2,{maxNodes:3});
  assert.equal(interrupted.count,1); assert.equal(interrupted.aborted,true);
  const expired=reasonLevel(identical,{deadline:Date.now()-1});
  assert.equal(expired.aborted,true); assert.equal(expired.solved,false);
});

test('range-driven restrictions and exhausted generation budgets fail explicitly', () => {
  const disabled=facilityLibrary.filter(p=>p.shape!=='single').map(p=>`${p.kind}_${p.shape}`);
  assert.equal(facilityRestrictionError(2,disabled),null);
  const singles=generateMap(2,1,'no-multi',[],SURVIVAL_DIFFICULTIES[1],disabled);
  assert.deepEqual(inventoryViolations(singles.draft.level,2,disabled),[]);
  assert.ok(singles.draft.level.pieces.every(p=>p.shape==='single'));
  assert.throws(()=>generateMap(10,1,'no-camps',[],SURVIVAL_DIFFICULTIES[9],facilityLibrary.filter(p=>p.kind==='camp').map(p=>`${p.kind}_${p.shape}`)),MapGenerationConstraintError);
  assert.throws(()=>generateMap(1,1,'budget',[],{min:4,max:5,multi:0},[],[],0),error=>error instanceof MapGenerationSearchError && error.diagnostics?.proofs===0 && error.diagnostics.attempts===0);
});

test('a disabled single-cell camp is replaced by a legal multigrid camp even in tier one', () => {
  const map=generateMap(1,20261019,'no-single',[],{min:4,max:5,multi:0},['camp_single']);
  assert.ok(map.draft.level.pieces.some(p=>p.kind==='camp'));
  assert.ok(map.draft.level.pieces.every(p=>p.kind!=='camp'||p.shape!=='single'));
  const proof=solveLevel(map.draft.level,2);
  assert.equal(proof.aborted,false); assert.equal(proof.count,1);
});

test('cached connection geometry and rebound clue domains equal fresh terrain-specific domains', () => {
  const level: Level = { id:0,name:'',chapter:'',tip:'',size:8,pieces:facilityLibrary,terrain:[{r:1,c:1,kind:'water'},{r:3,c:2,kind:'forest'},{r:4,c:4,kind:'mountain'}],rows:Array(8).fill(8),cols:Array(8).fill(8) };
  const base = placementDomains(level);
  for (const g of base) for (const p of g.domain) {
    assert.deepEqual(p.connections,campConnections(g.piece.kind,p.cells,boardCells(8),level.terrain).map(link=>({camp:cellBit(link.camp),gap:link.gap?cellBit(link.gap):0n})));
  }
  const clues = {...level,rows:[0,1,2,3,4,5,6,7],cols:[7,6,5,4,3,2,1,0],pieces:[{id:'new-id',kind:'camp' as const,shape:'single' as const},{id:'truck',kind:'foodTruck' as const,shape:'single' as const}]};
  assert.deepEqual(domainsWithClues(base,clues),placementDomains(clues));
});

test('cheap role-swap rejection witnesses a real second solution', () => {
  const level=make([{id:'c',kind:'camp',shape:'single'},{id:'f',kind:'fire',shape:'single'}],[{r:1,c:1,kind:'water'},{r:1,c:2,kind:'water'}],[2,0,0],[0,1,1]);
  const groups=placementDomains(level);
  const entries=groups.map((g,i)=>({piece:g.piece,p:g.domain.find(p=>p.at.r===0 && p.at.c===i+1)!}));
  assert.equal(hasRoleSwap(entries,groups),true);
  assert.equal(solveLevel(level,2).count,2);
  const logic=reasonLevel(level,{maxAssumptions:24,maxDepth:2});
  assert.equal(solveLevel(level,2,{},reasonedDomains(groups,logic)).count,2);
});

test('single-only camp restrictions can add another camp before completing required multigrid links', () => {
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:facilityLibrary.filter(p=>p.id==='camp_single'||p.id==='picnic_domino'),terrain:[{r:1,c:1,kind:'water'},{r:5,c:5,kind:'water'}],rows:Array(8).fill(8),cols:Array(8).fill(8)};
  const masks=[[10],[44],[2,3],[18,19],[11,12],[35,36],[51,52]].map(cells=>cells.reduce((m,c)=>m|(1n<<BigInt(c)),0n));
  const groups=placementDomains(level).map(g=>({...g,domain:g.domain.filter(p=>masks.includes(p.mask))}));
  const entries=tileFacilities(level,groups,{camp_single:2,picnic_domino:5},()=>.5);
  assert.ok(entries);
  assert.equal(entries.filter(e=>e.piece.kind==='camp').length,2);
  assert.equal(entries.filter(e=>e.piece.shape!=='single').length,5);
});

test('capacity pruning accounts for disabled domino shapes before drawing any layout moves', () => {
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:facilityLibrary.filter(p=>p.id==='camp_single'||p.id==='cabin_el'),terrain:[{r:0,c:0,kind:'forest'},{r:0,c:3,kind:'water'}],rows:[8,8,8,0,0,0,0,0],cols:[8,8,8,0,0,0,0,0]};
  const groups=placementDomains(level);
  assert.ok(groups.every(g=>g.domain.length>0));
  let draws=0;
  assert.equal(tileFacilities(level,groups,{camp_single:1,cabin_el:2},()=>{draws++;return .5;}),undefined);
  assert.equal(draws,0);
});

test('required single camp survives every construction tier, unrelated bans, and role assignment', () => {
  for (const difficulty of [1,5,7,9,10]) {
    const spec=SURVIVAL_DIFFICULTIES[difficulty-1];
    const map=generateMap(difficulty,20261020,'required-single',[],spec);
    const pieces=map.draft.level.pieces;
    assert.ok(pieces.some(p=>p.kind==='camp' && p.shape==='single'));
    assert.deepEqual(inventoryViolations(map.draft.level,difficulty),[]);
    assert.equal(evaluate(map.draft.level,map.draft.placements).won,true);
    assert.ok(map.diagnostics.reasoning.solved && !map.diagnostics.reasoning.aborted);
    assert.ok(map.draft.level.terrain.length<=generationBudgets(difficulty).terrain.max);
    assert.deepEqual(terrainDistribution(map.draft.level.terrain).violations,[]);
    const proof=solveLevel(map.draft.level,2,{maxNodes:100000});
    assert.ok(!proof.aborted && proof.count===1);
    if (difficulty===10) assert.ok(pieces.some(p=>p.kind==='camp' && p.shape!=='single'));
  }
  const banned=generateMap(1,20261020,'unrelated-ban',[],SURVIVAL_DIFFICULTIES[0],['pool_single']);
  assert.ok(banned.draft.level.pieces.some(p=>p.kind==='camp' && p.shape==='single'));
  assert.ok(banned.draft.level.pieces.every(p=>p.kind!=='pool'));
  const missing={...banned.draft,level:{...banned.draft.level,pieces:banned.draft.level.pieces.filter(p=>p.kind!=='camp'||p.shape!=='single')},placements:banned.draft.placements.filter(at=>banned.draft.level.pieces.find(p=>p.id===at.id)?.kind!=='camp')};
  assert.ok(mapQuality(missing,{disabled:[],requireSingle:true,...SURVIVAL_DIFFICULTIES[0]}).violations.includes('required single camp'));
});

test('terrain frontiers reject merged oversized components and mixed high-density windows at edges too', () => {
  const ridge=[{r:3,c:1,kind:'mountain' as const},{r:3,c:2,kind:'mountain' as const},{r:3,c:4,kind:'mountain' as const}];
  const frontier=terrainPlacementScores(ridge,'mountain',12);
  assert.ok(!frontier.some(p=>p.cell.r===3 && p.cell.c===3));
  assert.ok(frontier.some(p=>p.cell.r===3 && p.cell.c===0));
  const corners=[{r:0,c:0,kind:'water' as const},{r:0,c:2,kind:'forest' as const},{r:2,c:0,kind:'mountain' as const},{r:2,c:2,kind:'forest' as const}];
  assert.ok(!terrainPlacementScores(corners,'water',12).some(p=>p.cell.r===1 && p.cell.c===1));
  assert.ok(terrainDistribution([...corners,{r:1,c:1,kind:'water'}]).violations.includes('terrain local density'));
  const square=[{r:0,c:0,kind:'water' as const},{r:0,c:3,kind:'forest' as const},{r:3,c:0,kind:'mountain' as const},{r:3,c:3,kind:'water' as const},{r:0,c:1,kind:'forest' as const},{r:1,c:3,kind:'mountain' as const},{r:3,c:2,kind:'forest' as const},{r:2,c:0,kind:'water' as const}];
  const dense=terrainDistribution([...square,{r:1,c:1,kind:'mountain'}]);
  assert.equal(dense.max3,4); assert.equal(dense.max4,9);
  assert.ok(!terrainPlacementScores(square,'mountain',15).some(p=>p.cell.r===1 && p.cell.c===1));
  const upper=[{r:0,c:0,kind:'water' as const},{r:0,c:3,kind:'forest' as const},{r:1,c:1,kind:'mountain' as const},{r:3,c:2,kind:'forest' as const},{r:0,c:5,kind:'water' as const},{r:1,c:7,kind:'mountain' as const},{r:3,c:6,kind:'forest' as const}];
  assert.ok(terrainDistribution(upper).violations.includes('terrain distribution'));
  assert.ok(terrainDistribution(Array.from({length:16},(_,i)=>({r:Math.floor(i/8),c:i%8,kind:'water' as const}))).violations.includes('terrain local density'));
  assert.ok(terrainDistribution(Array.from({length:7},(_,c)=>({r:0,c,kind:'water' as const}))).violations.includes('terrain component or kind count'));
});

test('fixed terrain seeds vary in count and clustering without growing with the reasoning tier', () => {
  const totals=new Set<number>(); let clustered=0, isolated=0, run=0, maxRun=0;
  for(let seed=20261019;seed<20261019+96;seed++) {
    const plan=planTerrain(seeded(seed),10);
    assert.ok(plan);
    assert.deepEqual(plan,planTerrain(seeded(seed),10));
    const regions=terrainRegions(plan.terrain);
    assert.ok(plan.terrain.length===plan.budget && plan.budget<=generationBudgets(10).terrain.max);
    assert.deepEqual(terrainDistribution(plan.terrain,regions).violations,[]);
    totals.add(plan.terrain.length);
    if(regions.some(r=>r.singletons>0)) isolated++;
    if(regions.some(r=>r.largest>1)) {clustered++;run=0;} else {maxRun=Math.max(maxRun,++run);}
  }
  assert.ok(totals.size>=3);
  assert.ok(clustered>0 && isolated>0);
  assert.ok(maxRun<24);
});

test('seed order is independent of wall-clock speed; an expired run cannot choose a fallback', t => {
  const spec=SURVIVAL_DIFFICULTIES[0];
  const fast=generateMap(1,20261020,'fast',[],spec);
  let clock=0;
  t.mock.method(Date,'now',()=>clock++);
  const slow=generateMap(1,20261020,'slow',[],spec);
  assert.equal(slow.fingerprint,fast.fingerprint);
  assert.equal(slow.diagnostics.attempts,fast.diagnostics.attempts);
  assert.throws(()=>generateMap(1,20261020,'expired',[],spec,[],[],1),MapGenerationSearchError);
});
