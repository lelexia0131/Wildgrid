import { adjacent, occupied } from './boardGeometry';
import { campConnections, CAMP_REQUIREMENTS } from './placementRules';
import type { SandboxDraft } from './mapBlueprint';
import type { Cell } from './types';

type View = { terrain: string[]; answer: string[]; clues: number[] };
export type MapFeatures = { difficulty: number; terrainCounts: number[]; facilities: number[]; links: number[]; views: View[] };
const kinds = ['camp', 'fire', 'tower', 'picnic', 'cabin', 'foodTruck', 'powerTower', 'pool'];
const shapes = ['single', 'domino', 'long', 'el'];
export function mapFeatures(draft: SandboxDraft, difficulty: number): MapFeatures {
  const { level, placements } = draft, n = level.size;
  const entries = placements.map(at => ({ piece: level.pieces.find(p => p.id === at.id)!, cells: occupied(level.pieces.find(p => p.id === at.id)!, at) }));
  const board = Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n }));
  const blocked = [...level.terrain, ...entries.flatMap(e => e.cells)];
  const links = kinds.map(kind => entries.filter(e => e.piece.kind === kind).reduce((sum, e) => sum + entries.filter(other => {
    if (CAMP_REQUIREMENTS[e.piece.kind] && other.piece.kind === 'camp') return campConnections(e.piece.kind, e.cells, board, blocked).some(link => other.cells.some(p => p.r === link.camp.r && p.c === link.camp.c));
    return other !== e && e.cells.some(p => other.cells.some(q => adjacent(p, q)));
  }).length, 0));
  const views = Array.from({ length: 8 }, (_, symmetry) => {
    const point = (cell: Cell) => {
      let { r, c } = cell;
      if (symmetry >= 4) c = n - 1 - c;
      for (let turn = 0; turn < symmetry % 4; turn++) [r, c] = [c, n - 1 - r];
      return { r, c };
    };
    const rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
    const answer = entries.map(e => `${e.piece.kind}_${e.piece.shape}:${e.cells.map(point).map(p => { rows[p.r]++; cols[p.c]++; return p.r * n + p.c; }).sort((a, b) => a - b).join(',')}`).sort();
    return { terrain: level.terrain.map(t => { const p = point(t); return `${t.kind}:${p.r * n + p.c}`; }).sort(), answer, clues: [...rows, ...cols] };
  });
  return { difficulty, terrainCounts: ['water', 'forest', 'mountain'].map(kind => level.terrain.filter(t => t.kind === kind).length), facilities: kinds.flatMap(kind => shapes.map(shape => level.pieces.filter(p => p.kind === kind && p.shape === shape).length)), links, views };
}
const overlap = (a: string[], b: string[]) => { const set = new Set(b); return 2 * a.filter(v => set.has(v)).length / Math.max(1, a.length + b.length); };
const closeness = (a: number[], b: number[]) => 1 - a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / Math.max(1, a.reduce((s, v) => s + v, 0) + b.reduce((s, v) => s + v, 0));
function transformedViews(view: View): View[] {
  return Array.from({ length: 8 }, (_, symmetry) => {
    const point = (index: number) => {
      let r = Math.floor(index / 8), c = index % 8;
      if (symmetry >= 4) c = 7 - c;
      for (let i = 0; i < symmetry % 4; i++) [r, c] = [c, 7 - r];
      return r * 8 + c;
    };
    const rows = Array<number>(8).fill(0), cols = Array<number>(8).fill(0);
    const terrain = view.terrain.map(token => { const [kind, cell] = token.split(':'); return `${kind}:${point(Number(cell))}`; }).sort();
    const answer = view.answer.map(token => {
      const [kind, cells] = token.split(':');
      const transformed = cells.split(',').map(Number).map(point).sort((a, b) => a - b);
      for (const cell of transformed) { rows[Math.floor(cell / 8)]++; cols[cell % 8]++; }
      return `${kind}:${transformed.join(',')}`;
    }).sort();
    return { terrain, answer, clues: [...rows, ...cols] };
  });
}
export function compareMaps(a: MapFeatures, b: MapFeatures) {
  const views = a.views.length === 8 ? a.views : transformedViews(a.views[0]);
  const exact = JSON.stringify(a.views[0]) === JSON.stringify(b.views[0]);
  const equivalent = views.some(view => JSON.stringify(view) === JSON.stringify(b.views[0]));
  const shared = .13 * closeness(a.terrainCounts, b.terrainCounts) + .20 * closeness(a.facilities, b.facilities) + .10 * closeness(a.links, b.links);
  const similarity = Math.max(...views.map(view => shared + .25 * overlap(view.terrain, b.views[0].terrain) + .22 * overlap(view.answer, b.views[0].answer) + .10 * closeness(view.clues, b.views[0].clues)));
  return { exact, equivalent, similarity };
}
export function parseRecentMaps(value: unknown): MapFeatures[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is MapFeatures => !!v && Number.isInteger(v.difficulty) && v.difficulty >= 1 && v.difficulty <= 10 && [v.terrainCounts, v.facilities, v.links].every((a, i) => Array.isArray(a) && a.length === [3, 32, 8][i] && a.every(n => Number.isInteger(n) && n >= 0 && n <= 512)) && Array.isArray(v.views) && [1, 8].includes(v.views.length) && v.views.every((view: View) => view && [view.terrain, view.answer].every(a => Array.isArray(a) && a.length <= 64 && a.every(s => typeof s === 'string' && s.length <= 128 && /^[a-zA-Z]+(?:_(?:single|domino|long|el))?:[0-9]+(?:,[0-9]+){0,2}$/.test(s) && s.split(':')[1].split(',').every(n => Number(n) < 64))) && Array.isArray(view.clues) && view.clues.length === 16 && view.clues.every(n => Number.isInteger(n) && n >= 0 && n <= 8))).slice(-400).map(feature => ({ ...feature, views: [feature.views[0]] }));
}
