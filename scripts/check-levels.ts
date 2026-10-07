import { solveLevel } from '../src/game/solver';
import { evaluate } from '../src/game/rules';
import data from '../src/data/levels.json';
import answers from '../src/data/solutions.json';
import type { Level, Placement } from '../src/game/types';
const levels = data as Level[];
const solutions = answers as Record<string, Placement[]>;
let failed = false;
for (const level of levels.filter(l => l.id >= 16)) {
  const result = solveLevel(level);
  const valid = evaluate(level, solutions[level.id] || []).won;
  const unique = result.count === 1 && valid;
  console.log(`Level ${level.id} ${unique ? '✅ unique' : '❌ ' + (result.count === 0 ? 'no solution' : !valid ? 'invalid reference' : 'multiple solutions')} | terrain=${result.terrain} pieces=${result.pieces} cells=${result.occupied} placements=${result.candidates} nodes=${result.nodes} rotated=${result.rotationCandidates}`);
  if (!unique) failed = true;
}
if (failed) process.exitCode = 1;
