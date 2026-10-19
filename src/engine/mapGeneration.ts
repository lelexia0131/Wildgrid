import { facilityLibrary } from './facilityRegistry';
import { CAMP_REQUIREMENTS, campConnections, evaluate, facilityConflict, terrainConflict } from './placementRules';
import { adjacent, key, occupied, offsets } from './boardGeometry';
import { withEditorPlacements, mapFingerprint } from './mapBlueprint';
import type { SandboxDraft } from './mapBlueprint';
import { solveLevel } from './solver';
import type { SolverResult } from './solver';
import { compareMaps, mapFeatures } from './mapNovelty';
import type { MapFeatures } from './mapNovelty';
import type { Cell, Piece, Placement, Terrain, TerrainKind } from './types';
import { facilityRestrictionError } from '../game-modes/survival/survivalFacilities';

export const MAP_GENERATION_TIMEOUT = 2000;
export class MapGenerationSearchError extends Error {}
export class MapGenerationConstraintError extends Error {}
export type MapGenerationSpec = { readonly min: number; readonly max: number; readonly multi: number };
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, value | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const board = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8 }));
type Position = { at: Placement; cells: Cell[] };
// Geometry is seed-independent and shared across construction attempts.
const domains = new Map(facilityLibrary.map(piece => {
  const seen = new Set<string>(), positions: Position[] = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    const signature = offsets(piece.shape, rotation).map(key).sort().join(';');
    if (seen.has(signature)) continue;
    seen.add(signature);
    for (const p of board) {
      const at = { ...p, rotation, id: '' }, cells = occupied(piece, at);
      if (cells.every(p => p.r < 8 && p.c < 8)) positions.push({ at, cells });
    }
  }
  return [`${piece.kind}_${piece.shape}`, positions];
}));

export function generationDifficulty(draft: SandboxDraft, solved: SolverResult) {
  const count = draft.level.pieces.length;
  const density = solved.occupied / 64;
  const facilityDensity = count / 64;
  const candidates = solved.candidates / count;
  const dependencies = draft.level.pieces.filter(p => CAMP_REQUIREMENTS[p.kind]).length / count;
  const forced = solved.forced / count;
  // Search contributes only a small term: domain ambiguity and relationships
  // describe reasoning better than raw implementation-dependent node counts.
  const search = Math.min(1, Math.log2(1 + solved.nodes) / 16) * .35 + Math.min(1, solved.branches / Math.max(1, solved.nodes)) * .15;
  const score = density * 3 + facilityDensity * .5 + Math.log2(1 + candidates) * .9 + dependencies * 2 + (1 - forced) + search;
  return { score, density, facilityDensity, candidates, dependencies, forced, nodes: solved.nodes, branches: solved.branches };
}

