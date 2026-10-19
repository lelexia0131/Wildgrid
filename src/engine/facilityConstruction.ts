import { adjacent } from './boardGeometry';
import { CAMP_REQUIREMENTS } from './placementRules';
import { boardCells, cellBit, placementDomains } from './placementDomains';
import type { Candidate } from './placementDomains';
import type { FacilityKind, Level, Piece } from './types';

export type FacilityEntry = { piece: Piece; p: Candidate };

// Cover planned activity grass, leaving the separately reserved paths empty.
// The inventory is composed during the search, not prescribed by a map template.
export function tileFacilities(level: Level, target: number, minMulti: number, random: () => number, deadline: number): FacilityEntry[] | undefined {
  const board = boardCells(8), terrainMask = level.terrain.reduce((m, t) => m | cellBit(t), 0n);
  const edge = [board.filter(p => p.r === 0), board.filter(p => p.r === 7), board.filter(p => p.c === 0), board.filter(p => p.c === 7)].find(cells => cells.every(p => !(terrainMask & cellBit(p))));
  if (!edge) return;
  let reserved = edge.reduce((m, p) => m | cellBit(p), 0n);
  const paths = board.filter(p => !(cellBit(p) & (reserved | terrainMask)));
  for (let i = 0, count = Math.floor(random() * 3); i < count; i++) reserved |= cellBit(paths[Math.floor(random() * paths.length)]);
  const required = ((1n << 64n) - 1n) & ~(reserved | terrainMask);
  const entries: FacilityEntry[] = [], counts = new Map<FacilityKind, number>();
  const pool = placementDomains(level).flatMap(g => g.domain.filter(p => {
    if (p.mask & ~required) return false;
    const near = (kind: string, diagonal = false) => level.terrain.some(t => t.kind === kind && p.cells.some(c => adjacent(c, t, diagonal)));
    if ((g.piece.kind === 'fire' || g.piece.kind === 'foodTruck' || g.piece.kind === 'powerTower' || g.piece.kind === 'pool') && near('mountain')) return false;
    if (g.piece.kind === 'picnic' && level.pieces.some(p => p.kind === 'camp' && p.shape === 'domino') && near('water')) return false;
    if (g.piece.kind === 'powerTower' && near('water')) return false;
    if (g.piece.kind === 'pool' && !near('forest', true)) return false;
    return true;
  }).map(p => ({ piece: g.piece, p })));

  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const byCell = board.map(cell => pool.filter(e => !!(e.p.mask & cellBit(cell))));
  let nodes = 0;
  function search(used: bigint, byKind: Partial<Record<FacilityKind, bigint>>, multi: number, area: number): boolean {
    if (++nodes > 3000 || (nodes % 16 === 1 && Date.now() >= deadline)) return false;
    const slots = target - entries.length, left = total - area;
    if (!slots) return !left && multi >= minMulti && entries.every(e => !CAMP_REQUIREMENTS[e.piece.kind] || e.p.connections.some(link => ((byKind.camp ?? 0n) & link.camp) && !(link.gap & (used | terrainMask))));
    if (left < slots + Math.max(0, minMulti - multi) || left > slots * 3) return false;
    let possibleCamps = byKind.camp ?? 0n;
    for (const e of pool) if (e.piece.kind === 'camp' && !(e.p.mask & used) && !e.p.forbidden.some(f => f.mask & (byKind[f.kind] ?? 0n))) possibleCamps |= e.p.mask;
    if (entries.some(e => CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link => (link.camp & possibleCamps) && !(link.gap & (required | terrainMask))))) return false;
    let choices: typeof pool = [];
    for (let cell = 0; cell < 64; cell++) {
      if (!(required & ~used & cellBit(board[cell]))) continue;
      const valid = byCell[cell].filter(e => {
        const { piece, p } = e, size = p.cells.length, count = counts.get(piece.kind) ?? 0;
        const cap = piece.kind === 'powerTower' || piece.kind === 'pool' ? 3 : piece.kind === 'cabin' || piece.kind === 'tower' ? Math.ceil(target * .23) : Math.ceil(target * .25);
        if (count >= cap || p.mask & used || p.forbidden.some(f => f.mask & (byKind[f.kind] ?? 0n))) return false;
        if (left - size < slots - 1 || left - size > (slots - 1) * 3) return false;
        return !CAMP_REQUIREMENTS[piece.kind] || p.connections.some(link => (link.camp & possibleCamps) && !(link.gap & (required | terrainMask)));
      });
      if (!valid.length) return false;
      if (!choices.length || valid.length < choices.length) choices = valid;
      if (choices.length === 1) break;
    }
    for (const e of choices) {
      const { piece, p } = e, previous = counts.get(piece.kind) ?? 0;
      entries.push({ piece: { ...piece, id: `wild-${entries.length}` }, p }); counts.set(piece.kind, previous + 1);
      if (search(used | p.mask, { ...byKind, [piece.kind]: (byKind[piece.kind] ?? 0n) | p.mask }, multi + (p.cells.length > 1 ? 1 : 0), area + p.cells.length)) return true;
      entries.pop(); counts.set(piece.kind, previous);
      if (nodes > 3000 || Date.now() >= deadline) return false;
    }
    return false;
  }
  let total = 0;
  for (const p of board) if (required & cellBit(p)) total++;
  return search(0n, {}, 0, 0) ? entries : undefined;
}
