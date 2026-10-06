import type { Cell, Issue, Level, Piece, Placement, Shape, Status } from './types';

const shapes: Record<Shape, Cell[]> = {
  single: [{ r: 0, c: 0 }], domino: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
  long: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
  el: [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
};
export const key = (cell: Cell) => `${cell.r},${cell.c}`;
export const adjacent = (a: Cell, b: Cell, diagonal = false) => diagonal
  ? Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1
  : Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
export function offsets(shape: Shape, rotation: number): Cell[] {
  let cells = shapes[shape];
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) cells = cells.map(({ r, c }) => ({ r: c, c: -r }));
  const minR = Math.min(...cells.map(p => p.r)), minC = Math.min(...cells.map(p => p.c));
  return cells.map(({ r, c }) => ({ r: r - minR, c: c - minC }));
}
export const occupied = (piece: Piece, at: Placement) => offsets(piece.shape, at.rotation).map(p => ({ r: p.r + at.r, c: p.c + at.c }));
export function rotateAround(piece: Piece, at: Placement, pivot: Cell): Placement {
  const cells = occupied(piece, at).map(p => ({ r: pivot.r + p.c - pivot.c, c: pivot.c - p.r + pivot.r }));
  return { id: at.id, rotation: (at.rotation + 1) % 4, r: Math.min(...cells.map(p => p.r)), c: Math.min(...cells.map(p => p.c)) };
}
export function placementBlock(level: Level, placements: Placement[], candidate: Placement): string | null {
  const piece = level.pieces.find(p => p.id === candidate.id);
  if (!piece) return '未知设施';
  const cells = occupied(piece, candidate);
  if (cells.some(p => p.r < 0 || p.c < 0 || p.r >= level.size || p.c >= level.size)) return '这里放不下，试试旋转方向';
  if (cells.some(p => level.terrain.some(t => key(p) === key(t)))) return '固定地形上不能放置设施';
  const used = placements.filter(p => p.id !== candidate.id).flatMap(p => occupied(level.pieces.find(item => item.id === p.id)!, p));
  if (cells.some(p => used.some(t => key(p) === key(t)))) return '设施不能重叠';
  return null;
}
export function evaluate(level: Level, placements: Placement[]) {
  const rows = Array<number>(level.size).fill(0), cols = Array<number>(level.size).fill(0);
  const issues: Record<string, Issue> = {};
  const entries = placements.map(at => ({ at, piece: level.pieces.find(p => p.id === at.id)! })).filter(e => e.piece);
  const cells = entries.map(e => ({ ...e, cells: occupied(e.piece, e.at) }));
  for (const e of cells) for (const p of e.cells) {
    if (p.r >= 0 && p.r < level.size && p.c >= 0 && p.c < level.size) { rows[p.r]++; cols[p.c]++; }
  }
  for (const e of cells) {
    const reasons: string[] = [];
    let pending = false;
    const block = placementBlock(level, placements, e.at);
    if (block) reasons.push(block);
    const nearTerrain = (kind: string, diagonal = false) => e.cells.some(p => level.terrain.some(t => t.kind === kind && adjacent(p, t, diagonal)));
    if (e.piece.kind === 'camp' && !nearTerrain('water')) reasons.push('营地至少有一格需要上下左右挨着水');
    if (e.piece.kind === 'fire' || e.piece.kind === 'picnic') {
      if (e.piece.kind === 'fire' && nearTerrain('forest', true)) reasons.push('篝火不能邻近森林，包括斜角');
      if (!cells.some(other => other.piece.kind === 'camp' && other.cells.some(p => e.cells.some(q => adjacent(p, q))))) {
        const remainingCamps = level.pieces.filter(p => p.kind === 'camp' && !placements.some(at => at.id === p.id));
        const canAddCamp = remainingCamps.some(camp => {
          for (let rotation = 0; rotation < 4; rotation++) for (let r = 0; r < level.size; r++) for (let c = 0; c < level.size; c++) {
            const at = { id: camp.id, r, c, rotation }, footprint = occupied(camp, at);
            if (!placementBlock(level, placements, at) && footprint.some(p => e.cells.some(q => adjacent(p, q))) && footprint.some(p => level.terrain.some(t => t.kind === 'water' && adjacent(p, t)))) return true;
          }
          return false;
        });
        if (canAddCamp) pending = true;
        else reasons.push(`${e.piece.kind === 'fire' ? '篝火' : '野餐桌'}需要上下左右挨着营地`);
      }
    }
    if (e.piece.kind === 'picnic' || e.piece.kind === 'fire') {
      const otherKind = e.piece.kind === 'picnic' ? 'fire' : 'picnic';
      if (cells.some(other => other.piece.kind === otherKind && e.cells.some(p => other.cells.some(q => adjacent(p, q, true))))) reasons.push('野餐桌不能邻近篝火，包括斜角');
    }
    if (e.piece.kind === 'cabin') {
      if (!nearTerrain('forest')) reasons.push('林间木屋至少有一格需要上下左右挨着森林');
      if (nearTerrain('water')) reasons.push('林间木屋不能上下左右挨着水');
    }
    if (e.piece.kind === 'tower') {
      if (!nearTerrain('mountain')) reasons.push('瞭望塔需要上下左右挨着山地');
      if (cells.some(other => other.piece.kind === 'tower' && other.at.id !== e.at.id && e.cells.some(p => other.cells.some(q => adjacent(p, q, true))))) reasons.push('瞭望塔之间不能相邻，包括斜角');
    }
    if (e.cells.some(p => rows[p.r] > level.rows[p.r] || cols[p.c] > level.cols[p.c])) reasons.push('所在行或列的占格数超出提示');
    issues[e.at.id] = { status: reasons.length ? 'INVALID' : pending ? 'INCOMPLETE' : 'VALID', reasons: reasons.length ? reasons : pending ? ['等待上下左右挨着的营地'] : [] };
  }
  const allPlaced = placements.length === level.pieces.length && new Set(placements.map(p => p.id)).size === level.pieces.length && entries.length === placements.length;
  const won = allPlaced && Object.values(issues).every(i => i.status === 'VALID') && rows.every((n, i) => n === level.rows[i]) && cols.every((n, i) => n === level.cols[i]);
  const status: Status = Object.values(issues).some(i => i.status === 'INVALID') ? 'INVALID' : won ? 'VALID' : 'INCOMPLETE';
  return { rows, cols, issues, won, status };
}
