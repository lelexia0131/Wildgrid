import { placementDomains } from './placementDomains';
import type { Candidate } from './placementDomains';
import { CAMP_REQUIREMENTS, evaluate } from './placementRules';
import { offsets } from './boardGeometry';
import type { Cell, FacilityKind, Level, Placement } from './types';

export type SolverResult = { count: number; solutions: Placement[][]; terrain: number; pieces: number; occupied: number; candidates: number; rotationCandidates: number; nodes: number; branches: number; aborted: boolean; forced: number };

// One domain per kind + shape. Increasing placement indices remove ID permutations.
export function solveLevel(level: Level, limit = 2, budget: { deadline?: number; maxNodes?: number } = {}): SolverResult {
  const n = level.size;
  const bits = Array.from({ length: n * n }, (_, i) => 1n << BigInt(i));
  const bit = (p: Cell) => bits[p.r * n + p.c];
  const board = Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n }));
  const groups = placementDomains(level);
  const stats: SolverResult = { count: 0, solutions: [], terrain: level.terrain.length, pieces: level.pieces.length, occupied: 0, candidates: 0, rotationCandidates: 0, nodes: 0, branches: 0, aborted: false, forced: 0 };
  stats.occupied = level.pieces.reduce((sum, p) => sum + offsets(p.shape, 0).length, 0);
  stats.candidates = groups.reduce((s, g) => s + g.domain.length * g.ids.length, 0);
  stats.rotationCandidates = groups.reduce((s, g) => s + g.domain.filter(p => p.at.rotation !== 0).length * g.ids.length, 0);
  stats.forced = groups.reduce((s, g) => s + (g.domain.length === g.ids.length ? g.ids.length : 0), 0);
  const remaining = groups.map(g => g.ids.length), last = groups.map(() => -1);
  const rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
  const chosen: { g: number; p: Candidate }[] = [];
  const supports = (p: Candidate, camps: bigint, used: bigint) => p.connections.some(link => (link.camp & camps) && !(link.gap & used));
  function search(used: bigint, byKind: Partial<Record<FacilityKind, bigint>>) {
    const camps = byKind.camp ?? 0n;
    if (stats.count >= limit || stats.aborted) return;
    stats.nodes++;
    if (stats.nodes > (budget.maxNodes ?? Infinity) || (stats.nodes % 64 === 1 && Date.now() >= (budget.deadline ?? Infinity))) { stats.aborted = true; return; }
    if (chosen.length === level.pieces.length) {
      if (rows.some((v, i) => v !== level.rows[i]) || cols.some((v, i) => v !== level.cols[i])) return;
      if (chosen.some(({ g, p }) => CAMP_REQUIREMENTS[groups[g].piece.kind] && !supports(p, camps, used))) return;
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
        if (p.forbidden.some(({ kind, mask }) => mask & (byKind[kind] ?? 0n))) continue;
        valid.push(i); possible |= p.mask;
        if (group.piece.kind === 'camp') possibleCamps |= p.mask;
      }
      if (valid.length < remaining[g]) return;
      if (best < 0 || valid.length / remaining[g] < choices.length / remaining[best]) { best = g; choices = valid; }
    }
    if (chosen.some(({ g, p }) => CAMP_REQUIREMENTS[groups[g].piece.kind] && !supports(p, possibleCamps, used))) return;
    const capacityR = Array<number>(n).fill(0), capacityC = Array<number>(n).fill(0);
    for (const p of board) if (possible & bit(p)) { capacityR[p.r]++; capacityC[p.c]++; }
    if (rows.some((v, r) => v + capacityR[r] < level.rows[r]) || cols.some((v, c) => v + capacityC[c] < level.cols[c])) return;
    const group = groups[best], previous = last[best];
    if (choices.length > 1) stats.branches++;
    for (const i of choices) {
      const p = group.domain[i], kind = group.piece.kind;
      if (CAMP_REQUIREMENTS[kind] && !supports(p, possibleCamps, used | p.mask)) continue;
      last[best] = i; remaining[best]--; chosen.push({ g: best, p });
      for (let j = 0; j < n; j++) { rows[j] += p.rows[j]; cols[j] += p.cols[j]; }
      search(used | p.mask, { ...byKind, [kind]: (byKind[kind] ?? 0n) | p.mask });
      for (let j = 0; j < n; j++) { rows[j] -= p.rows[j]; cols[j] -= p.cols[j]; }
      chosen.pop(); remaining[best]++; last[best] = previous;
      if (stats.count >= limit || stats.aborted) break;
    }
  }
  if (limit > 0 && level.rows.reduce((a, b) => a + b, 0) === stats.occupied && level.cols.reduce((a, b) => a + b, 0) === stats.occupied) search(0n, {});
  return stats;
}

export const countSolutions = (level: Level, limit = 2) => solveLevel(level, limit).count;