export function generateMap(difficulty: number, seed: number, id: string, recent: string[], spec: MapGenerationSpec, disabled: readonly string[] = [], history: readonly MapFeatures[] = []) {
  const restriction = facilityRestrictionError(difficulty, disabled);
  if (restriction) throw new MapGenerationConstraintError(restriction);
  const random = seeded(seed), pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  const allowed = facilityLibrary.filter(p => !disabled.includes(`${p.kind}_${p.shape}`));
  const requireSingleCamp = disabled.length === 0;
  const deadline = Date.now() + MAP_GENERATION_TIMEOUT - 100;
  const previous = history.filter(m => m.difficulty === difficulty).slice(-40);
  let best: { id: string; difficulty: number; seed: number; draft: SandboxDraft; fingerprint: string; metrics: ReturnType<typeof generationDifficulty> } | undefined;
  let bestNovelty = -1, qualified = 0;

  for (let attempt = 0; attempt < 160 && Date.now() < deadline; attempt++) {
    const target = spec.min + Math.floor(random() * (spec.max - spec.min + 1));
    // Independent per-kind weights allow whole categories to be absent and
    // multiple trucks/pools/towers without a fixed composition or template.
    const weights = new Map(allowed.map(p => [p.id, (p.kind === 'camp' ? 1.1 : p.kind === 'cabin' ? .7 : p.kind === 'tower' ? .8 : 1) * random() ** 1.5]));
    const weighted = (items: readonly Piece[]) => {
      let cursor = random() * items.reduce((s, p) => s + weights.get(p.id)!, 0);
      return items.find(p => (cursor -= weights.get(p.id)!) <= 0) || items[items.length - 1];
    };
    const pieces: Piece[] = [];
    const camps = allowed.filter(p => p.kind === 'camp');
    const capacity = (p: Piece) => {
      const count = pieces.filter(q => q.kind === p.kind).length;
      const cap = p.kind === 'camp' ? 4 : p.kind === 'cabin' ? 2 : p.kind === 'picnic' || p.kind === 'foodTruck' ? 3 : 4;
      return count < cap;
    };
    if (camps.length) pieces.push(weighted(requireSingleCamp ? camps.filter(p => p.shape === 'single') : camps));
    const multi = allowed.filter(p => p.shape !== 'single');
    const minMulti = multi.length ? Math.min(target - 1, spec.multi + Math.floor(random() * 3)) : 0;
    while (pieces.filter(p => p.shape !== 'single').length < minMulti) {
      const choices = multi.filter(capacity);
      if (!choices.length) break;
      pieces.push(weighted(choices));
    }
    const dependent = allowed.filter(p => CAMP_REQUIREMENTS[p.kind]);
    const dependencies = camps.length && dependent.length ? Math.floor(difficulty / 3) : 0;
    while (pieces.filter(p => CAMP_REQUIREMENTS[p.kind]).length < dependencies) {
      const choices = dependent.filter(capacity);
      if (!choices.length) break;
      pieces.push(weighted(choices));
    }
    while (pieces.length < target) {
      const singles = allowed.filter(p => p.shape === 'single');
      const choices = (singles.length ? singles : allowed).filter(capacity);
      // A restricted palette may legitimately need more copies of one kind.
      pieces.push(weighted(choices.length ? choices : singles.length ? singles : allowed));
    }
    const area = pieces.reduce((s, p) => s + offsets(p.shape, 0).length, 0);
    if (area > 44) continue;
    pieces.sort((a, b) => {
      const order = (p: Piece) => p.kind === 'camp' ? 0 : p.kind === 'pool' ? 1 : p.kind === 'foodTruck' ? 2 : p.kind === 'picnic' ? 3 : p.kind === 'fire' ? 4 : p.kind === 'cabin' ? 5 : 6;
      return order(a) - order(b);
    });
    const identified = pieces.map((p, i) => ({ ...p, id: `wild-${i}` }));
    const entries: { piece: Piece; at: Placement; cells: Cell[] }[] = [];
    let terrain: Terrain[] = [], nodes = 0;
    const used = () => entries.flatMap(e => e.cells);
    const supports = () => entries.every(e => !CAMP_REQUIREMENTS[e.piece.kind] || campConnections(e.piece.kind, e.cells, board, [...terrain, ...used()]).some(link => entries.some(camp => camp.piece.kind === 'camp' && camp.cells.some(p => key(p) === key(link.camp)))));
    function addTerrain(cell: Cell, kind: TerrainKind) {
      if (terrain.some(t => key(t) === key(cell)) || used().some(p => key(p) === key(cell)) || entries.some(e => terrainConflict(e.piece.kind, e.cells, { ...cell, kind }))) return false;
      terrain.push({ ...cell, kind });
      if (!supports()) { terrain.pop(); return false; }
      return true;
    }
    function construct(index: number): boolean {
      if (++nodes > 650 || Date.now() >= deadline) return false;
      if (index === identified.length) return true;
      const piece = identified[index];
      for (const position of shuffle(domains.get(`${piece.kind}_${piece.shape}`)!)) {
        const { cells } = position;
        if (cells.some(p => [...terrain, ...used()].some(q => key(p) === key(q)))) continue;
        if (entries.some(e => facilityConflict(piece.kind, cells, e.piece.kind, e.cells)) || terrain.some(t => terrainConflict(piece.kind, cells, t))) continue;
        const before = terrain.length;
        entries.push({ piece, at: { ...position.at, id: piece.id }, cells });
        const need: TerrainKind | undefined = piece.kind === 'camp' || piece.kind === 'pool' ? 'water' : piece.kind === 'cabin' ? 'forest' : piece.kind === 'tower' ? 'mountain' : undefined;
        let viable = supports();
        if (viable && need && !terrain.some(t => t.kind === need && cells.some(p => adjacent(p, t)))) {
          viable = shuffle(board.filter(p => cells.some(q => adjacent(p, q)))).some(p => addTerrain(p, need));
        }
        if (viable && construct(index + 1)) return true;
        entries.pop(); terrain = terrain.slice(0, before);
        if (nodes > 650 || Date.now() >= deadline) break;
      }
      return false;
    }
    if (!construct(0)) continue;
    // Continuous terrain parameters vary abundance and clustering independently.
    const terrainWeights = [random() + .1, random() ** 2 + .03, random() + .1];
    const terrainKinds: TerrainKind[] = ['water', 'forest', 'mountain'];
    const center = pick(board), clustering = random();
    const terrainTarget = difficulty < 4 ? 8 + Math.floor(random() * 14) : 64 - area;
    for (const cell of shuffle(board).sort((a, b) => clustering * (Math.abs(a.r - center.r) + Math.abs(a.c - center.c) - Math.abs(b.r - center.r) - Math.abs(b.c - center.c)))) {
      if (terrain.length >= Math.min(terrainTarget, 64 - area)) break;
      let cursor = random() * terrainWeights.reduce((s, n) => s + n, 0);
      const kind = terrainKinds.find((_, i) => (cursor -= terrainWeights[i]) <= 0)!;
      [kind, ...shuffle(terrainKinds.filter(k => k !== kind))].some(k => addTerrain(cell, k));
    }
    const build = (): SandboxDraft => withEditorPlacements({ level: { id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain: [...terrain], pieces: identified, rows: [], cols: [] }, placements: entries.map(e => e.at) }, entries.map(e => e.at));
    let draft = build();
    if (!evaluate(draft.level, draft.placements).won) continue;
    const maxTerrain = Math.min(64 - area, difficulty < 4 ? 28 : 64);
    for (let repair = 0; repair < 18 && Date.now() < deadline; repair++) {
      let solved = solveLevel(draft.level, 2, { deadline: Math.min(deadline, Date.now() + 800), maxNodes: 45000 });
      if (!solved.aborted && !solved.count) break;
      if (!solved.aborted && solved.count === 1) {
        // Open up the proven layout again: retain only removals for which the
        // formal solver finishes and still proves exactly one solution.
        const removeTarget = 4 + Math.floor(random() * 8);
        let removed = 0;
        for (const cell of shuffle(terrain)) {
          if (removed >= removeTarget || Date.now() + 400 >= deadline) break;
          const next = { ...draft, level: { ...draft.level, terrain: terrain.filter(t => key(t) !== key(cell)) } };
          if (!evaluate(next.level, next.placements).won) continue;
          const checked = solveLevel(next.level, 2, { deadline: Math.min(deadline, Date.now() + 400), maxNodes: 30000 });
          if (checked.aborted || checked.count !== 1) continue;
          terrain = [...next.level.terrain]; draft = next; solved = checked; removed++;
        }
        const metrics = generationDifficulty(draft, solved);
        const lower = 2.4 + difficulty * .20, upper = 6.0 + difficulty * .36;
        if (metrics.score < lower || metrics.score > upper || (difficulty >= 7 && (metrics.candidates < 3 || metrics.forced > .4))) break;
        const fingerprint = mapFingerprint(draft), features = mapFeatures(draft, difficulty);
        const comparisons = previous.map(old => compareMaps(features, old));
        if (recent.includes(fingerprint) || comparisons.some(c => c.equivalent || c.similarity > .88)) break;
        const novelty = 1 - Math.max(0, ...comparisons.map(c => c.similarity));
        qualified++;
        if (novelty > bestNovelty) { bestNovelty = novelty; best = { id, difficulty, seed, draft, fingerprint, metrics }; }
        // Select among several strict candidates, with a total attempt/time cap.
        if (qualified >= 3 || !previous.length) return best!;
        break;
      }
      const intended = new Set(used().map(key));
      const alternatives = shuffle(solved.solutions.flatMap(solution => solution.flatMap(at => occupied(identified.find(p => p.id === at.id)!, at))).filter(p => !intended.has(key(p))));
      if (solved.aborted && !alternatives.length) alternatives.push(...shuffle(board.filter(p => !intended.has(key(p)) && !terrain.some(t => key(t) === key(p)))));
      let repaired = false;
      for (const cell of terrain.length < maxTerrain ? alternatives : []) {
        if (shuffle(terrainKinds).some(kind => addTerrain(cell, kind))) { repaired = true; break; }
      }
      // Equal occupancy can still hide exchanges of different facility kinds.
      // Recolour/remove legal terrain to distinguish their actual rule domains.
      if (!repaired && !solved.aborted) {
        const alternative = solved.solutions.filter(solution => solution.some(at => {
          const piece = identified.find(p => p.id === at.id)!;
          const token = occupied(piece, at).map(key).sort().join(';');
          return !entries.some(e => e.piece.kind === piece.kind && e.piece.shape === piece.shape && e.cells.map(key).sort().join(';') === token);
        }));
        outer: for (const cell of shuffle(board.filter(p => !intended.has(key(p))))) for (const kind of shuffle([...terrainKinds, null])) {
          const nextTerrain = terrain.filter(t => key(t) !== key(cell));
          if (kind) nextTerrain.push({ ...cell, kind });
          if (nextTerrain.length > maxTerrain) continue;
          const level = { ...draft.level, terrain: nextTerrain };
          if (evaluate(level, draft.placements).won && alternative.some(solution => !evaluate(level, solution).won)) {
            terrain = nextTerrain; repaired = true; break outer;
          }
        }
      }
      if (!repaired) {
        // Change one legal facility in place when terrain alone cannot separate
        // interchangeable kinds. The palette and footprint constraints still hold.
        outer: for (const entry of shuffle(entries)) for (const template of shuffle(allowed.filter(p => p.shape === entry.piece.shape && p.kind !== entry.piece.kind))) {
          if (entry.piece.kind === 'camp' && entries.filter(e => e.piece.kind === 'camp').length === 1) continue;
          if (requireSingleCamp && entry.piece.kind === 'camp' && entry.piece.shape === 'single' && entries.filter(e => e.piece.kind === 'camp' && e.piece.shape === 'single').length === 1) continue;
          const index = identified.findIndex(p => p.id === entry.piece.id), before = identified[index];
          identified[index] = { ...template, id: before.id };
          const next = build();
          if (evaluate(next.level, next.placements).won) { entry.piece = identified[index]; repaired = true; break outer; }
          identified[index] = before;
        }
      }
      if (!repaired) break;
      draft = build();
    }
  }
  if (best) return best;
  throw new MapGenerationSearchError(disabled.length ? '当前禁用组合在预算内未找到此难度的唯一解地图，请调整禁用设施或重试。' : '本次未能在时限内找到合适的唯一解地图，请重试。');
}
