import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { levels, getSolution, solveLevel, evaluate, encodeMap } from '../src/engine';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = JSON.parse(readFileSync('tests/fixtures/phase2-engine-baseline.json', 'utf8')) as {
  dataHash: string;
  puzzles: { id: number; solverHash: string; evaluationHash: string; mapCodeHash: string }[];
};
assert.equal(hash(levels), baseline.dataHash, 'Authored level data changed');
assert.equal(levels.length, baseline.puzzles.length);
let evaluations = 0;
const multiple: number[] = [];
for (const expected of baseline.puzzles) {
  const level = levels.find(level => level.id === expected.id)!;
  const answer = getSolution(level.id)!;
  const results = [evaluate(level, answer), ...answer.map((_, i) => evaluate(level, answer.filter((_, j) => i !== j))), ...answer.map((_, i) => evaluate(level, answer.map((at, j) => i === j ? { ...at, r: at.r + 1 } : at)))];
  const solved = solveLevel(level);
  assert.equal(hash(solved), expected.solverHash, `Day ${level.id}: solver output/order/statistics changed`);
  assert.equal(hash(results), expected.evaluationHash, `Day ${level.id}: formal rule results changed`);
  assert.equal(hash(encodeMap({ level, placements: answer })), expected.mapCodeHash, `Day ${level.id}: WG1 bytes changed`);
  assert.equal(solved.aborted, false); assert.equal(results[0].won, true);
  if (level.id >= 16) assert.equal(solved.count, 1, `Day ${level.id}: unique solution required`);
  if (solved.count > 1) multiple.push(level.id);
  evaluations += results.length;
}
console.log(`Preserved ${levels.length} levels, ${evaluations} rule evaluations, ${levels.length} complete solver outputs and ${levels.length} WG1 codes. Days 16–45 remain unique; baseline tutorial levels with multiple solutions: ${multiple.join(', ') || 'none'}.`);
