import { evaluate, placementBlock } from './placementRules';
import { key, occupied } from './boardGeometry';
import type { Issue, Level, Piece, Placement, Status } from './types';

// Predict only empty starting cells. The formal evaluator owns every rule.
export function placementHints(level: Level, placements: readonly Placement[], piece: Piece, rotation: number, baseline: Record<string, Issue>): Record<string, Status> {
  const used = new Set([...level.terrain, ...placements.flatMap(at => occupied(level.pieces.find(p => p.id === at.id)!, at))].map(key));
  const hints: Record<string, Status> = {};
  for (let r = 0; r < level.size; r++) for (let c = 0; c < level.size; c++) {
    const candidate = { id: piece.id, r, c, rotation }, cellKey = key(candidate);
    if (used.has(cellKey)) continue;
    if (placementBlock(level, placements, candidate)) { hints[cellKey] = 'INVALID'; continue; }
    const { issues } = evaluate(level, [...placements, candidate]);
    const addsError = Object.entries(issues).some(([id, issue]) => issue.status === 'INVALID' &&
      (baseline[id]?.status !== 'INVALID' || issue.reasons.some(reason => !baseline[id].reasons.includes(reason))));
    hints[cellKey] = addsError || issues[piece.id].status === 'INVALID' ? 'INVALID' : issues[piece.id].status;
  }
  return hints;
}
