import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rankFor, rankProgress, SURVIVAL_RANKS, SURVIVAL_DIFFICULTIES } from '../src/game-modes/survival/survivalDifficulty';
import { facilityRestrictionError, facilityKey, SURVIVAL_FACILITIES } from '../src/game-modes/survival/survivalFacilities';
import { generateSurvival, replaceSurvivalChallenge, createSurvivalSave } from '../src/game-modes/survival/survivalChallenge';
import { serializeSurvivalSave, parseSurvivalSave } from '../src/save-system/survivalSaveCodec';
import { readDisabledFacilities, writeDisabledFacilities } from '../src/save-system/survivalFacilityStorage';
import { evaluate } from '../src/engine/placementRules';
import { solveLevel } from '../src/engine/solver';
import { MapGenerationConstraintError, MapGenerationSearchError, generationDifficulty } from '../src/engine/mapGeneration';
import { mapFeatures, compareMaps } from '../src/engine/mapNovelty';
import { decodeMap, encodeMap, withEditorPlacements, mapFingerprint } from '../src/engine/mapBlueprint';
import { getLevelById, getSolution } from '../src/engine/levels';
import type { SurvivalChallenge } from '../src/game-modes/survival/survivalChallenge';

const output = '.desktop-smoke/survival-rework';
mkdirSync(output, { recursive: true });
test('all 15 XP boundaries, progress, ceiling and independent referenced SVG assets', () => {
  const thresholds = [0,10,50,100,300,500,1000,3000,5000,10000,20000,30000,40000,60000,80000];
  const hashes = new Set<string>();
  assert.deepEqual(SURVIVAL_RANKS.map(r => r.xp), thresholds);
  assert.deepEqual(SURVIVAL_DIFFICULTIES.map(d => d.xp), [1,3,6,10,15,25,36,50,70,100]);
  for (const [i, rank] of SURVIVAL_RANKS.entries()) {
    assert.equal(rankFor(rank.xp),i);
    if(i) assert.equal(rankFor(rank.xp-1),i-1);
    assert.ok(/[ⅠⅡⅢ]$/.test(rank.name));
    const path = `src/assets/${rank.icon}.svg`; assert.ok(existsSync(path));
    const content = readFileSync(path,'utf8'); assert.ok(content.includes('id="metal"'));
    hashes.add(createHash('sha256').update(content).digest('hex'));
    if(i<14) assert.equal(rankProgress((rank.xp+thresholds[i+1])/2).fill,.5);
  }
  assert.equal(hashes.size,15); assert.equal(rankFor(999999),14); assert.equal(rankProgress(999999).fill,1);
});

test('disabled preferences persist separately and enforce camp and tier floors before searching', () => {
  const values = new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  writeDisabledFacilities(['camp_el','cabin_el','unknown','camp_el']);
  assert.deepEqual(readDisabledFacilities(),['camp_el','cabin_el']);
  assert.deepEqual([...values.keys()],['wildgrid-survival-disabled-v1']);
  const camps = SURVIVAL_FACILITIES.filter(p=>p.kind==='camp').map(facilityKey);
  assert.ok(facilityRestrictionError(1,camps));
  const restricted = SURVIVAL_FACILITIES.slice(4).map(facilityKey);
  assert.ok(facilityRestrictionError(10,restricted));
  const t=Date.now();
  assert.throws(()=>generateSurvival(10,1,'invalid',[],restricted),MapGenerationConstraintError);
  assert.throws(()=>generateSurvival(1,1,'invalid',[],camps),MapGenerationConstraintError);
  assert.ok(Date.now()-t<100);
});

function generate(difficulty:number, seed:number, disabled:string[]=[]): SurvivalChallenge {
  const started=Date.now();
  for(let attempt=0;Date.now()-started<45000;attempt++) {
    try { return generateSurvival(difficulty,(seed+attempt*0x9e3779b9)>>>0,`sample-${difficulty}-${seed}`,[],disabled); }
    catch(cause) { if(!(cause instanceof MapGenerationSearchError)) throw cause; }
  }
  throw new Error(`No unique sample: difficulty ${difficulty}, seed ${seed}`);
}

