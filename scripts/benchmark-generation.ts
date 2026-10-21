import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { inventoryViolations } from '../src/engine/generationConfig';
import { generateMap, MapGenerationSearchError } from '../src/engine/mapGeneration';
import { solveLevel } from '../src/engine/solver';
import { evaluate } from '../src/engine/placementRules';
import { occupied } from '../src/engine/boardGeometry';
import { encodeMap } from '../src/engine/mapBlueprint';
import { mapFeatures } from '../src/engine/mapNovelty';

const output = '.desktop-smoke/generation-benchmark';
mkdirSync(output, { recursive: true });
type Generated = ReturnType<typeof generateMap>;
const samples: Generated[] = [];
const records: Record<string, unknown>[] = [];
const cases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(difficulty => [20261019, 20261020].map(seed => ({ difficulty, seed, disabled: [] as string[] })));
cases.push(...([
  [3, ['foodTruck_single', 'pool_single', 'camp_el']], [3, ['camp_single']],
  [6, ['cabin_el']], [10, ['camp_el', 'foodTruck_single']], [10, ['cabin_el']], [10, ['camp_long']],
] as [number, string[]][]).map(([difficulty, disabled]) => ({ difficulty, seed: 20261019, disabled })));
function run(difficulty: number, seed: number, disabled: string[], recent: Generated[] = []) {
  const started = performance.now();
  try {
    const map = generateMap(difficulty, seed, `bench-${records.length}`, recent.map(m => m.fingerprint), disabled, recent.map(m => mapFeatures(m.draft, difficulty)));
    const ms = Math.round(performance.now() - started);
    const proof = solveLevel(map.draft.level, 2, { deadline: Date.now() + 1000, maxNodes: 100000 });
    if (proof.aborted || proof.count !== 1 || !evaluate(map.draft.level, map.draft.placements).won || map.draft.level.pieces.some(p => disabled.includes(`${p.kind}_${p.shape}`)) || inventoryViolations(map.draft.level,difficulty,disabled).length > 0 || !map.diagnostics.reasoning.solved) throw new Error('Benchmark verification failed');
    samples.push(map);
    const record = { difficulty, seed, disabled, recent: recent.length, status: 'success', ms, solutionCount: proof.count, unique: true, proofAborted: proof.aborted,
      facilities: map.draft.level.pieces.map(p => `${p.kind}_${p.shape}`), metrics: map.metrics, ...map.diagnostics, reasoning: undefined, code: encodeMap(map.draft) };
    records.push(record);
    console.log(JSON.stringify({ difficulty, seed, disabled, recent: recent.length, ms, unique: proof.count, terrain: map.diagnostics.quality.terrainCount, grass: map.diagnostics.quality.grass, logic: map.metrics.logic }));
    return map;
  } catch (error) {
    const record = { difficulty, seed, disabled, recent: recent.length, status: 'failed', ms: Math.round(performance.now() - started), unique: 'unproven', error: String(error), ...(error instanceof MapGenerationSearchError ? error.diagnostics : {}) };
    records.push(record); console.log(JSON.stringify(record));
  }
}
for (const c of cases) run(c.difficulty, c.seed, c.disabled);
// Same seed with history exercises candidate rejection without a worker restart.
const base = samples.find(m => m.difficulty === 1)!;
const repeat = run(1, base.seed, [], [base]);
if (repeat) run(1, base.seed, [], [base, repeat]);

const palette = { camp: '#d79b58', fire: '#ef7356', tower: '#b39bdb', picnic: '#e0bc72', cabin: '#ab9474', foodTruck: '#72b9a5', powerTower: '#a2b6d5', pool: '#6dc9db' };
const labels = { camp: 'C', fire: 'F', tower: 'T', picnic: 'P', cabin: 'H', foodTruck: 'V', powerTower: 'E', pool: 'S' };
for (const difficulty of [1, 6, 10]) {
  const map = samples.find(m => m.difficulty === difficulty);
  if (!map) continue;
  const level = map.draft.level, size = 52, margin = 48;
  const cells = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8 }));
  const entries = map.draft.placements.map(at => ({ piece: level.pieces.find(p => p.id === at.id)!, cells: occupied(level.pieces.find(p => p.id === at.id)!, at) }));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="580"><rect width="512" height="580" fill="#172820"/><g font-family="Arial" text-anchor="middle" font-size="16" fill="#e6eee1"><text x="256" y="23">Tier ${difficulty} / seed ${map.seed} / ${map.diagnostics.elapsed} ms</text>`;
  for (let i = 0; i < 8; i++) svg += `<text x="${margin + i * size + 26}" y="44">${level.cols[i]}</text><text x="28" y="${margin + i * size + 32}">${level.rows[i]}</text>`;
  for (const p of cells) {
    const terrain = level.terrain.find(t => t.r === p.r && t.c === p.c), entry = entries.find(e => e.cells.some(c => c.r === p.r && c.c === p.c));
    const fill = entry ? palette[entry.piece.kind] : terrain ? ({ water: '#3c819b', forest: '#356547', mountain: '#777f83' }[terrain.kind]) : '#b3c69a';
    const label = entry ? `${labels[entry.piece.kind]}${level.pieces.indexOf(entry.piece) + 1}` : terrain ? ({ water: '~', forest: 'Y', mountain: '^' }[terrain.kind]) : '';
    svg += `<rect x="${margin + p.c * size}" y="${margin + p.r * size}" width="52" height="52" fill="${fill}" stroke="#1c332a"/><text fill="#132b22" x="${margin + p.c * size + 26}" y="${margin + p.r * size + 32}">${label}</text>`;
  }
  svg += `<text x="256" y="492">C camp / F fire / T tower / P picnic / H cabin</text><text x="256" y="518">V truck / E power / S pool / same ID = one piece</text><text x="256" y="544">~ water / Y forest / ^ mountain / blank = grass</text></g></svg>`;
  writeFileSync(`${output}/tier-${difficulty}.svg`, svg);
  await sharp(Buffer.from(svg)).png().toFile(`${output}/tier-${difficulty}.png`);
  writeFileSync(`${output}/tier-${difficulty}-reasoning.json`, JSON.stringify(map.diagnostics.reasoning, null, 2));
}
writeFileSync(`${output}/benchmark.json`, JSON.stringify({ platform: process.platform, node: process.version, seeds: [20261019, 20261020], records }, null, 2));
console.log(`Results: ${records.filter(r => r.status === 'success').length}/${records.length}; ${output}/benchmark.json`);
