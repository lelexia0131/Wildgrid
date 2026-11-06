import {test} from 'node:test';
import assert from 'node:assert/strict';
import {facilityLibrary} from '../../src/engine/facilityRegistry';
import {placementDomains,placementGeometry,staticPositions} from '../../src/engine/placementDomains';
import {facilityAreaReachable,repartitionCount,refineFacilities,tileFacilities} from '../../src/engine/facilityConstruction';
import {evaluate} from '../../src/engine/placementRules';
import {withEditorPlacements} from '../../src/engine/mapBlueprint';
import {solveLevel} from '../../src/engine/solver';
import {layoutTerrain,terrainDistribution,terrainRegions} from '../../src/engine/terrainLayout';
import {terrainRegistry} from '../../src/engine/terrainRegistry';
import {seeded} from '../../src/engine/mapGeneration';
import {mapQuality} from '../../src/engine/mapQuality';
import type {Level} from '../../src/engine/types';

test('residual area pruning equals exhaustive integer inventory enumeration',()=>{
  const random=seeded(871);
  for(let sample=0;sample<300;sample++) {
    const items=Array.from({length:4},(_,i)=>{
      const min=Math.floor(random()*3);
      return {id:String(i),area:1+Math.floor(random()*3),min,max:min+Math.floor(random()*3)};
    });
    const counts=items.map(i=>Math.floor(random()*(i.max+1)));
    for(const available of [0,2,5,Infinity]) for(let area=0;area<=16;area++) {
      const enumerate=(g:number,rest:number,slots:number):boolean=>{
        if(g===items.length) return rest===0;
        const item=items[g];
        for(let n=Math.max(0,item.min-counts[g]);n<=item.max-counts[g] && n<=slots && n*item.area<=rest;n++)
          if(enumerate(g+1,rest-n*item.area,slots-n)) return true;
        return false;
      };
      assert.equal(facilityAreaReachable(items,counts,area,available),enumerate(0,area,available),`${sample}/${area}/${available}`);
    }
  }
});

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

test('quality distinguishes connected activity space from enclosed grass with equal area and clues',()=>{
  const ring=Array.from({length:16},(_,i)=>({r:2+Math.floor(i/4),c:2+i%4})).filter(p=>p.r===2 || p.r===5 || p.c===2 || p.c===5);
  const closed=[...ring,{r:0,c:1}],open=closed.map(p=>p.r===2 && p.c===3?{r:2,c:1}:p.r===0?{r:0,c:3}:p);
  const qualities=[closed,open].map(cells=>{
    const pieces=cells.map((_,i)=>({id:`p-${i}`,kind:'powerTower' as const,shape:'single' as const}));
    const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces,terrain:[],rows:Array(8).fill(0),cols:Array(8).fill(0)};
    const placements=cells.map((p,i)=>({...p,id:pieces[i].id,rotation:0}));
    return mapQuality(withEditorPlacements({level,placements},placements));
  });
  const [separated,connected]=qualities;
  assert.equal(separated.grass,connected.grass);
  assert.equal(separated.effectiveGrass,separated.grass);
  assert.equal(connected.effectiveGrass,connected.grass);
  assert.equal(separated.clueEntropy,connected.clueEntropy);
  assert.equal(separated.grassComponents,2);
  assert.equal(connected.grassComponents,1);
  assert.equal(separated.largestGrassPatch,separated.grass-4);
  assert.equal(connected.largestGrassPatch,connected.grass);
  assert.ok(connected.score>separated.score);
});

test('quality penalizes crowded unrelated contacts while preserving legal camp gatherings',()=>{
  const pieces:Level['pieces']=[{id:'c',kind:'camp',shape:'single'},{id:'f',kind:'fire',shape:'single'},{id:'p',kind:'picnic',shape:'domino'},{id:'s',kind:'pool',shape:'single'}];
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces,terrain:[{r:2,c:3,kind:'water'},{r:4,c:4,kind:'water'}],rows:Array(8).fill(0),cols:Array(8).fill(0)};
  const placements=[{id:'c',r:3,c:3,rotation:0},{id:'f',r:3,c:2,rotation:0},{id:'p',r:3,c:4,rotation:0},{id:'s',r:4,c:3,rotation:0}];
  const gathering=withEditorPlacements({level,placements},placements),quality=mapQuality(gathering);
  assert.ok(evaluate(gathering.level,placements).won);
  assert.equal(quality.unrelatedContacts,0);
  assert.equal(quality.crowdedFacilities,0);
  const crowded=withEditorPlacements({level:{...level,terrain:[],pieces:pieces.map(p=>({...p,kind:'powerTower',shape:'single'}))},placements},placements);
  assert.ok(evaluate(crowded.level,placements).won);
  assert.equal(mapQuality(crowded).unrelatedContacts,3);
  assert.equal(mapQuality(crowded).crowdedFacilities,1);
});

test('activity space and building order metrics are invariant under board rotation and reflection',()=>{
  const cells=[{r:1,c:2},{r:2,c:2},{r:2,c:1},{r:2,c:3},{r:6,c:5}];
  const metrics=[];
  for(const reflected of [false,true]) for(let rotation=0;rotation<4;rotation++) {
    const transformed=cells.map(p=>{
      let r=p.r,c=reflected?7-p.c:p.c;
      for(let step=0;step<rotation;step++) [r,c]=[c,7-r];
      return {r,c};
    });
    const pieces=transformed.map((_,i)=>({id:`p-${i}`,kind:'powerTower' as const,shape:'single' as const}));
    const level:Level={id:0,name:'',chapter:'',tip:'',size:8,pieces,terrain:[],rows:Array(8).fill(0),cols:Array(8).fill(0)};
    const placements=transformed.map((p,i)=>({...p,id:pieces[i].id,rotation:0}));
    const quality=mapQuality(withEditorPlacements({level,placements},placements));
    metrics.push([quality.grassComponents,quality.largestGrassPatch,quality.unrelatedContacts,quality.crowdedFacilities]);
  }
  for(const result of metrics) assert.deepEqual(result,metrics[0]);
});
