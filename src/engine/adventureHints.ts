import { occupied, key } from './boardGeometry';
import { placementDomains, compatible } from './placementDomains';
import type { PlacementGroup } from './placementDomains';
import { evaluate } from './placementRules';
import { solveLevel } from './solver';
import { reasonLevel } from './logicalSolver';
import type { LogicStep } from './logicalSolver';
import type { Cell, Level, Placement } from './types';

export type HintRequest = { level: Level; placements: readonly Placement[]; introduced?: readonly string[] };
export type AdventureHint =
  | { status: 'ready'; placement: Placement; forced: boolean; cells: Cell[]; region: Cell[]; axis: 'row' | 'col'; line: number; remaining: number; candidates: number; deductions: { rule: LogicStep['rule']; removed: number }[] }
  | { status: 'conflict'; cells: Cell[]; reasons: string[] }
  | { status: 'complete' | 'unknown' };

// Fixed IDs get singleton domains; interchangeable unused IDs keep the solver's
// existing symmetry reduction. Rules and final validation remain in the solver.
export function hintDomains(level: Level, placements: readonly Placement[]): PlacementGroup[] {
  return placementDomains(level).flatMap(group => {
    const fixed = placements.filter(at => group.ids.includes(at.id));
    const locked = fixed.map(at => ({ ...group, ids: [at.id], domain: group.domain.filter(p => {
      const cells = occupied(group.piece, at);
      return cells.length === p.cells.length && cells.every(cell => p.cells.some(q => key(q) === key(cell)));
    }).map(p => ({ ...p, at: { ...p.at, id: at.id } })) }));
    const ids = group.ids.filter(id => !fixed.some(at => at.id === id));
    const remaining = ids.length ? [{ ...group, ids, domain: group.domain.filter(p => locked.every(lock => lock.domain.length === 1 && compatible(p, group.piece.kind, lock.domain[0]))).map(p => ({ ...p, at: { ...p.at, id: ids[0] } })) }] : [];
    return [...locked, ...remaining];
  });
}

export function analyzeAdventureHint({ level, placements, introduced = [] }: HintRequest, budgetMs = 2500): AdventureHint {
  const deadline = Date.now() + budgetMs;
  const current = evaluate(level, placements);
  if (current.won) return { status: 'complete' };
  const conflicts = placements.filter(at => current.issues[at.id]?.status === 'INVALID');
  if (conflicts.length) return { status: 'conflict', cells: conflicts.flatMap(at => occupied(level.pieces.find(p => p.id === at.id)!, at)), reasons: [...new Set(conflicts.flatMap(at => current.issues[at.id].reasons))] };
  const original = hintDomains(level, placements);
  const logic = reasonLevel(level, { deadline, maxAssumptions: 0 }, original);
  // A representative ID distinguishes pinned and unused groups of the same
  // kind/shape. Only unconditional top-level eliminations are reused.
  const signature = (at: Placement) => `${at.id}/${at.r}/${at.c}/${at.rotation}`;
  const eliminated = new Set(logic.steps.flatMap(step => step.eliminated ?? []).map(signature));
  const groups = original.map(g => ({ ...g, domain: g.domain.filter(p => !eliminated.has(signature(p.at))) }));
  const first = solveLevel(level, 1, { deadline }, groups);
  if (!first.count) return first.aborted ? { status: 'unknown' } : { status: 'conflict', cells: placements.flatMap(at => occupied(level.pieces.find(p => p.id === at.id)!, at)), reasons: [] };
  const fixed = groups.filter(g => g.ids.length === 1 && placements.some(at => at.id === g.ids[0]));
  const options = first.solutions[0].filter(at => !placements.some(p => p.id === at.id)).map(at => {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const group = groups.find(g => g.ids.includes(at.id))!;
    const cells = occupied(piece, at);
    const domain = group.domain.filter(p => fixed.every(g => compatible(p, g.piece.kind, g.domain[0]))
      && p.rows.every((v, r) => v + current.rows[r] <= level.rows[r]) && p.cols.every((v, c) => v + current.cols[c] <= level.cols[c]));
    const lines = cells.flatMap(cell => [
      { axis: 'row' as const, line: cell.r, remaining: level.rows[cell.r] - current.rows[cell.r] },
      { axis: 'col' as const, line: cell.c, remaining: level.cols[cell.c] - current.cols[cell.c] },
    ]).sort((a, b) => a.remaining - b.remaining);
    const line = lines[0];
    // Teach new rules, constrained domains, tight clues and larger footprints.
    const score = (introduced.includes(`${piece.kind}_${piece.shape}`) ? 50 : 0) + 30 / Math.max(1, domain.length) + cells.length * 2 + 8 / line.remaining;
    return { at, group, cells, candidates: domain.length, ...line, score };
  }).sort((a, b) => b.score - a.score);
  if (!options.length) return { status: 'unknown' };
  let selected = options[0], forced = false;
  // Exclude the footprint for the entire interchangeable group. An exhaustive
  // empty search proves necessity across ALL completions, not just two samples.
  for (const option of options) {
    if (Date.now() >= deadline) break;
    const mask = option.cells.map(key).sort().join(';');
    const excluded = groups.map(g => g === option.group ? { ...g, domain: g.domain.filter(p => p.cells.map(key).sort().join(';') !== mask) } : g);
    const proof = solveLevel(level, 1, { deadline }, excluded);
    if (!proof.count && !proof.aborted) { selected = option; forced = true; break; }
  }
  const { at, cells, axis, line, remaining, candidates } = selected;
  const region = Array.from({ length: level.size }, (_, i) => axis === 'row' ? { r: line, c: i } : { r: i, c: line });
  const deductions = logic.steps.filter(step => step.eliminated?.some(p => p.id === selected.group.domain[0].at.id)).map(step => ({ rule: step.rule, removed: step.removed }));
  return { status: 'ready', placement: at, forced, cells, region, axis, line, remaining, candidates, deductions };
}
