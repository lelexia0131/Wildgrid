import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { levels, getSolution, solveLevel, evaluate, encodeMap } from '../src/engine';
import corrections from '../tests/fixtures/level-corrections.json';
import solverContract from '../tests/fixtures/phase2-solver-solutions.json';
import type { Level } from '../src/engine';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = JSON.parse(readFileSync('tests/fixtures/phase2-engine-baseline.json', 'utf8')) as {
  dataHash: string;
  puzzles: { id: number; solverHash: string; evaluationHash: string; mapCodeHash: string }[];
};
// Retain the original baseline. Only the documented terrain corrections may differ.
const historicalLevels = levels.map(level => {
  const correction = corrections.corrections.find(item => item.id === level.id);
  if (!correction) return level;
  assert.deepEqual(level.terrain, correction.after, `Day ${level.id}: approved terrain correction changed`);
  assert.equal(solveLevel(level).count, 1, `Day ${level.id}: corrected level must be unique`);
  assert.equal(evaluate(level, getSolution(level.id)!).won, true);
  return { ...level, terrain: correction.before } as Level;
});
assert.equal(hash(historicalLevels), baseline.dataHash, 'Unapproved authored level data change');
assert.equal(levels.length, baseline.puzzles.length);
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
  assert.equal(hash(results), expected.evaluationHash, `Day ${level.id}: formal rule results changed`);
  assert.equal(hash(encodeMap({ level, placements: answer })), expected.mapCodeHash, `Day ${level.id}: WG1 bytes changed`);
  assert.equal(solved.aborted, false); assert.equal(results[0].won, true);
  if (level.id >= 16) assert.equal(solved.count, 1, `Day ${level.id}: unique solution required`);
  if (solved.count > 1) multiple.push(level.id);
  evaluations += results.length;
}
console.log(`Preserved all ${levels.length} historical levels, ${evaluations} rule evaluations, complete solver solution sets and WG1 codes. Approved unique-solution terrain corrections from ${corrections.commit}: ${corrections.corrections.map(item => item.id).join(', ')}. All other current level fields and reference answers retain the historical contract; historical multiple-solution levels: ${multiple.join(', ') || 'none'}.`);