test('shape-specific and combined facility bans remain hard constraints on unique generated answers', () => {
  const samples=[];
  for(const [difficulty,disabled] of [[3,['foodTruck_single','pool_single','camp_el']], [3,['camp_single']], [6,['cabin_el']], [10,['camp_el','foodTruck_single']]] as [number,string[]][]) {
    const map=generate(difficulty,20261100+difficulty,disabled);
    assert.ok(map.draft.level.pieces.every(p=>!disabled.includes(facilityKey(p))));
    assert.equal(evaluate(map.draft.level,map.draft.placements).won,true);
    const solved=solveLevel(map.draft.level,2,{maxNodes:100000,deadline:Date.now()+5000});
    assert.equal(solved.aborted,false);assert.equal(solved.count,1);
    samples.push({difficulty,disabled,pieces:map.draft.level.pieces.map(facilityKey),terrain:map.draft.level.terrain.length});
  }
  writeFileSync(`${output}/disabled-samples.json`,JSON.stringify(samples,null,2));
});

test('10th-tier samples differ in terrain, composition, clues, geometric structure and dependencies', () => {
  const maps=[20261018,20261019,20261020,20261021].map(seed=>generate(10,seed));
  const features=maps.map(m=>mapFeatures(m.draft,10));
  const pairs=[];
  for(let i=0;i<maps.length;i++) {
    const solved=solveLevel(maps[i].draft.level,2,{maxNodes:100000,deadline:Date.now()+5000});
    assert.equal(solved.aborted,false);assert.equal(solved.count,1);
    const metrics=generationDifficulty(maps[i].draft,solved);
    assert.ok(metrics.logic.solved && metrics.score>=5.1 && metrics.logic.maxDepth<=2 && metrics.forced<=.65);
    for(let j=0;j<i;j++) {const comparison=compareMaps(features[i],features[j]);assert.equal(comparison.equivalent,false);assert.ok(comparison.similarity<.88);pairs.push({a:i,b:j,...comparison});}
  }
  assert.ok(new Set(features.map(f=>JSON.stringify(f.terrainCounts))).size>=3);
  assert.ok(new Set(features.map(f=>JSON.stringify(f.facilities))).size>=3);
  assert.ok(new Set(features.map(f=>JSON.stringify(f.links))).size>=3);
  assert.ok(new Set(features.map(f=>JSON.stringify(f.views[0].clues))).size>=3);
  const rotated={...features[0],views:[...features[0].views.slice(1),features[0].views[0]]};
  assert.equal(compareMaps(rotated,features[0]).equivalent,true);
  assert.equal(compareMaps(features[0],features[0]).exact,true);
  let save=createSurvivalSave();for(const map of maps)save=replaceSurvivalChallenge(save,map);
  const restored=parseSurvivalSave(serializeSurvivalSave(save));assert.equal(restored.recentMaps?.length,4);assert.equal(restored.recentMaps?.[0].views.length,1);assert.equal(compareMaps(restored.recentMaps![0],features[0]).equivalent,true);assert.equal(restored.challenge?.id,maps[3].id);
  // A seeded generation with recent features must reject geometric equivalents.
  const different=generateSurvival(1,991,'history',[],[],[mapFeatures(generate(1,991).draft,1)]);
  assert.equal(compareMaps(mapFeatures(different.draft,1),mapFeatures(generate(1,991).draft,1)).equivalent,false);
  writeFileSync(`${output}/diversity.json`,JSON.stringify({maps:maps.map((m,i)=>({seed:m.seed,terrain:features[i].terrainCounts,facilities:features[i].facilities,links:features[i].links,metrics:generationDifficulty(m.draft,solveLevel(m.draft.level,2,{maxNodes:100000})),code:JSON.stringify(m.draft)})),pairs},null,2));
});

test('legacy v1 progress and ledger retain their original map when new preferences are applied',()=>{
  const placements=getSolution(6)!;
  const draft=withEditorPlacements({level:{...getLevelById(6)!,size:8},placements},placements);
  const m={id:'legacy-map',difficulty:1,seed:6,code:encodeMap(draft),draft,fingerprint:mapFingerprint(draft)};
  const raw={version:1,completed:[{id:'older',difficulty:10,seed:3,at:5}],recent:['legacy'],challenge:{id:m.id,difficulty:m.difficulty,seed:m.seed,code:m.code,fingerprint:m.fingerprint},progress:{id:m.id,status:'active',placements:m.draft.placements.slice(0,2),past:[[]],future:[],rotations:{domino:1},selectedId:null}};
  const save=parseSurvivalSave(JSON.stringify(raw));
  assert.deepEqual(save.challenge?.draft,decodeMap(m.code));assert.deepEqual(save.progress?.placements,m.draft.placements.slice(0,2));assert.deepEqual(save.completed,raw.completed);
  writeDisabledFacilities(['camp_el','cabin_el']);
  assert.deepEqual(parseSurvivalSave(serializeSurvivalSave(save)).challenge?.draft,save.challenge?.draft);
});
