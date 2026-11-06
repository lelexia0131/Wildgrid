import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {cpus,platform,arch,release} from 'node:os';
import {generateMap,MapGenerationSearchError,generationReasoningBudget,generationDifficulty,generationBudget} from '../src/engine/mapGeneration';
import {reasonLevel} from '../src/engine/logicalSolver';
import {generationBudgets,inventoryViolations,templateId} from '../src/engine/generationConfig';
import {evaluate} from '../src/engine/placementRules';
import {solveLevel} from '../src/engine/solver';
import {terrainRegions,terrainDistribution} from '../src/engine/terrainLayout';
import {encodeMap} from '../src/engine/mapBlueprint';
import {serializeSurvivalSave,parseSurvivalSave} from '../src/save-system/survivalSaveCodec';
import {createSurvivalSave,emptySurvivalProgress} from '../src/game-modes/survival/survivalChallenge';

const phase=process.argv[2]??'budget-after',highOnly=process.argv.includes('--high');
const seedCount=Number(process.argv.find(a=>a.startsWith('--seeds='))?.split('=')[1]??2);
const firstSeed=Number(process.argv.find(a=>a.startsWith('--seed='))?.split('=')[1]??20261019);
const onlyDifficulty=Number(process.argv.find(a=>a.startsWith('--difficulty='))?.split('=')[1]);
const difficulties=process.argv.find(a=>a.startsWith('--difficulties='))?.split('=')[1].split(',').map(Number)??(highOnly?[9,10]:[1,5,7,9,10]);
const cases=difficulties.filter(d=>!onlyDifficulty || d===onlyDifficulty).flatMap(difficulty=>Array.from({length:seedCount},(_,i)=>({difficulty,seed:firstSeed+i,disabled:[] as string[]})));
if(!highOnly && !process.argv.includes('--skip-extra')) cases.push({difficulty:1,seed:20261019,disabled:['camp_single']},{difficulty:10,seed:20261019,disabled:['camp_el','foodTruck_single']},{difficulty:10,seed:20261020,disabled:['pool_single']});
const output=`.desktop-smoke/generator-rework/${phase}.json`;
const previous=process.argv.includes('--resume') && existsSync(output)?JSON.parse(readFileSync(output,'utf8')):undefined;
const records:Record<string,unknown>[]=previous?.records??[];
assert.ok(records.every((r,i)=>r.difficulty===cases[i]?.difficulty && r.seed===cases[i]?.seed && JSON.stringify(r.disabled)===JSON.stringify(cases[i]?.disabled)),'resume inputs must match');
const environment={node:process.version,platform:platform(),arch:arch(),release:release(),cpu:cpus()[0].model,logicalCpus:cpus().length,firstSeed,seedCount,difficulties,generationBudgets:Object.fromEntries(difficulties.map(d=>[d,generationBudget(d)])),proofMs:1000,proofNodes:100000,segments:[...(previous?.environment?.segments??[]),{startIndex:records.length,started:new Date().toISOString()}]};
const stopFile=process.argv.find(a=>a.startsWith('--stop-file='))?.slice('--stop-file='.length);
mkdirSync('.desktop-smoke/generator-rework',{recursive:true});
for(const {difficulty,seed,disabled} of cases.slice(records.length)) {
  if(stopFile && existsSync(stopFile)) break;
  const started=performance.now();
  try {
    const map=generateMap(difficulty,seed,'budget-check',[],disabled),{level,placements}=map.draft;
    assert.deepEqual(inventoryViolations(level,difficulty,disabled),[]);
    assert.ok(evaluate(level,placements).won);
    assert.equal(level.pieces.some(p=>templateId(p)==='camp_single'),!disabled.includes('camp_single'));
    const proof=solveLevel(level,2,{deadline:Date.now()+1000,maxNodes:100000});
    assert.ok(!proof.aborted && proof.count===1);
    const logic=reasonLevel(level,{...generationReasoningBudget(difficulty),deadline:Date.now()+generationBudget(difficulty)});
    assert.ok(logic.solved && !logic.aborted && !logic.contradiction);
    assert.equal(generationDifficulty(map.draft,proof,logic,difficulty).rejection,null);
    assert.deepEqual(generationDifficulty(map.draft,proof,logic,difficulty).logic,map.metrics.logic);
    const save={...createSurvivalSave(),challenge:map,progress:emptySurvivalProgress(map.id)};
    assert.ok(parseSurvivalSave(serializeSurvivalSave(save)).challenge,'new inventory save roundtrip');
    const regions=terrainRegions(level.terrain),distribution=terrainDistribution(level.terrain,regions);
    assert.deepEqual(distribution.violations,[]);
    const record={difficulty,seed,disabled,status:'success',ms:Math.round(performance.now()-started),generationMs:map.diagnostics.elapsed,
      candidatesGenerated:map.diagnostics.candidatesGenerated,candidatesValidated:map.diagnostics.candidatesValidated,proofs:map.diagnostics.proofs,proofExhaustions:map.diagnostics.proofExhaustions,logicChecks:map.diagnostics.logicChecks,cutoffs:map.diagnostics.cutoffs,timeDependent:map.diagnostics.timeDependent,
      facilities:Object.fromEntries(generationBudgets(difficulty,disabled).facilities.items.map(i=>[i.id,level.pieces.filter(p=>templateId(p)===i.id).length])),
      inventory:map.diagnostics.inventory,facilityDeviation:(map.diagnostics.inventory.facilities.area/map.diagnostics.inventory.facilities.target-1)*100,
      terrainDeviation:(map.diagnostics.inventory.terrain.area/map.diagnostics.inventory.terrain.target-1)*100,
      regions,distribution,terrainQuadrants:Object.fromEntries(regions.map(r=>[r.kind,[0,1,2,3].map(q=>level.terrain.filter(t=>t.kind===r.kind && (t.r>=4?2:0)+(t.c>=4?1:0)===q).length)])),
      unique:proof.count,independentLogic:logic.solved,logic:map.metrics.logic,quality:map.diagnostics.quality,motifs:map.diagnostics.motifs,attempts:map.diagnostics.attempts,failures:map.diagnostics.failures,phases:map.diagnostics.phases,construction:map.diagnostics.construction,code:encodeMap(map.draft)};
    records.push(record);console.log(JSON.stringify({...record,code:undefined}));
  } catch(error) {
    if(!(error instanceof MapGenerationSearchError)) throw error;
    const record={difficulty,seed,disabled,status:'failed',ms:Math.round(performance.now()-started),error:error.message,...error.diagnostics};
    records.push(record);console.log(JSON.stringify(record));
  }
  writeFileSync(output,JSON.stringify({environment,records},null,2));
}
const timing=(runs:typeof records)=>{
  const values=runs.map(r=>Number(r.generationMs??r.elapsed)).sort((a,b)=>a-b);
  return {count:values.length,meanMs:values.length?values.reduce((s,v)=>s+v,0)/values.length:null,p50Ms:values.length?values[Math.ceil(values.length*.5)-1]:null,p95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null,maxMs:values.length?values.at(-1):null,totalMs:values.reduce((s,v)=>s+v,0)};
};
const stats=[...new Set(cases.map(c=>c.difficulty))].map(difficulty=>{
  const runs=records.filter(r=>r.difficulty===difficulty),failures:Record<string,number>={};
  for(const r of runs) for(const [name,count] of Object.entries(r.failures as Record<string,number>)) failures[name]=(failures[name]??0)+count;
  return {difficulty,successes:runs.filter(r=>r.status==='success').length,total:runs.length,all:timing(runs),success:timing(runs.filter(r=>r.status==='success')),failed:timing(runs.filter(r=>r.status==='failed')),failures};
});
writeFileSync(output,JSON.stringify({environment,records,stats,complete:records.length===cases.length},null,2));
console.log(JSON.stringify({successes:records.filter(r=>r.status==='success').length,total:records.length,stats}));
if(records.some(r=>r.status!=='success')) process.exitCode=1;
