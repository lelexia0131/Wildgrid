import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {decodeMap} from '../src/engine/mapBlueprint';
import {inventoryViolations} from '../src/engine/generationConfig';
import {placementDomains} from '../src/engine/placementDomains';
import {evaluate} from '../src/engine/placementRules';
import {solveLevel} from '../src/engine/solver';
import {mapQuality} from '../src/engine/mapQuality';

// Independent exhaustive verification: no generated reasoning trace, cached
// terrain domain, or logical preprocessor is supplied to this search.
const reference=process.argv.find(a=>a.startsWith('--reference='))?.slice('--reference='.length);
const prove:typeof solveLevel=reference?(await import(pathToFileURL(resolve(reference)).href)).solveLevel:solveLevel;
const files=process.argv.slice(2).filter(a=>!a.startsWith('--')),records=[];
mkdirSync('.desktop-smoke/generator-rework',{recursive:true});
for(const file of files) {
  const report=JSON.parse(readFileSync(file,'utf8')) as {records:{difficulty:number;seed:number;disabled:string[];status:string;code?:string}[]};
  for(const record of report.records) {
    if(record.status!=='success') continue;
    const draft=decodeMap(record.code!),started=performance.now();
    assert.ok(evaluate(draft.level,draft.placements).won);
    assert.deepEqual(inventoryViolations(draft.level,record.difficulty,record.disabled),[]);
    assert.ok(mapQuality(draft).accepted);
    const proof=prove(draft.level,2,{deadline:Date.now()+10000,maxNodes:1000000},placementDomains(draft.level));
    const result={file,difficulty:record.difficulty,seed:record.seed,disabled:record.disabled,ms:performance.now()-started,nodes:proof.nodes,count:proof.count,aborted:proof.aborted};
    records.push(result);
    writeFileSync('.desktop-smoke/generator-rework/raw-verification.json',JSON.stringify({reference:reference??'src/engine/solver.ts',deadlineMs:10000,maxNodes:1000000,records},null,2));
    console.log(JSON.stringify(result));
    assert.ok(!proof.aborted && proof.count===1,`${file}: ${record.difficulty}/${record.seed} independent proof incomplete or not unique`);
  }
}
console.log(JSON.stringify({verified:records.length,ms:records.reduce((s,r)=>s+r.ms,0),maxMs:Math.max(...records.map(r=>r.ms))}));
