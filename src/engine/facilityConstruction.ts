import { CAMP_REQUIREMENTS } from './placementRules';
import { boardCells, compatible } from './placementDomains';
import type { Candidate, PlacementGroup } from './placementDomains';
import type { FacilityKind, Level, Piece } from './types';

export type FacilityEntry = { piece: Piece; p: Candidate };
export const ACTIVITY_LIMITS = { minMulti:4, minLines:6, maxLines:7, spareCells:2 } as const;
// Two different roles exchanging equal-shaped footprints preserve every clue.
// A legal exchange is a cheap ambiguity witness, not a substitute for proving
// uniqueness of the candidates that survive this check.
export function hasRoleSwap(entries: FacilityEntry[], groups: PlacementGroup[]): boolean {
  const domains = new Map(groups.map(g => [`${g.piece.kind}_${g.piece.shape}`, new Map(g.domain.map(p => [p.mask,p]))]));
  const current = entries.map(e => ({ ...e, p: domains.get(`${e.piece.kind}_${e.piece.shape}`)!.get(e.p.mask)! }));
  const used = current.reduce((m,e) => m | e.p.mask,0n);
  for (let i = 0; i < current.length; i++) for (let j = i+1; j < current.length; j++) {
    const a = current[i], b = current[j];
    if (a.piece.kind === b.piece.kind || a.piece.shape !== b.piece.shape) continue;
    const pa = domains.get(`${a.piece.kind}_${a.piece.shape}`)!.get(b.p.mask), pb = domains.get(`${b.piece.kind}_${b.piece.shape}`)!.get(a.p.mask);
    if (!pa || !pb || !compatible(pa,b.piece.kind,pb)) continue;
    if (current.some((e,k) => k !== i && k !== j && (!compatible(pa,e.piece.kind,e.p) || !compatible(pb,e.piece.kind,e.p)))) continue;
    const camps = current.reduce((m,e,k) => e.piece.kind === 'camp' ? m | (k === i ? pa : k === j ? pb : e.p).mask : m,0n);
    if (current.some((e,k) => {
      const p = k === i ? pa : k === j ? pb : e.p;
      return CAMP_REQUIREMENTS[e.piece.kind] && !p.connections.some(link => (link.camp & camps) && !(link.gap & used));
    })) continue;
    return true;
  }
  return false;
}

