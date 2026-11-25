import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { levels, getSolution, solveLevel, evaluate, encodeMap } from '../src/engine';
import corrections from '../tests/fixtures/level-corrections.json';
import solverContract from '../tests/fixtures/phase2-solver-solutions.json';
import type { Level } from '../src/engine';
import { fixtureCode, fixtureTerrain, historicalLevel } from '../tests/support/rock-rename';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = JSON.parse(readFileSync('tests/fixtures/phase2-engine-baseline.json', 'utf8')) as {
  dataHash: string;
  puzzles: { id: number; solverHash: string; evaluationHash: string; mapCodeHash: string }[];
};
// Retain the original baseline. Only the documented terrain corrections may differ.
const historicalLevels = levels.filter(l => l.id <= 45).map(level => {
  const correction = corrections.corrections.find(item => item.id === level.id);
  if (!correction) return level;
  assert.deepEqual(level.terrain, fixtureTerrain(correction.after), `Day ${level.id}: approved terrain correction changed`);
  assert.equal(solveLevel(level).count, 1, `Day ${level.id}: corrected level must be unique`);
  assert.equal(evaluate(level, getSolution(level.id)!).won, true);
  return { ...level, terrain: fixtureTerrain(correction.before) } satisfies Level;
});
assert.equal(hash(historicalLevels.map(historicalLevel)), baseline.dataHash, 'Unapproved authored level data change');
assert.equal(historicalLevels.length, baseline.puzzles.length);
let evaluations = 0;
const multiple: number[] = [];
for (const expected of baseline.puzzles) {
  const level = historicalLevels.find(level => level.id === expected.id)!;
  const answer = getSolution(level.id)!;
  const results = [evaluate(level, answer), ...answer.map((_, i) => evaluate(level, answer.filter((_, j) => i !== j))), ...answer.map((_, i) => evaluate(level, answer.map((at, j) => i === j ? { ...at, r: at.r + 1 } : at)))];
  const solved = solveLevel(level, Infinity);
  const semantic = solverContract.puzzles.find(item => item.id === level.id)!;
  const solutions = solved.solutions.map(solution => JSON.stringify(solution.map(({ id, r, c, rotation }) => ({ id, r, c, rotation })).sort((a, b) => a.id.localeCompare(b.id)))).sort();
  assert.equal(solved.count, semantic.count, `Day ${level.id}: complete solution count changed`);
  assert.equal(hash(solutions), semantic.solutionsHash, `Day ${level.id}: complete solution set changed`);
  const originalReasons=JSON.parse(JSON.stringify(results).replaceAll('瞭望塔需要上下左右挨着岩石','瞭望塔需要上下左右挨着山地'));
  assert.equal(hash(originalReasons), expected.evaluationHash, `Day ${level.id}: formal rule results changed`);
  assert.equal(hash(fixtureCode(encodeMap({level,placements:answer}),'rock','mountain')),expected.mapCodeHash,`Day ${level.id}: WG1 changed beyond the terrain rename`);
  assert.equal(solved.aborted, false); assert.equal(results[0].won, true);
  if (level.id >= 16) assert.equal(solved.count, 1, `Day ${level.id}: unique solution required`);
  if (solved.count > 1) multiple.push(level.id);
  evaluations += results.length;
}
console.log(`Matched ${historicalLevels.length} historical levels, ${evaluations} evaluations, complete solution sets and WG1 byte hashes after normalizing the rock rename for comparison. Approved terrain corrections from ${corrections.commit}: ${corrections.corrections.map(item => item.id).join(', ')}. Historical multiple-solution levels: ${multiple.join(', ') || 'none'}.`);
