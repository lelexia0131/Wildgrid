import { adjacent, evaluate, occupied, offsets } from './rules';
import type { Cell, Level, Piece, Placement } from './types';

type Candidate = { at: Placement; cells: Cell[]; mask: bigint; near: bigint; around: bigint; rows: number[]; cols: number[] };
export type SolverResult = { count: number; solutions: Placement[][]; terrain: number; pieces: number; occupied: number; candidates: number; rotationCandidates: number; nodes: number };

// One domain per kind + shape. Increasing placement indices remove ID permutations.
export function solveLevel(level: Level, limit = 2): SolverResult {
  const n = level.size;
  const bits = Array.from({ length: n * n }, (_, i) => 1n << BigInt(i));
  const bit = (p: Cell) => bits[p.r * n + p.c];
  const board = Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n }));
  const groups: { piece: Piece; ids: string[]; domain: Candidate[] }[] = [];
  const stats: SolverResult = { count: 0, solutions: [], terrain: level.terrain.length, pieces: level.pieces.length, occupied: 0, candidates: 0, rotationCandidates: 0, nodes: 0 };
  for (const piece of level.pieces) {
    stats.occupied += offsets(piece.shape, 0).length;
    const group = groups.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    if (group) { group.ids.push(piece.id); continue; }
    const domain: Candidate[] = [], seen = new Set<string>();
    for (let rotation = 0; rotation < 4; rotation++) {
      const signature = offsets(piece.shape, rotation).map(p => `${p.r},${p.c}`).sort().join(';');
      if (seen.has(signature)) continue;
      seen.add(signature);
      for (const origin of board) {
        const at = { ...origin, id: piece.id, rotation }, cells = occupied(piece, at);
        // The gameplay evaluator owns terrain and footprint rules. Relationships
        // to other facilities are checked while searching and on complete layouts.
        if (evaluate({ ...level, pieces: [piece] }, [at], { staticOnly: true }).status === 'INVALID') continue;
        const rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
        for (const p of cells) { rows[p.r]++; cols[p.c]++; }
        if (rows.some((v, i) => v > level.rows[i]) || cols.some((v, i) => v > level.cols[i])) continue;
        const mask = cells.reduce((m, p) => m | bit(p), 0n);
        domain.push({ at, cells, mask, rows, cols, near: board.filter(p => cells.some(q => adjacent(p, q))).reduce((m, p) => m | bit(p), 0n), around: board.filter(p => cells.some(q => adjacent(p, q, true))).reduce((m, p) => m | bit(p), 0n) });
      }
    }
    groups.push({ piece, ids: [piece.id], domain });
  }
  stats.candidates = groups.reduce((s, g) => s + g.domain.length * g.ids.length, 0);
  stats.rotationCandidates = groups.reduce((s, g) => s + g.domain.filter(p => p.at.rotation !== 0).length * g.ids.length, 0);
  const remaining = groups.map(g => g.ids.length), last = groups.map(() => -1);
  const rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
  const chosen: { g: number; p: Candidate }[] = [];
  function search(used: bigint, camps: bigint, towers: bigint, fire: bigint, picnic: bigint) {
    if (stats.count >= limit) return;
    stats.nodes++;
    if (chosen.length === level.pieces.length) {
      if (rows.some((v, i) => v !== level.rows[i]) || cols.some((v, i) => v !== level.cols[i])) return;
      if (chosen.some(({ g, p }) => ['fire', 'picnic'].includes(groups[g].piece.kind) && !(p.near & camps))) return;
      const indices = groups.map(() => 0);
      const solution = chosen.map(({ g, p }) => ({ ...p.at, id: groups[g].ids[indices[g]++] }));
      if (!evaluate(level, solution).won) return;
      stats.solutions.push(solution);
      stats.count++;
      return;
    }
    let best = -1, choices: number[] = [], possible = 0n, possibleCamps = camps;
    for (let g = 0; g < groups.length; g++) {
      if (!remaining[g]) continue;
      const group = groups[g], valid: number[] = [];
      for (let i = last[g] + 1; i < group.domain.length; i++) {
        const p = group.domain[i];
        if (p.mask & used || p.rows.some((v, r) => rows[r] + v > level.rows[r]) || p.cols.some((v, c) => cols[c] + v > level.cols[c])) continue;
        if (group.piece.kind === 'tower' && (p.around & towers) || group.piece.kind === 'fire' && (p.around & picnic) || group.piece.kind === 'picnic' && (p.around & fire)) continue;
        valid.push(i); possible |= p.mask;
        if (group.piece.kind === 'camp') possibleCamps |= p.mask;
      }
      if (valid.length < remaining[g]) return;
      if (best < 0 || valid.length < choices.length) { best = g; choices = valid; }
    }
    if (chosen.some(({ g, p }) => ['fire', 'picnic'].includes(groups[g].piece.kind) && !(p.near & possibleCamps))) return;
    const capacityR = Array<number>(n).fill(0), capacityC = Array<number>(n).fill(0);
    for (const p of board) if (possible & bit(p)) { capacityR[p.r]++; capacityC[p.c]++; }
    if (rows.some((v, r) => v + capacityR[r] < level.rows[r]) || cols.some((v, c) => v + capacityC[c] < level.cols[c])) return;
    const group = groups[best], previous = last[best];
    for (const i of choices) {
      const p = group.domain[i], kind = group.piece.kind;
      if (['fire', 'picnic'].includes(kind) && !(p.near & possibleCamps)) continue;
      last[best] = i; remaining[best]--; chosen.push({ g: best, p });
      for (let j = 0; j < n; j++) { rows[j] += p.rows[j]; cols[j] += p.cols[j]; }
      search(used | p.mask, kind === 'camp' ? camps | p.mask : camps, kind === 'tower' ? towers | p.mask : towers, kind === 'fire' ? fire | p.mask : fire, kind === 'picnic' ? picnic | p.mask : picnic);
      for (let j = 0; j < n; j++) { rows[j] -= p.rows[j]; cols[j] -= p.cols[j]; }
      chosen.pop(); remaining[best]++; last[best] = previous;
      if (stats.count >= limit) break;
    }
  }
  if (limit > 0 && level.rows.reduce((a, b) => a + b, 0) === stats.occupied && level.cols.reduce((a, b) => a + b, 0) === stats.occupied) search(0n, 0n, 0n, 0n, 0n);
  return stats;
}

export const countSolutions = (level: Level, limit = 2) => solveLevel(level, limit).count;
