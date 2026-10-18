import type { Cell, FacilityKind, Issue, Level, Placement, Status, Terrain } from './types';
import { adjacent, key, occupied } from './boardGeometry';

export const CAMP_REQUIREMENTS: Partial<Record<FacilityKind, string>> = {
  fire: '篝火需要上下左右挨着营地', picnic: '野餐桌需要上下左右挨着营地',
  foodTruck: '餐车需要与营地上下左右间隔一格空草地', pool: '泳池周围八格内需要至少一个营地占用格',
};
const PICNIC_CONFLICT_MESSAGE = '野餐桌不能邻近篝火，包括斜角';
const TOWER_CONFLICT_MESSAGE = '瞭望塔之间不能相邻，包括斜角';
export function facilityConflict(kind: FacilityKind, cells: readonly Cell[], other: FacilityKind, otherCells: readonly Cell[]): string | null {
  const pair = [kind, other];
  if (pair.includes('powerTower') && pair.includes('fire') && cells.some(p => otherCells.some(q => adjacent(p, q, true)))) return '电塔不能邻近篝火，包括斜角';
  if (pair.includes('powerTower') && pair.includes('camp') && cells.some(p => otherCells.some(q => adjacent(p, q)))) return '电塔不能上下左右挨着营地';
  if (pair.includes('foodTruck') && pair.includes('camp') && cells.some(p => otherCells.some(q => adjacent(p, q)))) return '餐车不能上下左右直接挨着营地';
  if (pair.includes('picnic') && pair.includes('fire') && cells.some(p => otherCells.some(q => adjacent(p, q, true)))) return PICNIC_CONFLICT_MESSAGE;
  if (kind === 'tower' && other === 'tower' && cells.some(p => otherCells.some(q => adjacent(p, q, true)))) return TOWER_CONFLICT_MESSAGE;
  return null;
}
export function terrainConflict(kind: FacilityKind, cells: readonly Cell[], terrain: Terrain): string | null {
  if (kind === 'fire' && terrain.kind === 'forest' && cells.some(cell => adjacent(cell, terrain, true))) return '篝火不能邻近森林，包括斜角';
  if (kind === 'cabin' && terrain.kind === 'water' && cells.some(cell => adjacent(cell, terrain))) return '林间木屋不能上下左右挨着水';
  return null;
}
// Connections describe actual camp cells, including the empty gap for a truck.
// The evaluator and solver both use these same geometric relationships.
export function campConnections(kind: FacilityKind, cells: readonly Cell[], board: readonly Cell[], blocked: readonly Cell[]): { camp: Cell; gap?: Cell }[] {
  if (!CAMP_REQUIREMENTS[kind]) return [];
  return board.flatMap<{ camp: Cell; gap?: Cell }>(camp => {
    for (const cell of cells) {
      if (kind === 'foodTruck') {
        if ((cell.r === camp.r && Math.abs(cell.c - camp.c) === 2) || (cell.c === camp.c && Math.abs(cell.r - camp.r) === 2)) {
          const gap = { r: (cell.r + camp.r) / 2, c: (cell.c + camp.c) / 2 };
          if (!blocked.some(p => key(p) === key(gap))) return [{ camp, gap }];
        }
      } else if (adjacent(cell, camp, kind === 'pool')) return [{ camp }];
    }
    return [];
  });
}
export function placementBlock(level: Level, placements: readonly Placement[], candidate: Placement): string | null {
  const piece = level.pieces.find(p => p.id === candidate.id);
  if (!piece) return '未知设施';
  const cells = occupied(piece, candidate);
  if (cells.some(p => p.r < 0 || p.c < 0 || p.r >= level.size || p.c >= level.size)) return '这里放不下，试试旋转方向';
  if (cells.some(p => level.terrain.some(t => key(p) === key(t)))) return '固定地形上不能放置设施';
  const used = placements.filter(p => p.id !== candidate.id).flatMap(p => occupied(level.pieces.find(item => item.id === p.id)!, p));
  if (cells.some(p => used.some(t => key(p) === key(t)))) return '设施不能重叠';
  return null;
}
export function evaluate(level: Level, placements: readonly Placement[], options: { staticOnly?: boolean } = {}) {
  const rows = Array<number>(level.size).fill(0), cols = Array<number>(level.size).fill(0);
  const issues: Record<string, Issue> = {};
  const entries = placements.map(at => ({ at, piece: level.pieces.find(p => p.id === at.id)! })).filter(e => e.piece);
  const cells = entries.map(e => ({ ...e, cells: occupied(e.piece, e.at) }));
  const board = Array.from({ length: level.size ** 2 }, (_, i) => ({ r: Math.floor(i / level.size), c: i % level.size }));
  const blocked = [...level.terrain, ...cells.flatMap(e => e.cells)];
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
    if (CAMP_REQUIREMENTS[e.piece.kind]) {
      if (e.piece.kind === 'fire') {
        const conflict = level.terrain.map(terrain => terrainConflict(e.piece.kind, e.cells, terrain)).find(Boolean);
        if (conflict) reasons.push(conflict);
      }
      const connections = campConnections(e.piece.kind, e.cells, board, blocked);
      const connected = (footprint: readonly Cell[]) => connections.some(link => {
        const gap = link.gap ? key(link.gap) : null;
        return footprint.some(p => key(p) === key(link.camp)) && (!gap || !footprint.some(p => key(p) === gap));
      });
      if (!options.staticOnly && !cells.some(other => other.piece.kind === 'camp' && connected(other.cells))) {
        const remainingCamps = level.pieces.filter(p => p.kind === 'camp' && !placements.some(at => at.id === p.id));
        const canAddCamp = remainingCamps.some(camp => {
          for (let rotation = 0; rotation < 4; rotation++) for (let r = 0; r < level.size; r++) for (let c = 0; c < level.size; c++) {
            const at = { id: camp.id, r, c, rotation }, footprint = occupied(camp, at);
            if (!placementBlock(level, placements, at) && connected(footprint) && footprint.some(p => level.terrain.some(t => t.kind === 'water' && adjacent(p, t))) && !cells.some(other => facilityConflict('camp', footprint, other.piece.kind, other.cells))) return true;
          }
          return false;
        });
        if (canAddCamp) pending = true;
        else reasons.push(CAMP_REQUIREMENTS[e.piece.kind]!);
      }
    }
    if (e.piece.kind === 'pool' && !nearTerrain('water')) reasons.push('泳池需要上下左右挨着至少一格水源');
    let picnicBlocked = false, towerBlocked = false;
    if (!options.staticOnly) for (const other of cells) {
      if (other.at.id === e.at.id) continue;
      const conflict = facilityConflict(e.piece.kind, e.cells, other.piece.kind, other.cells);
      if (conflict === PICNIC_CONFLICT_MESSAGE) picnicBlocked = true;
      else if (conflict === TOWER_CONFLICT_MESSAGE) towerBlocked = true;
      else if (conflict && !reasons.includes(conflict)) reasons.push(conflict);
    }
    if (picnicBlocked) reasons.push(PICNIC_CONFLICT_MESSAGE);
    if (e.piece.kind === 'cabin') {
      if (!nearTerrain('forest')) reasons.push('林间木屋至少有一格需要上下左右挨着森林');
      const conflict = level.terrain.map(terrain => terrainConflict(e.piece.kind, e.cells, terrain)).find(Boolean);
      if (conflict) reasons.push(conflict);
    }
    if (e.piece.kind === 'tower') {
      if (!nearTerrain('mountain')) reasons.push('瞭望塔需要上下左右挨着山地');
      if (towerBlocked) reasons.push(TOWER_CONFLICT_MESSAGE);
    }
    if (e.cells.some(p => rows[p.r] > level.rows[p.r] || cols[p.c] > level.cols[p.c])) reasons.push('所在行或列的占格数超出提示');
    issues[e.at.id] = { status: reasons.length ? 'INVALID' : pending ? 'INCOMPLETE' : 'VALID', reasons: reasons.length ? reasons : pending ? [CAMP_REQUIREMENTS[e.piece.kind]!] : [] };
  }
  const allPlaced = placements.length === level.pieces.length && new Set(placements.map(p => p.id)).size === level.pieces.length && entries.length === placements.length;
  const won = allPlaced && Object.values(issues).every(i => i.status === 'VALID') && rows.every((n, i) => n === level.rows[i]) && cols.every((n, i) => n === level.cols[i]);
  const status: Status = Object.values(issues).some(i => i.status === 'INVALID') ? 'INVALID' : won ? 'VALID' : 'INCOMPLETE';
  return { rows, cols, issues, won, status };
}
