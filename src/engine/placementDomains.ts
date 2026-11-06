import { adjacent, occupied, offsets, solverBoard, solverCell, fixedCells } from './boardGeometry';
import { campConnections, evaluate, facilityConflict, terrainConflict, TERRAIN_REQUIREMENTS } from './placementRules';
import { facilities } from './facilityRegistry';
import type { Cell, FacilityKind, Level, Piece, Placement } from './types';

export type Position = { at: Placement; cells: Cell[]; mask: bigint; rows: number[]; cols: number[]; forbidden: { kind: FacilityKind; mask: bigint }[]; connections: { camp: bigint; gap: bigint }[] };
export type Candidate = Position;
export const cellBit = (cell: Cell, size = 8) => 1n << BigInt(cell.r * size + cell.c);
const cache = new Map<string, Position[]>();
const terrainGeometry = new Map<string,{forbidden:bigint;required:bigint}>();
export const boardCells = (size: number) => Array.from({ length: size * size }, (_, i) => ({ r: Math.floor(i / size), c: i % size }));

// Shared immutable geometry: no terrain, IDs or seed-specific state is cached.
export function placementGeometry(piece: Piece, size: number, layered = false): Position[] {
  const key = `${size}/${piece.kind}/${piece.shape}/${layered}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const board = boardCells(size), seen = new Set<string>(), positions: Position[] = [], dimension = layered ? size * 2 : size;
  for (let rotation = 0; rotation < 4; rotation++) {
    const signature = offsets(piece.shape, rotation).map(p => `${p.r},${p.c}`).sort().join(';');
    if (seen.has(signature)) continue;
    seen.add(signature);
    for (const origin of board) {
      const at = { ...origin, rotation, id: '' }, footprint = occupied(piece, at);
      if (footprint.some(p => p.r >= size || p.c >= size)) continue;
      const cells = footprint.map(p => solverCell(p, piece.kind, size, layered));
      const rows = Array<number>(dimension).fill(0), cols = Array<number>(dimension).fill(0);
      for (const cell of cells) { rows[cell.r]++; cols[cell.c]++; }
      const forbidden = facilities.flatMap(({kind}) => {
        const mask = board.reduce((m, p) => facilityConflict(piece.kind, footprint, kind, [p]) ? m | cellBit(solverCell(p, kind, size, layered), dimension) : m, 0n);
        return mask ? [{ kind, mask }] : [];
      });
      const connections = campConnections(piece.kind, footprint, board, []).map(link => ({ camp: cellBit(link.camp, dimension), gap: link.gap ? cellBit(link.gap, dimension) : 0n }));
      positions.push({ at, cells, rows, cols, forbidden, connections, mask: cells.reduce((m, p) => m | cellBit(p, dimension), 0n) });
    }
  }
  cache.set(key, positions);
  return positions;
}

function terrainMasks(kind: FacilityKind, level: Level) {
  const need=TERRAIN_REQUIREMENTS[kind];
  let board: Cell[] | undefined;
  // Cache only immutable rule geometry for one terrain cell. A relocation or
  // type swap recombines these masks; clues and mutable domains are never cached.
  let forbidden=0n,required=0n;
  for(const t of level.terrain) {
    const key=`${level.size}/${kind}/${t.kind}/${t.r}/${t.c}`;
    let masks=terrainGeometry.get(key);
    if(!masks) {
      masks={forbidden:0n,required:0n};
      for(const p of board ??= boardCells(level.size)) {
        if((t.r===p.r && t.c===p.c) || terrainConflict(kind,[p],t)) masks.forbidden|=cellBit(p,level.size);
        if(t.kind===need && adjacent(p,t)) masks.required|=cellBit(p,level.size);
      }
      terrainGeometry.set(key,masks);
    }
    forbidden|=masks.forbidden;required|=masks.required;
  }
  return {forbidden,required:need?required:undefined};
}

function positionsWithTerrain(piece: Piece, level: Level, masks:ReturnType<typeof terrainMasks>):Position[] {
  return placementGeometry(piece, level.size).filter(p => !(p.mask & masks.forbidden)
    && !p.rows.some((v, i) => v > level.rows[i]) && !p.cols.some((v, i) => v > level.cols[i])
    && (masks.required===undefined || !!(p.mask&masks.required)));
}

export function staticPositions(piece: Piece, level: Level): Position[] {
  if (level.sky) return placementGeometry(piece, level.size, true).filter(p => evaluate(level, [{ ...p.at, id: piece.id }], { staticOnly: true }).status !== 'INVALID');
  return positionsWithTerrain(piece,level,terrainMasks(piece.kind,level));
}

export type PlacementGroup = { piece: Piece; ids: string[]; domain: Candidate[] };
export function placementDomains(level: Level): PlacementGroup[] {
  const groups: PlacementGroup[] = [];
  const constraints=new Map<FacilityKind,ReturnType<typeof terrainMasks>>();
  const terrainMask = fixedCells(level, 'ground').reduce((m,p) => m | cellBit(p,solverBoard(level).size),0n);
  for (const piece of level.pieces) {
    const existing = groups.find(g => g.piece.kind === piece.kind && g.piece.shape === piece.shape);
    if (existing) { existing.ids.push(piece.id); continue; }
    let masks=constraints.get(piece.kind);
    if(!masks) {masks=terrainMasks(piece.kind,level);constraints.set(piece.kind,masks);}
    groups.push({ piece, ids: [piece.id], domain: (level.sky ? staticPositions(piece, level) : positionsWithTerrain(piece, level,masks)).map(p => ({ ...p,
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
