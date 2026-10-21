import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {generateMap,MapGenerationSearchError} from '../src/engine/mapGeneration';
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
const cases=(highOnly?[9,10]:[1,5,7,9,10]).filter(d=>!onlyDifficulty || d===onlyDifficulty).flatMap(difficulty=>Array.from({length:seedCount},(_,i)=>({difficulty,seed:firstSeed+i,disabled:[] as string[]})));
if(!highOnly) cases.push({difficulty:1,seed:20261019,disabled:['camp_single']},{difficulty:10,seed:20261019,disabled:['camp_el','foodTruck_single']},{difficulty:10,seed:20261020,disabled:['pool_single']});
const records:Record<string,unknown>[]=[];
for(const {difficulty,seed,disabled} of cases) {
  const started=performance.now();
  try {
    const map=generateMap(difficulty,seed,'budget-check',[],disabled),{level,placements}=map.draft;
    assert.deepEqual(inventoryViolations(level,difficulty,disabled),[]);
    assert.ok(evaluate(level,placements).won);
    assert.equal(level.pieces.some(p=>templateId(p)==='camp_single'),!disabled.includes('camp_single'));
    const proof=solveLevel(level,2,{deadline:Date.now()+1000,maxNodes:100000});
    assert.ok(!proof.aborted && proof.count===1);
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
      unique:proof.count,logic:map.metrics.logic,attempts:map.diagnostics.attempts,failures:map.diagnostics.failures,phases:map.diagnostics.phases,construction:map.diagnostics.construction,code:encodeMap(map.draft)};
    records.push(record);console.log(JSON.stringify({...record,code:undefined}));
  } catch(error) {
    if(!(error instanceof MapGenerationSearchError)) throw error;
    const record={difficulty,seed,disabled,status:'failed',ms:Math.round(performance.now()-started),error:error.message,...error.diagnostics};
    records.push(record);console.log(JSON.stringify(record));
  }
}
mkdirSync('.desktop-smoke/generator-rework',{recursive:true});
const stats=[...new Set(cases.map(c=>c.difficulty))].map(difficulty=>{
  const runs=records.filter(r=>r.difficulty===difficulty),failures:Record<string,number>={};
  for(const r of runs) for(const [name,count] of Object.entries(r.failures as Record<string,number>)) failures[name]=(failures[name]??0)+count;
  return {difficulty,successes:runs.filter(r=>r.status==='success').length,total:runs.length,meanMs:runs.reduce((s,r)=>s+Number(r.ms),0)/runs.length,maxMs:Math.max(...runs.map(r=>Number(r.ms))),failures};
});
writeFileSync(`.desktop-smoke/generator-rework/${phase}.json`,JSON.stringify({records,stats},null,2));
console.log(JSON.stringify({successes:records.filter(r=>r.status==='success').length,total:records.length,stats}));
if(records.some(r=>r.status!=='success')) process.exitCode=1;
