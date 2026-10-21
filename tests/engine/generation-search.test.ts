import {test} from 'node:test';
import assert from 'node:assert/strict';
import {facilityLibrary} from '../../src/engine/facilityRegistry';
import {placementDomains,placementGeometry,staticPositions} from '../../src/engine/placementDomains';
import {repartitionCount,refineFacilities,tileFacilities} from '../../src/engine/facilityConstruction';
import {evaluate} from '../../src/engine/placementRules';
import {withEditorPlacements} from '../../src/engine/mapBlueprint';
import {solveLevel} from '../../src/engine/solver';
import {layoutTerrain,terrainDistribution,terrainRegions} from '../../src/engine/terrainLayout';
import {terrainRegistry} from '../../src/engine/terrainRegistry';
import {seeded} from '../../src/engine/mapGeneration';
import {mapQuality} from '../../src/engine/mapQuality';
import type {Level} from '../../src/engine/types';

test('generated map quality rejects seven or eight occupied cells in either line direction',()=>{
  for(const vertical of [false,true]) for(const count of [6,7,8]) {
    const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:Array.from({length:count},(_,i)=>({id:`p-${i}`,kind:'powerTower',shape:'single'})),terrain:[],rows:Array(8).fill(0),cols:Array(8).fill(0)};
    const placements=level.pieces.map((p,i)=>({id:p.id,r:vertical?i:0,c:vertical?0:i,rotation:0}));
    const draft=withEditorPlacements({level,placements},placements);
    assert.equal(mapQuality(draft).violations.includes('line occupancy'),count>6,`${vertical?'column':'row'} ${count}`);
  }
});

test('joint packing honors an eight-cell clue instead of imposing a hidden seven-cell limit',()=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:Array.from({length:8},(_,i)=>({id:`p-${i}`,kind:'powerTower',shape:'single'})),terrain:[],rows:[8,0,0,0,0,0,0,0],cols:Array(8).fill(1)};
  const entries=tileFacilities(level,placementDomains(level),{powerTower_single:8},seeded(1));
  assert.ok(entries);
  assert.equal(entries.length,8);
  const answer={...level,pieces:entries.map(e=>e.piece)},placements=entries.map(e=>({...e.p.at,id:e.piece.id}));
  assert.ok(evaluate(answer,placements).won);
  assert.equal(solveLevel(answer,2).count,1);
});

test('cached terrain influence remains equal to gameplay after terrain type swaps and relocations',()=>{
  const original:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:facilityLibrary,rows:Array(8).fill(5),cols:Array(8).fill(5),terrain:[{r:1,c:1,kind:'water'},{r:3,c:2,kind:'forest'},{r:4,c:4,kind:'mountain'}]};
  const variants=[original,{...original,terrain:original.terrain.map(t=>({...t,kind:t.kind==='water'?'forest' as const:t.kind==='forest'?'water' as const:t.kind}))},
    {...original,terrain:original.terrain.map(t=>t.kind==='water'?{...t,r:6,c:6}:t)}];
  for(const level of variants) for(const piece of level.pieces) {
    const actual=placementGeometry(piece,8).filter(p=>evaluate(level,[{...p.at,id:piece.id}],{staticOnly:true}).status!=='INVALID').map(p=>p.mask);
    assert.deepEqual(staticPositions(piece,level).map(p=>p.mask),actual,piece.id);
    assert.deepEqual(placementDomains(level).find(g=>g.piece.id===piece.id)!.domain.map(p=>p.mask),actual,piece.id);
  }
});

test('joint terrain capacity preserves exact quotas for virtual multi-cell terrain units',()=>{
  const definitions=[...terrainRegistry,{id:'virtual',name:'Virtual',cells:[{r:0,c:0},{r:0,c:1}],diagonal:false,componentMax:3,clusterBias:.2,compactnessBias:0}];
  const cells=new Set(Array.from({length:64},(_,i)=>i).filter(i=>Math.floor(i/8)>=1 && Math.floor(i/8)<=5 && i%8>=2 && i%8<=6));
  for(let seed=0;seed<16;seed++) {
    const terrain=layoutTerrain(seeded(seed),{virtual:2,water:3},definitions,7,{cells,terrainArea:3});
    assert.ok(terrain);
    assert.equal(terrain.filter(t=>cells.has(t.r*8+t.c)).length,3);
    assert.equal(terrain.filter(t=>t.kind==='virtual').length,4);
    assert.equal(terrain.filter(t=>t.kind==='water').length,3);
    assert.deepEqual(terrainDistribution(terrain,terrainRegions(terrain,definitions),definitions).violations,[]);
  }
});

test('multi-cell repartition rejection witnesses a second solution even after position refinement',()=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces:[{id:'a',kind:'camp',shape:'domino'},{id:'b',kind:'camp',shape:'domino'}],terrain:[{r:0,c:1,kind:'water'},{r:3,c:2,kind:'water'}],rows:Array(8).fill(8),cols:Array(8).fill(8)};
  const placements=[{id:'a',r:1,c:1,rotation:0},{id:'b',r:2,c:1,rotation:0}];
  const draft=withEditorPlacements({level,placements},placements),groups=placementDomains(draft.level);
  const entries=placements.map(at=>({piece:level.pieces.find(p=>p.id===at.id)!,p:groups[0].domain.find(p=>p.at.r===at.r && p.at.c===at.c && p.at.rotation===at.rotation)!}));
  assert.ok(evaluate(draft.level,placements).won);
  assert.equal(repartitionCount(entries,groups),1);
  refineFacilities(entries,groups,seeded(1),Date.now()+1000);
  assert.equal(repartitionCount(entries,groups),1);
  const proof=solveLevel(draft.level,2);
  assert.ok(!proof.aborted && proof.count===2);
});