// Compose an inventory from legal domains. Empty grass is never a covering target.
export function tileFacilities(level: Level, groups: PlacementGroup[], target: number, minMulti: number, grassReserve: number, random: () => number): FacilityEntry[] | undefined {
  const entries: FacilityEntry[] = [], rows = Array<number>(8).fill(0), cols = Array<number>(8).fill(0);
  const counts = new Map<FacilityKind, number>(), shapes = new Map<string, number>();
  const requireSingle = level.pieces.some(p => p.kind === 'camp' && p.shape === 'single');
  const onlySingleCamps = groups.every(g => g.piece.kind !== 'camp' || g.piece.shape === 'single' || !g.domain.length);
  const capacity=boardCells(8).filter(p=>level.rows[p.r]>0 && level.cols[p.c]>0 && !level.terrain.some(t=>t.r===p.r && t.c===p.c)).length;
  const maxArea = Math.min(64 - level.terrain.length - grassReserve,capacity-ACTIVITY_LIMITS.spareCells);
  const maxSize = Math.max(0, ...groups.filter(g => g.domain.length).map(g => g.domain[0].cells.length));
  const multiExtra=groups.some(g=>g.domain[0]?.cells.length===2)?1:2;
  if (!groups.some(g => g.piece.kind === 'camp' && g.domain.length && (!requireSingle || g.piece.shape === 'single')) || target + minMulti*multiExtra > maxArea || (minMulti && maxSize < 2)) return;
  let nodes = 0;
  function search(used: bigint, camps: bigint, multi: number, area: number): boolean {
    if (++nodes > 240) return false;
    const slots = target - entries.length, needMulti = Math.max(0, minMulti - multi);
    if (!slots) return !needMulti;
    if (needMulti > slots || area + slots + needMulti*multiExtra > maxArea) return false;
    const moves: { group: PlacementGroup; valid: Candidate[]; weight: number }[] = [];
    for (const group of groups) {
      const { piece, domain } = group, size = domain[0]?.cells.length ?? 0;
      if (!size) continue;
      if (!entries.length && (piece.kind !== 'camp' || (requireSingle && piece.shape !== 'single'))) continue;
      if (entries.length && needMulti > 0 && size === 1 && !(piece.kind === 'camp' && onlySingleCamps)) continue;
      if (needMulti === slots && size === 1) continue;
      if (area + size + slots - 1 + Math.max(0, needMulti - (size > 1 ? 1 : 0))*multiExtra > maxArea) continue;
      const valid = domain.filter(p => {
        if (p.mask & used || p.rows.some((v, r) => rows[r] + v > 7) || p.cols.some((v, c) => cols[c] + v > 7) || entries.some(e => !compatible(p, e.piece.kind, e.p))) return false;
        const next = used | p.mask;
        if (CAMP_REQUIREMENTS[piece.kind] && !p.connections.some(link => (link.camp & camps) && !(link.gap & next))) return false;
        return !entries.some(e => CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link => (link.camp & camps) && !(link.gap & next)));
      });
      const count = counts.get(piece.kind) ?? 0, sameShape = shapes.get(`${piece.kind}_${piece.shape}`) ?? 0;
      // Favor new roles and camp shapes, but keep every feasible role available.
      const balance = 1 / (1 + count * count / Math.max(1, target / 5));
      const variety = piece.kind === 'camp' && !sameShape ? 2 : 1;
      if (valid.length) moves.push({ group, valid, weight: balance * variety * (size > 1 && needMulti ? 2.5 : 1) / Math.sqrt(valid.length) });
    }
    const coverage = Array<number>(64).fill(0);
    for (const move of moves) for (const p of move.valid) for (const cell of p.cells) coverage[cell.r * 8 + cell.c]++;
    while (moves.length && nodes <= 240) {
      let cursor = random() * moves.reduce((sum, m) => sum + m.weight, 0);
      const move = moves.find(m => (cursor -= m.weight) <= 0) ?? moves[0];
      moves.splice(moves.indexOf(move), 1);
      const { piece } = move.group, key = `${piece.kind}_${piece.shape}`;
      const previous = counts.get(piece.kind) ?? 0, sameShape = shapes.get(key) ?? 0;
      // Prefer footprints that make existing row/column counts informative.
      // Random jitter keeps alternatives within the planner's clue capacities;
      // there is no requirement to fill a line or cover all activity grass.
      const ranked = move.valid.map(p => ({ p, score: (p.rows.reduce((s,v,i) => s+v*rows[i],0) + p.cols.reduce((s,v,i) => s+v*cols[i],0) + p.cells.reduce((s,c) => s+8/coverage[c.r*8+c.c],0)) / p.cells.length + random() * 4 })).sort((a,b) => b.score-a.score);
      for (let i = 0; i < Math.min(5, move.valid.length); i++) {
        const p = ranked[i].p;
        entries.push({ piece: { ...piece, id: `wild-${entries.length}` }, p });
        counts.set(piece.kind, previous + 1); shapes.set(key, sameShape + 1);
        for (let j = 0; j < 8; j++) { rows[j] += p.rows[j]; cols[j] += p.cols[j]; }
        if (search(used | p.mask, piece.kind === 'camp' ? camps | p.mask : camps, multi + (p.cells.length > 1 ? 1 : 0), area + p.cells.length)) return true;
        for (let j = 0; j < 8; j++) { rows[j] -= p.rows[j]; cols[j] -= p.cols[j]; }
        entries.pop(); counts.set(piece.kind, previous); shapes.set(key, sameShape);
        if (nodes > 240) return false;
      }
    }
    return false;
  }
  return search(0n, 0n, 0, 0) ? entries : undefined;
}
