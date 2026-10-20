import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateMap, MapGenerationSearchError, planTerrain, seeded } from '../src/engine/mapGeneration';
import { facilityLibrary } from '../src/engine/facilityRegistry';
import { SURVIVAL_DIFFICULTIES } from '../src/game-modes/survival/survivalDifficulty';
import { evaluate } from '../src/engine/placementRules';
import { solveLevel } from '../src/engine/solver';
import { encodeMap } from '../src/engine/mapBlueprint';
import { compareMaps, mapFeatures } from '../src/engine/mapNovelty';
import { terrainDistribution, terrainRegions } from '../src/engine/mapQuality';

const phase = process.argv[2] ?? 'after';
const records: Record<string, unknown>[] = [];
const maps: ReturnType<typeof generateMap>[] = [];
const terrainRun=process.argv.includes('--terrain');
const cases = (terrainRun?[1,5,9,10]:[1,5,7,10]).flatMap(difficulty => (terrainRun?[20261019,20261020,20261021]:[20261019,20261020]).map(seed => ({ difficulty, seed, disabled: [] as string[] })));
cases.push({ difficulty: 1, seed: 20261019, disabled: ['camp_single'] },
  { difficulty: 10, seed: 20261019, disabled: ['camp_single'] },
  { difficulty: 10, seed: 20261019, disabled: ['camp_el', 'foodTruck_single'] });
for (const { difficulty, seed, disabled } of cases.filter(c => !/^\d+$/.test(process.argv[3]??'') || c.difficulty === Number(process.argv[3]))) {
  const started = performance.now();
  try {
    const spec = SURVIVAL_DIFFICULTIES[difficulty - 1];
    const map = generateMap(difficulty, seed, 'check', [], spec, disabled);
    const ms = Math.round(performance.now() - started), { level, placements } = map.draft;
    const proof = solveLevel(level, 2, { maxNodes: 100000, deadline: Date.now() + 1500 });
    assert.ok(evaluate(level, placements).won);
    assert.ok(!proof.aborted && proof.count === 1);
    assert.ok(level.pieces.length >= spec.min && level.pieces.length <= spec.max);
    assert.ok(level.pieces.filter(p => p.shape !== 'single').length >= spec.multi);
    assert.ok(level.pieces.every(p => !disabled.includes(`${p.kind}_${p.shape}`)));
    const single = level.pieces.some(p => p.kind === 'camp' && p.shape === 'single');
    if (phase !== 'baseline') assert.equal(single, !disabled.includes('camp_single'));
    const facilities: Record<string, number> = {};
    for (const p of level.pieces) { const key = `${p.kind}_${p.shape}`; facilities[key] = (facilities[key] ?? 0) + 1; }
    const distribution=terrainDistribution(level.terrain);
    if(terrainRun && phase!=='terrain-before') assert.deepEqual(distribution.violations,[]);
    const record = { difficulty, seed, disabled, status: 'success', ms, single, facilities, metrics: map.metrics, distribution,
      ...map.diagnostics, reasoning: undefined, code: encodeMap(map.draft) };
    records.push(record); maps.push(map);
    console.log(JSON.stringify({ ...record, code: undefined }));
  } catch (error) {
    if (!(error instanceof MapGenerationSearchError)) throw error;
    const record = { difficulty, seed, disabled, status: 'failed', ms: Math.round(performance.now() - started), error: error.message, ...error.diagnostics };
    records.push(record); console.log(JSON.stringify(record));
  }
}
const diversity = (terrainRun?[1,5,9,10]:[1,5,7,10]).flatMap(d => {
  const pair = maps.filter(m => m.difficulty === d && m.seed >= 20261019 && m.seed <= 20261020 && m.draft.level.pieces.some(p => p.kind === 'camp' && p.shape === 'single'));
  return pair.length >= 2 ? [{ difficulty: d, ...compareMaps(mapFeatures(pair[0].draft, d), mapFeatures(pair[1].draft, d)) }] : [];
});
const summarize=(values:number[])=>{
  if(!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return {min:sorted[0],max:sorted.at(-1),mean:values.reduce((s,v)=>s+v,0)/values.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]};
};
const stats={successes:maps.length,total:records.length,terrain:summarize(maps.map(m=>m.draft.level.terrain.length)),
  kinds:Object.fromEntries(['water','forest','mountain'].map(kind=>[kind,summarize(maps.map(m=>m.draft.level.terrain.filter(t=>t.kind===kind).length))])),
  maxComponent:Math.max(0,...maps.flatMap(m=>m.diagnostics.quality.regions.map(r=>r.largest))),
  max3:Math.max(0,...maps.map(m=>terrainDistribution(m.draft.level.terrain).max3)),max4:Math.max(0,...maps.map(m=>terrainDistribution(m.draft.level.terrain).max4)),
  ms:summarize(records.map(r=>Number(r.ms)))};
let planningStats;
if(terrainRun && phase!=='terrain-before') {
  let run=0,maxIsolatedRun=0;
  const plans=Array.from({length:96},(_,i)=>{
    const plan=planTerrain(seeded(20261019+i),18,6,facilityLibrary); assert.ok(plan);
    const regions=terrainRegions(plan.terrain), distribution=terrainDistribution(plan.terrain,regions);
    assert.deepEqual(distribution.violations,[]);
    const isolated=regions.every(r=>r.largest<=1);run=isolated?run+1:0;maxIsolatedRun=Math.max(maxIsolatedRun,run);
    return {seed:20261019+i,total:plan.terrain.length,counts:regions.map(r=>r.count),largest:Math.max(...regions.map(r=>r.largest)),isolated,max3:distribution.max3,max4:distribution.max4};
  });
  planningStats={samples:plans.length,total:summarize(plans.map(p=>p.total)),allIsolated:plans.filter(p=>p.isolated).length,maxIsolatedRun,
    totalHistogram:Object.fromEntries([...new Set(plans.map(p=>p.total))].sort((a,b)=>a-b).map(n=>[n,plans.filter(p=>p.total===n).length])),plans};
}
mkdirSync('.desktop-smoke/generator-rework', { recursive: true });
writeFileSync(`.desktop-smoke/generator-rework/${phase}.json`, JSON.stringify({ records, diversity, stats, planningStats }, null, 2));
console.log(JSON.stringify({ phase, ...stats, diversity, planning:planningStats?{...planningStats,plans:undefined}:undefined }));
