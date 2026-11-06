import {test} from 'node:test';
import assert from 'node:assert/strict';
import {incrementalTerrainDomains,terrainMasks,terrainSolutionCheck} from '../../src/engine/terrainRefinementState';
import {placementDomains,placementGeometry} from '../../src/engine/placementDomains';
import {facilityLibrary} from '../../src/engine/facilityRegistry';
import {generationDifficulty,seeded} from '../../src/engine/mapGeneration';
import {levels,getSolution} from '../../src/engine/levels';
import {evaluate} from '../../src/engine/placementRules';
import {occupied} from '../../src/engine/boardGeometry';
import {refineLogicalLayout,refineTerrain} from '../../src/engine/generationRefinement';
import type {Level,Placement,Terrain} from '../../src/engine/types';
import type {SandboxDraft} from '../../src/engine/mapBlueprint';
import repairFixture from '../fixtures/terrain-repair-cache.json';

test('equally effective terrain repairs prefer keeping previously excluded counterexamples invalid',()=>{
  const {draft,witnesses,randomSeed,minimumSurvivors}=repairFixture as {draft:SandboxDraft;witnesses:Placement[][];randomSeed:number;minimumSurvivors:number};
  const alive=witnesses.map(w=>evaluate(draft.level,w).won);
  assert.ok(alive.some(Boolean) && alive.some(v=>!v));
  const entries=draft.placements.map(at=>{
    const piece=draft.level.pieces.find(p=>p.id===at.id)!;
    return {piece,p:placementGeometry(piece,8).find(p=>p.at.r===at.r && p.at.c===at.c && p.at.rotation===at.rotation)!};
  });
  const next=refineTerrain(draft.level,entries,seeded(randomSeed),Infinity,witnesses);
  assert.ok(evaluate(next,draft.placements).won);
  const remaining=witnesses.map(w=>evaluate(next,w).won);
  assert.equal(remaining.filter(Boolean).length,minimumSurvivors);
  assert.ok(remaining.filter(Boolean).length<alive.filter(Boolean).length);
  assert.ok(remaining.every((valid,i)=>!valid || alive[i]),'an available repair must not revive an earlier counterexample');
});

test('logical layout refinement stops at the caller acceptance policy instead of chasing smaller static domains',()=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,
    pieces:[{id:'camp',kind:'camp',shape:'single'},{id:'fire',kind:'fire',shape:'single'}],
    terrain:[{r:1,c:1,kind:'water'}],rows:[2,0,0,0,0,0,0,0],cols:[0,1,1,0,0,0,0,0]};
  const placements=[{id:'camp',r:0,c:1,rotation:0},{id:'fire',r:0,c:2,rotation:0}],draft={level,placements};
  const groups=placementDomains({...level,rows:Array(8).fill(6),cols:Array(8).fill(6)});
  const entries=placements.map(at=>({piece:level.pieces.find(p=>p.id===at.id)!,p:groups.find(g=>g.piece.id===at.id)!.domain.find(p=>p.at.r===at.r && p.at.c===at.c)!}));
  assert.ok(placementDomains(level).some(g=>g.domain.length>g.ids.length));
  let draws=0;
  const result=refineLogicalLayout(draft,entries,groups,()=>{draws++;return .5;},Infinity,16,
    (d,logic)=>!generationDifficulty(d,{occupied:0,candidates:0,nodes:0,branches:0},logic,1).rejection);
  assert.equal(result,draft);
  assert.equal(draws,0);
  assert.ok(evaluate(result.level,result.placements).won);
  refineLogicalLayout(draft,entries,groups,()=>{draws++;return .5;},Infinity,16,()=>false);
  assert.ok(draws>0,'a rejected logic policy must not trigger the early success stop');
});

