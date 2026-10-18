import type { Cell, Piece, Placement, Shape } from './types';

const SHAPE_CELLS: Record<Shape, Cell[]> = {
  single: [{ r: 0, c: 0 }], domino: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
  long: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
  el: [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
};
export const key = (cell: Cell) => `${cell.r},${cell.c}`;
export const adjacent = (a: Cell, b: Cell, diagonal = false) => diagonal
  ? Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1
  : Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
export function offsets(shape: Shape, rotation: number): Cell[] {
  let cells = SHAPE_CELLS[shape];
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) cells = cells.map(({ r, c }) => ({ r: c, c: -r }));
  const minR = Math.min(...cells.map(p => p.r)), minC = Math.min(...cells.map(p => p.c));
  return cells.map(({ r, c }) => ({ r: r - minR, c: c - minC }));
}
export const occupied = (piece: Piece, at: Placement) => offsets(piece.shape, at.rotation).map(p => ({ r: p.r + at.r, c: p.c + at.c }));
// Convert the pointer's occupied top-row cell to the stored bounding-box origin.
export function placementOrigin(shape: Shape, rotation: number, cell: Cell): Cell {
  const anchorC = Math.min(...offsets(shape, rotation).filter(p => p.r === 0).map(p => p.c));
  return { r: cell.r, c: cell.c - anchorC };
}
export function rotateAround(piece: Piece, at: Placement, pivot: Cell): Placement {
  const cells = occupied(piece, at).map(p => ({ r: pivot.r + p.c - pivot.c, c: pivot.c - p.r + pivot.r }));
  return { id: at.id, rotation: (at.rotation + 1) % 4, r: Math.min(...cells.map(p => p.r)), c: Math.min(...cells.map(p => p.c)) };
}
