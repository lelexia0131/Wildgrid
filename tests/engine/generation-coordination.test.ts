import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityRectangles,layoutTerrain,terrainDistribution} from '../../src/engine/terrainLayout';
import {generationBudgets,MAX_GENERATED_EMPTY_LINES,MAX_GENERATED_LINE_OCCUPANCY,inventoryViolations} from '../../src/engine/generationConfig';
import {coordinateGenerationBudget} from '../../src/engine/generationBudget';
import {generationCandidateBatches,generateMap,seeded} from '../../src/engine/mapGeneration';
import {terrainRegistry} from '../../src/engine/terrainRegistry';
import {placementDomains} from '../../src/engine/placementDomains';
import {solveLevel} from '../../src/engine/solver';
import {reasonLevel,reasonedDomains} from '../../src/engine/logicalSolver';
import {tileFacilityBudget} from '../../src/engine/facilityConstruction';
import {refineTerrain} from '../../src/engine/generationRefinement';
import {evaluate} from '../../src/engine/placementRules';
import type {Level} from '../../src/engine/types';

test('real tier 8–10 budgets admit active rectangles with independently budgeted terrain and grass',()=>{
  for(const difficulty of [8,9,10]) {
    const budgets=generationBudgets(difficulty),limit=MAX_GENERATED_EMPTY_LINES[difficulty-1];
    const areas=[];
    for(let r=1;r<=8;r++) for(let c=1;c<=8;c++) if(16-r-c<=limit) areas.push(r*c);
    assert.equal(Math.min(...areas),difficulty===8?40:difficulty===9?48:56);
    const actualMaximum=Math.max(...budgets.facilities.areas)+Math.max(...budgets.terrain.areas);
    assert.equal(actualMaximum,difficulty===8?40:difficulty===9?44:50);
    if(difficulty>=9) assert.ok(actualMaximum<Math.min(...areas),'count caps make the old filled-rectangle condition unreachable');
    for(let seed=0;seed<12;seed++) {
      const random=seeded(seed),facility=budgets.facilities.sample(random),terrain=budgets.terrain.sample(random);
      const plans=activityRectangles(8,facility.area,terrain.area,MAX_GENERATED_LINE_OCCUPANCY,limit);
      assert.ok(plans.length,`${difficulty}/${seed}`);
      for(const p of plans) {
        assert.ok(16-p.r-p.c<=limit);
        assert.equal(p.r*p.c,facility.area+p.terrainArea+p.grass);
        assert.ok(p.grass>=0 && p.terrainArea>=0 && p.terrainArea<=terrain.area);
        assert.ok(terrain.area-p.terrainArea<=64-p.r*p.c);
      }
      // Spread the inactive lines across the board; coordinates are not a map
      // template, and the terrain builder still chooses every actual cell.
      const p=plans[0],order=[0,7,2,5,1,6,3,4];
      const cells=new Set(Array.from({length:64},(_,i)=>i).filter(i=>order.slice(0,p.r).includes(Math.floor(i/8)) && order.slice(0,p.c).includes(i%8)));
      let result:ReturnType<typeof layoutTerrain>=undefined;
      for(let attempt=0;attempt<8 && !result;attempt++) result=layoutTerrain(seeded(seed+attempt),terrain.counts,terrainRegistry,terrain.area,{cells,terrainArea:p.terrainArea});
      assert.ok(result,`${difficulty}/${seed} terrain quota`);
      assert.equal(result.length,terrain.area);
      assert.equal(result.filter(t=>cells.has(t.r*8+t.c)).length,p.terrainArea);
      for(const item of budgets.terrain.items) assert.equal(result.filter(t=>t.kind===item.id).length,terrain.counts[item.id]*item.area);
      assert.deepEqual(terrainDistribution(result).violations,[]);
    }
  }
});

