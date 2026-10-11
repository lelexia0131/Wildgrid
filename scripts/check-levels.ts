import { solveLevel } from '../src/game/solver';
import { evaluate } from '../src/game/rules';
import { getSolution, levels } from '../src/game/levels';
let failed = false;
for (const level of levels.filter(l => l.id >= 16)) {
  const result = solveLevel(level);
  const valid = evaluate(level, getSolution(level.id) || []).won;
  const unique = !result.aborted && result.count === 1 && valid;
  console.log(`Level ${level.id} ${unique ? '✅ unique' : '❌ ' + (result.count === 0 ? 'no solution' : !valid ? 'invalid reference' : 'multiple solutions')} | terrain=${result.terrain} pieces=${result.pieces} cells=${result.occupied} placements=${result.candidates} nodes=${result.nodes} rotated=${result.rotationCandidates}`);
  if (!unique) failed = true;
}
if (failed) process.exitCode = 1;