test('incremental terrain domains exactly match full domains after additions, removals, swaps and rollbacks',()=>{
  const kinds:Terrain['kind'][]=['water','forest','mountain'];
  for(let seed=0;seed<8;seed++) {
    const random=seeded(seed),level:Level={id:0,name:'',chapter:'',tip:'',size:8,
      pieces:[...facilityLibrary,{...facilityLibrary[0],id:'another-camp'}],
      terrain:[],rows:Array.from({length:8},()=>Math.floor(random()*7)),cols:Array.from({length:8},()=>Math.floor(random()*7))};
    const incremental=incrementalTerrainDomains(level);
    const initial=incremental.groups;
    assert.deepEqual(initial,placementDomains(level));
    let terrain:Terrain[]=[];
    for(let move=0;move<80;move++) {
      const r=Math.floor(random()*8),c=Math.floor(random()*8);
      terrain=terrain.filter(t=>t.r!==r || t.c!==c);
      if(move%5!==0) terrain.push({r,c,kind:kinds[Math.floor(random()*3)]});
      if(move%7===0 && terrain.length) terrain=terrain.slice(1);
      if(move%11===0) terrain=terrain.map(t=>({...t,kind:kinds[(kinds.indexOf(t.kind)+1)%3]}));
      const previous=incremental.groups,copy=structuredClone(previous);
      assert.deepEqual(incremental.update(terrain),placementDomains({...level,terrain}),`${seed}/${move}`);
      assert.deepEqual(previous,copy,'later updates must not mutate retained beam candidates');
    }
    assert.deepEqual(incremental.update([]),initial,'removed terrain must restore previously excluded positions and truck gaps');
  }
});

test('one terrain repair eliminates several counterexamples while preserving the answer and terrain quantities',()=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,
    pieces:[{id:'a',kind:'camp',shape:'single'},{id:'b',kind:'fire',shape:'single'},{id:'c',kind:'camp',shape:'single'},{id:'d',kind:'fire',shape:'single'}],
    terrain:[{r:1,c:1,kind:'water'},{r:1,c:2,kind:'water'},{r:7,c:5,kind:'water'},{r:7,c:6,kind:'water'}],
    rows:[2,0,0,0,0,0,2,0],cols:[0,1,1,0,0,1,1,0]};
  const answer=[{id:'a',r:0,c:1,rotation:0},{id:'b',r:0,c:2,rotation:0},{id:'c',r:6,c:5,rotation:0},{id:'d',r:6,c:6,rotation:0}];
  const witnesses=[1,2,3].map(swap=>answer.map((p,i)=>({...p,c:p.c+((swap&(i<2?1:2))?(i%2===0?1:-1):0)})));
  const groups=placementDomains(level),entries=answer.map(at=>{
    const piece=level.pieces.find(p=>p.id===at.id)!;
    return {piece,p:groups.find(g=>g.piece.kind===piece.kind)!.domain.find(p=>p.at.r===at.r && p.at.c===at.c)!};
  });
  assert.ok(evaluate(level,answer).won);
  assert.ok(witnesses.every(w=>evaluate(level,w).won));
  const next=refineTerrain(level,entries,seeded(1),Infinity,witnesses);
  assert.ok(evaluate(next,answer).won);
  assert.ok(witnesses.filter(w=>evaluate(next,w).won).length<=1);
  assert.equal(next.terrain.length,level.terrain.length);
  assert.ok(next.terrain.every(t=>t.kind==='water'));
});

test('fixed-solution terrain masks agree with the independent gameplay evaluator',()=>{
  const random=seeded(729),kinds:Terrain['kind'][]=['water','forest','mountain'];
  for(const level of levels.filter(l=>l.size===8 && !l.sky)) {
    const placements=getSolution(level.id)!;
    assert.ok(evaluate(level,placements).won);
    const entries=placements.map(at=>{
      const piece=level.pieces.find(p=>p.id===at.id)!;
      const mask=occupied(piece,at).reduce((m,c)=>m|(1n<<BigInt(c.r*8+c.c)),0n);
      return {piece,p:placementGeometry(piece,8).find(p=>p.mask===mask)!};
    });
    const valid=terrainSolutionCheck(entries);
    assert.equal(valid(terrainMasks(level.terrain)),true);
    for(let move=0;move<32;move++) {
      const terrain=level.terrain.filter((_,i)=>i!==move%level.terrain.length);
      const r=Math.floor(random()*8),c=Math.floor(random()*8);
      const next=terrain.filter(t=>t.r!==r || t.c!==c);
      next.push({r,c,kind:kinds[Math.floor(random()*3)]});
      assert.equal(valid(terrainMasks(next)),evaluate({...level,terrain:next},placements).won,`${level.id}/${move}`);
    }
  }
});
