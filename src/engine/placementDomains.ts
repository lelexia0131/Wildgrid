import { adjacent, occupied, offsets } from './boardGeometry';
import { campConnections, facilityConflict, terrainConflict } from './placementRules';
import type { Cell, FacilityKind, Level, Piece, Placement } from './types';

export type Position = { at: Placement; cells: Cell[]; mask: bigint; rows: number[]; cols: number[]; forbidden: { kind: FacilityKind; mask: bigint }[] };
export type Candidate = Position & { connections: { camp: bigint; gap: bigint }[] };
export const cellBit = (cell: Cell, size = 8) => 1n << BigInt(cell.r * size + cell.c);
const cache = new Map<string, Position[]>();
const kinds: FacilityKind[] = ['camp', 'fire', 'tower', 'picnic', 'cabin', 'foodTruck', 'powerTower', 'pool'];
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
      const forbidden = kinds.flatMap(kind => {
        const mask = board.reduce((m, p) => facilityConflict(piece.kind, cells, kind, [p]) ? m | cellBit(p, size) : m, 0n);
        return mask ? [{ kind, mask }] : [];
      });
      positions.push({ at, cells, rows, cols, forbidden, mask: cells.reduce((m, p) => m | cellBit(p, size), 0n) });
    }
  }
  cache.set(key, positions);
  return positions;
}

export function staticPositions(piece: Piece, level: Level): Position[] {
  const terrainMask = level.terrain.reduce((m, p) => m | cellBit(p, level.size), 0n);
  const need = piece.kind === 'camp' || piece.kind === 'pool' ? 'water' : piece.kind === 'cabin' ? 'forest' : piece.kind === 'tower' ? 'mountain' : undefined;
  return placementGeometry(piece, level.size).filter(p => !(p.mask & terrainMask)
    && !p.rows.some((v, i) => v > level.rows[i]) && !p.cols.some((v, i) => v > level.cols[i])
    && (!need || level.terrain.some(t => t.kind === need && p.cells.some(c => adjacent(c, t))))
    && !level.terrain.some(t => terrainConflict(piece.kind, p.cells, t)));
}

export type PlacementGroup = { piece: Piece; ids: string[]; domain: Candidate[] };
export function placementDomains(level: Level): PlacementGroup[] {
  const groups: PlacementGroup[] = [], board = boardCells(level.size);
  for (const piece of level.pieces) {
    const existing = groups.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    if (existing) { existing.ids.push(piece.id); continue; }
    groups.push({ piece, ids: [piece.id], domain: staticPositions(piece, level).map(p => ({ ...p,
      at: { ...p.at, id: piece.id },
      connections: campConnections(piece.kind, p.cells, board, level.terrain).map(link => ({ camp: cellBit(link.camp, level.size), gap: link.gap ? cellBit(link.gap, level.size) : 0n })),
    })) });
  }
  return groups;
}

export const compatible = (a: Candidate, kind: FacilityKind, b: Candidate) => !(a.mask & b.mask) && !a.forbidden.some(f => f.kind === kind && (f.mask & b.mask));
