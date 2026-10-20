import { adjacent, occupied, offsets } from './boardGeometry';
import { campConnections, facilityConflict, terrainConflict, TERRAIN_REQUIREMENTS } from './placementRules';
import { facilities } from './facilityRegistry';
import type { Cell, FacilityKind, Level, Piece, Placement } from './types';

export type Position = { at: Placement; cells: Cell[]; mask: bigint; rows: number[]; cols: number[]; forbidden: { kind: FacilityKind; mask: bigint }[]; connections: { camp: bigint; gap: bigint }[] };
export type Candidate = Position;
export const cellBit = (cell: Cell, size = 8) => 1n << BigInt(cell.r * size + cell.c);
const cache = new Map<string, Position[]>();
export const boardCells = (size: number) => Array.from({ length: size * size }, (_, i) => ({ r: Math.floor(i / size), c: i % size }));

// Shared immutable geometry: no terrain, IDs or seed-specific state is cached.
export function placementGeometry(piece: Piece, size: number): Position[] {
  const key = `${size}/${piece.kind}/${piece.shape}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const board = boardCells(size), seen = new Set<string>(), positions: Position[] = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    const signature = offsets(piece.shape, rotation).map(p => `${p.r},${p.c}`).sort().join(';');
    if (seen.has(signature)) continue;
    seen.add(signature);
    for (const origin of board) {
      const at = { ...origin, rotation, id: '' }, cells = occupied(piece, at);
      if (cells.some(p => p.r >= size || p.c >= size)) continue;
      const rows = Array<number>(size).fill(0), cols = Array<number>(size).fill(0);
      for (const cell of cells) { rows[cell.r]++; cols[cell.c]++; }
      const forbidden = facilities.flatMap(({kind}) => {
        const mask = board.reduce((m, p) => facilityConflict(piece.kind, cells, kind, [p]) ? m | cellBit(p, size) : m, 0n);
        return mask ? [{ kind, mask }] : [];
      });
      const connections = campConnections(piece.kind, cells, board, []).map(link => ({ camp: cellBit(link.camp, size), gap: link.gap ? cellBit(link.gap, size) : 0n }));
      positions.push({ at, cells, rows, cols, forbidden, connections, mask: cells.reduce((m, p) => m | cellBit(p, size), 0n) });
    }
  }
  cache.set(key, positions);
  return positions;
}

export function staticPositions(piece: Piece, level: Level): Position[] {
  const terrainMask = level.terrain.reduce((m, p) => m | cellBit(p, level.size), 0n);
  const need = TERRAIN_REQUIREMENTS[piece.kind];
  return placementGeometry(piece, level.size).filter(p => !(p.mask & terrainMask)
    && !p.rows.some((v, i) => v > level.rows[i]) && !p.cols.some((v, i) => v > level.cols[i])
    && (!need || level.terrain.some(t => t.kind === need && p.cells.some(c => adjacent(c, t))))
    && !level.terrain.some(t => terrainConflict(piece.kind, p.cells, t)));
}

export type PlacementGroup = { piece: Piece; ids: string[]; domain: Candidate[] };
export function placementDomains(level: Level): PlacementGroup[] {
  const groups: PlacementGroup[] = [];
  const terrainMask = level.terrain.reduce((m,p) => m | cellBit(p,level.size),0n);
  for (const piece of level.pieces) {
    const existing = groups.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    if (existing) { existing.ids.push(piece.id); continue; }
    groups.push({ piece, ids: [piece.id], domain: staticPositions(piece, level).map(p => ({ ...p,
      at: { ...p.at, id: piece.id },
      connections: p.connections.filter(link => !(link.gap & terrainMask)),
    })) });
  }
  return groups;
}

// Reuse terrain-specific geometry only for the same terrain and stricter clues.
// Rebind IDs after construction/role assignment; never cache mutable domains.
export function domainsWithClues(base: PlacementGroup[], level: Level): PlacementGroup[] {
  const groups: PlacementGroup[] = [];
  for (const piece of level.pieces) {
    const existing = groups.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    if (existing) { existing.ids.push(piece.id); continue; }
    const source = base.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    groups.push({ piece, ids: [piece.id], domain: (source?.domain ?? []).filter(p => !p.rows.some((v, i) => v > level.rows[i]) && !p.cols.some((v, i) => v > level.cols[i])).map(p => ({...p, at: {...p.at, id: piece.id}})) });
  }
  return groups;
}

export const compatible = (a: Candidate, kind: FacilityKind, b: Candidate) => !(a.mask & b.mask) && !a.forbidden.some(f => f.kind === kind && (f.mask & b.mask));