test('infeasible active capacities are rejected before drawing terrain or searching facilities',()=>{
  assert.deepEqual(activityRectangles(8,48,15,6,1),[]);
  let draws=0;
  assert.equal(layoutTerrain(()=>{draws++;return .5;},{water:2},terrainRegistry,2,{cells:new Set([0]),terrainArea:2}),undefined);
  assert.equal(layoutTerrain(()=>{draws++;return .5;},{water:2},terrainRegistry,2,{cells:new Set(Array.from({length:64},(_,i)=>i)),terrainArea:1}),undefined);
  assert.equal(draws,0);
  assert.ok(layoutTerrain(seeded(1),{water:2},terrainRegistry,2),'unplanned fallback remains available');
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:[{id:'p',kind:'powerTower',shape:'single'}],terrain:[],rows:[1,1,0,0,0,0,0,0],cols:Array(8).fill(6)};
  const stats:Record<string,number>={},groups=placementDomains(level);
  assert.equal(tileFacilityBudget(level,groups,[{id:'powerTower_single',area:1,min:3,max:3}],3,()=>{draws++;return .5;},Infinity,stats),undefined);
  assert.equal(stats['initial line capacity'],1);
  assert.equal(stats.nodes,undefined);
  assert.equal(draws,0);
  assert.ok(tileFacilityBudget(level,groups,[{id:'powerTower_single',area:1,min:2,max:2}],2,seeded(1)));
});

test('one, two and many candidates flush without a successful-candidate threshold',()=>{
  for(const values of [[1],[1,2],[1,2,3,4],[1,undefined,undefined,undefined]]) {
    let next=0;
    const batches=[...generationCandidateBatches(()=>values[next++],()=>next<values.length,()=>false)];
    assert.deepEqual(batches.flat(),values.filter(v=>v!==undefined));
    if(values.length===4 && values[1]===undefined) assert.deepEqual(batches,[[1]]);
  }
});

test('urgent validation precedes another construction and failed candidates are consumed once',()=>{
  let attempts=0,urgent=false;
  const batches=generationCandidateBatches(()=>{attempts++;urgent=true;return attempts;},()=>attempts<3,()=>urgent);
  assert.deepEqual(batches.next().value,[1]);
  assert.equal(attempts,1);
  const checked:number[]=[],proved:number[]=[];
  for(const batch of [[1],...batches]) for(const candidate of batch) {
    checked.push(candidate);
    if(candidate===1) continue; // A failed logic/proof result cannot be returned.
    proved.push(candidate);
  }
  assert.deepEqual(checked,[1,2,3]);
  assert.deepEqual(proved,[2,3]);
  assert.equal(new Set(checked).size,checked.length);
});

test('soft phase budgets borrow unused time while protecting logic and final proof',t=>{
  let now=1000;
  t.mock.method(Date,'now',()=>now);
  const budget=coordinateGenerationBudget(now,7600);
  const first=budget.phaseDeadline('construction');
  budget.phases.construction={calls:10,ms:4000};
  const borrowed=budget.phaseDeadline('construction');
  assert.ok(borrowed>now && borrowed<first);
  assert.ok(borrowed<budget.phaseDeadline('logic'));
  assert.ok(budget.phaseDeadline('logic')<budget.phaseDeadline('proof'));
  budget.phases.logic={calls:10,ms:100};
  now=budget.deadline-500;
  assert.equal(budget.canConstruct(),true,'unused initial validation reserve can be lent');
  now=budget.deadline-300;
  assert.equal(budget.canConstruct(),false);
  assert.equal(budget.urgent(),true);
  budget.measure('logic',until=>{now=until;});
  assert.equal(budget.cutoffs.logic,1);
  assert.ok(budget.phaseDeadline('proof')>now);
});

test('a refinement deadline retains an already checked improvement instead of discarding it',t=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:[{id:'c',kind:'camp',shape:'single'},{id:'f',kind:'fire',shape:'single'}],terrain:[{r:1,c:1,kind:'water'},{r:1,c:2,kind:'water'}],rows:[2,0,0,0,0,0,0,0],cols:[0,1,1,0,0,0,0,0]};
  const placements=[{id:'c',r:0,c:1,rotation:0},{id:'f',r:0,c:2,rotation:0}],witness=[{id:'c',r:0,c:2,rotation:0},{id:'f',r:0,c:1,rotation:0}];
  const groups=placementDomains(level);
  const entries=placements.map(at=>{const piece=level.pieces.find(p=>p.id===at.id)!;return {piece,p:groups.find(g=>g.piece.id===piece.id)!.domain.find(p=>p.at.r===at.r && p.at.c===at.c)!};});
  assert.ok(evaluate(level,placements).won && evaluate(level,witness).won);
  let now=0;
  t.mock.method(Date,'now',()=>++now);
  const next=refineTerrain(level,entries,seeded(1),100,[witness]);
  assert.ok(now>=100);
  assert.notEqual(next,level);
  assert.ok(evaluate(next,placements).won);
  assert.equal(evaluate(next,witness).won,false);
  assert.equal(next.terrain.length,level.terrain.length);
  assert.deepEqual(terrainDistribution(next.terrain).violations,[]);
  assert.equal(solveLevel(next,2,{},placementDomains(next)).count,1);
});

