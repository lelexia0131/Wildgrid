import { offsets } from './boardGeometry';
import { facilityLibrary } from './facilityRegistry';
import { terrainRegistry } from './terrainRegistry';
import { prepareBudget } from './generationBudget';
import type { QuantityRange } from './generationBudget';
import type { Level } from './types';

// Source: supplied editable Excel, 设施与地形 B5:K18. Columns are difficulties 1–10.
// Sheet 1 row 21 and the requested area budgets supersede the old total counts.
const ranges = (values: readonly (number | readonly [number, number])[]): QuantityRange[] => values.map(v => typeof v === 'number' ? {min:v,max:v} : {min:v[0],max:v[1]});
export const generationQuantities: { facilities: Record<string, QuantityRange[]>; terrain: Record<string, QuantityRange[]> } = {
  facilities: {
    camp_single: ranges([[1,3],[2,3],[2,3],[1,4],[1,4],[2,4],[2,4],[2,4],[2,4],[1,5]]),
    camp_domino: ranges([[0,1],[0,1],[0,1],[1,2],[1,2],[1,2],[1,2],[1,3],[1,3],[2,3]]),
    camp_long: ranges([0,0,[0,1],[0,1],1,1,1,1,[1,2],[1,2]]),
    camp_el: ranges([0,0,0,0,[0,1],[0,1],1,1,1,[1,2]]),
    fire_single: ranges([[1,2],[2,3],[1,3],[1,3],[2,3],[2,3],[1,3],[1,3],[1,4],[2,4]]),
    tower_single: ranges([[0,1],[1,2],[2,3],[2,3],[2,4],[2,4],[2,4],[3,4],[3,4],[3,4]]),
    picnic_domino: ranges([0,0,[0,1],[0,1],1,[1,2],[1,2],[1,2],[1,2],[1,2]]),
    cabin_el: ranges([0,0,0,0,[0,1],[0,1],1,1,1,1]),
    foodTruck_single: ranges([0,0,0,[0,1],[0,1],1,[1,2],[1,2],[1,3],[1,3]]),
    powerTower_single: ranges([0,0,0,0,[0,1],1,1,[1,2],[1,2],[1,2]]),
    pool_single: ranges([0,0,[0,1],[0,1],[0,1],1,[1,2],[1,2],[1,3],[1,3]]),
  },
  terrain: {
    water: ranges([[2,3],[2,4],[2,4],[3,4],[3,5],[4,5],[4,5],[4,5],[3,5],[4,5]]),
    mountain: ranges([[0,2],[1,2],[1,3],[2,3],[2,3],[2,4],[2,4],[3,4],[3,5],[3,5]]),
    forest: ranges([[1,2],[1,3],[2,3],[2,3],[2,4],[3,4],[3,5],[3,5],[3,5],[3,6]]),
  },
};
export const templateId = (piece: Level['pieces'][number]) => `${piece.kind}_${piece.shape}`;

export function generationBudgets(difficulty: number, disabled: readonly string[] = [], config = generationQuantities) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 10) throw new Error('请选择 1难至10难');
  function items(definitions: readonly {id:string;area:number}[], quantities: Record<string, QuantityRange[]>) {
    for (const id of Object.keys(quantities)) if (!definitions.some(d => d.id === id)) throw new Error(`Unknown generation type: ${id}`);
    return definitions.map(d => {
      const values = quantities[d.id];
      if (!values || values.length !== 10) throw new Error(`Missing difficulty quantities: ${d.id}`);
      for (const v of values) if (!Number.isInteger(v.min) || !Number.isInteger(v.max) || v.min < 0 || v.max < v.min) throw new Error(`Invalid quantities: ${d.id}`);
      return {...d,...values[difficulty-1]};
    });
  }
  const facilities = items(facilityLibrary.map(p => ({id:p.id,area:offsets(p.shape,0).length})),config.facilities);
  for (const id of disabled) if (!facilityLibrary.some(p => p.id === id)) throw new Error(`Unknown disabled facility: ${id}`);
  return { facilities: prepareBudget(facilities.filter(p => !disabled.includes(p.id))),
    terrain: prepareBudget(items(terrainRegistry.map(t => ({id:t.id,area:t.cells.length})),config.terrain)) };
}

export function inventoryViolations(level: Level, difficulty: number, disabled: readonly string[] = []) {
  const budgets = generationBudgets(difficulty, disabled), violations: string[] = [];
  for (const [name, budget, ids] of [
    ['facility', budgets.facilities, level.pieces.map(templateId)],
    ['terrain', budgets.terrain, level.terrain.map(t => t.kind)],
  ] as const) {
    if (ids.some(id => !budget.items.some(i => i.id === id))) violations.push(`${name} unknown or disabled`);
    let area = 0;
    for (const item of budget.items) {
      // Terrain is stored as occupied cells, including future multi-cell units.
      const count = ids.filter(id => id === item.id).length / (name === 'terrain' ? item.area : 1);
      if (!Number.isInteger(count) || count < item.min || count > item.max) violations.push(`${name} range: ${item.id}`);
      area += count * item.area;
    }
    if (area < budget.min || area > budget.max) violations.push(`${name} budget`);
  }
  return violations;
}

// The existing save format does not store which templates were disabled.
// Present quantities and the terrain budget can still be checked exactly.
export function storedInventoryFits(level: Level, difficulty: number) {
  const budget=generationBudgets(difficulty);
  if(level.pieces.some(p=>!budget.facilities.items.some(i=>i.id===templateId(p)))) return false;
  for(const item of budget.facilities.items) {
    const count=level.pieces.filter(p=>templateId(p)===item.id).length;
    if(count && (count<item.min || count>item.max)) return false;
  }
  const area=level.pieces.reduce((n,p)=>n+offsets(p.shape,0).length,0);
  return area>0 && area<=budget.facilities.max && !inventoryViolations(level,difficulty).some(v=>v.startsWith('terrain'));
}