test('proof preprocessing preserves complete solution sets and interrupted proofs remain incomplete',()=>{
  const signatures=(result:ReturnType<typeof solveLevel>)=>result.solutions.map(s=>s.map(p=>`${p.id}:${p.r}:${p.c}:${p.rotation}`).sort().join(';')).sort();
  for(const size of [3,4]) for(let seed=0;seed<12;seed++) {
    const random=seeded(seed);
    const rows=Array<number>(size).fill(0),cols=Array<number>(size).fill(0);
    const level:Level={id:0,name:'',chapter:'',tip:'',size,terrain:[{r:1,c:1,kind:'water'}],pieces:[{id:'a',kind:'camp',shape:'single'},{id:'b',kind:'fire',shape:'single'}],rows,cols};
    for(let i=0;i<2;i++) {rows[Math.floor(random()*size)]++;cols[Math.floor(random()*size)]++;}
    const raw=solveLevel(level,100,{},placementDomains(level));
    const reduced=solveLevel(level,100);
    assert.equal(reduced.aborted,false);
    assert.deepEqual(signatures(reduced),signatures(raw),`${size}/${seed}`);
    assert.equal(solveLevel(level,100,{deadline:Date.now()-1}).aborted,true);
  }
  for(const shape of ['single','domino'] as const) for(let seed=0;seed<12;seed++) {
    const random=seeded(seed),area=shape==='single'?3:5,rows=Array<number>(4).fill(0),cols=Array<number>(4).fill(0);
    for(let i=0;i<area;i++) {rows[Math.floor(random()*4)]++;cols[Math.floor(random()*4)]++;}
    const level:Level={id:0,name:'',chapter:'',tip:'',size:4,terrain:[{r:1,c:1,kind:'water'},{r:2,c:2,kind:'water'}],pieces:[{id:'a',kind:'camp',shape},{id:'b',kind:'camp',shape},{id:'f',kind:'fire',shape:'single'}],rows,cols};
    const groups=placementDomains(level),raw=solveLevel(level,Infinity,{},groups);
    const logic=reasonLevel(level,{maxAssumptions:64,maxDepth:2,maxUnresolved:96},groups);
    assert.deepEqual(signatures(solveLevel(level,Infinity)),signatures(raw));
    assert.deepEqual(signatures(solveLevel(level,Infinity,{},reasonedDomains(groups,logic))),signatures(raw));
  }
});

test('a returned candidate retains all final acceptance checks, independent uniqueness and diagnostics',()=>{
  const map=generateMap(1,20261019,'coordinated',[]);
  assert.ok(map.diagnostics.candidatesGenerated>=map.diagnostics.candidatesValidated);
  assert.ok(map.diagnostics.candidatesValidated>=1 && map.diagnostics.proofs>=1);
  assert.equal(map.diagnostics.unique,true);
  assert.equal(map.diagnostics.reasoning.solved,true);
  assert.deepEqual(inventoryViolations(map.draft.level,1),[]);
  const proof=solveLevel(map.draft.level,2,{},placementDomains(map.draft.level));
  assert.equal(proof.aborted,false);
  assert.equal(proof.count,1);
});

test('a single high-tier candidate can complete validation without waiting for two more maps',()=>{
  const map=generateMap(10,20261020,'single-candidate',[]);
  assert.equal(map.diagnostics.candidatesGenerated,1);
  assert.equal(map.diagnostics.candidatesValidated,1);
  assert.equal(map.diagnostics.proofs,1);
  assert.equal(map.diagnostics.unique,true);
  assert.equal(map.diagnostics.reasoning.solved,true);
  assert.deepEqual(inventoryViolations(map.draft.level,10),[]);
  const proof=solveLevel(map.draft.level,2,{deadline:Date.now()+1000,maxNodes:100000});
  assert.equal(proof.aborted,false);
  assert.equal(proof.count,1);
});
