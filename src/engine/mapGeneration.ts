import { tileFacilities } from './facilityConstruction';
import { facilityLibrary } from './facilityRegistry';
import { CAMP_REQUIREMENTS, evaluate, terrainConflict } from './placementRules';
import { adjacent, offsets } from './boardGeometry';
import { withEditorPlacements, mapFingerprint } from './mapBlueprint';
import type { SandboxDraft } from './mapBlueprint';
import { solveLevel } from './solver';
import type { SolverResult } from './solver';
import { reasonLevel } from './logicalSolver';
import { mapQuality } from './mapQuality';
import { boardCells, compatible, placementDomains } from './placementDomains';
import type { Candidate } from './placementDomains';
import { compareMaps, mapFeatures } from './mapNovelty';
import type { MapFeatures } from './mapNovelty';
import type { Level, Piece, Terrain, TerrainKind } from './types';
import { facilityRestrictionError } from '../game-modes/survival/survivalFacilities';

export const MAP_GENERATION_TIMEOUT = 8000;
export const generationBudget = (difficulty: number) => difficulty <= 3 ? 2800 : difficulty <= 6 ? 5000 : 7600;
export class MapGenerationSearchError extends Error {
  constructor(message: string, readonly diagnostics?: { elapsed: number; attempts: number; proofs: number; logicChecks: number; failures: Record<string, number> }) { super(message); }
}
export class MapGenerationConstraintError extends Error {}
export type MapGenerationSpec = { readonly min: number; readonly max: number; readonly multi: number };
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, value | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const board = boardCells(8);

export function generationDifficulty(draft: SandboxDraft, solved: Pick<SolverResult, 'occupied' | 'candidates' | 'nodes' | 'branches'>, logic = reasonLevel(draft.level, { maxAssumptions: 24, maxDepth: 2, deadline: Date.now() + 200 })) {
  const count = draft.level.pieces.length;
  const relationships = logic.steps.filter(s => s.rule === 'relationship' || s.rule === 'overlap').length;
  const techniques = new Set(logic.steps.map(s => s.rule)).size;
  const score = 1 + Math.min(4, logic.rounds * .28) + Math.min(2, relationships * .12) + Math.min(2, logic.steps.filter(s => s.rule === 'assumption').length * .3) + (techniques - 1) * .25;
  return { score, density: solved.occupied / 64, facilityDensity: count / 64, candidates: solved.candidates / count,
    dependencies: draft.level.pieces.filter(p => CAMP_REQUIREMENTS[p.kind]).length / count,
    forced: logic.initialForced / count, nodes: solved.nodes, branches: solved.branches,
    logic: { solved: logic.solved, rounds: logic.rounds, deductions: logic.deductions, assumptions: logic.assumptions, maxDepth: logic.maxDepth, techniques, relationships, initialForced: logic.initialForced },
  };
}

// Each region grows through its frontier. Abundance and compactness are
// independent of the reasoning tier; no later terrain repair fills the grass.
function planTerrain(random: () => number): Terrain[] {
  const terrain: Terrain[] = [], used = new Set<number>();
  const add = (r: number, c: number, kind: TerrainKind) => { const i = r * 8 + c; if (!used.has(i)) { used.add(i); terrain.push({r, c, kind}); } };
  const river: number[] = [];
  let row = 2 + Math.floor(random() * 3), bends = 0;
  for (let c = 0; c < 8; c++) {
    const next = Math.max(2, Math.min(4, row + (bends < 2 && random() < .28 ? (random() < .5 ? -1 : 1) : 0)));
    if (next !== row) bends++;
    for (let r = Math.min(row, next); r <= Math.max(row, next); r++) add(r, c, 'water');
    row = next; river.push(row);
  }
  const forestTarget = 7 + Math.floor(random() * 3);
  for (const kind of ['forest', 'mountain'] as TerrainKind[]) {
    const c = 2 + Math.floor(random() * 4), upper = kind === 'forest', end = upper ? 0 : 6;
    for (let r = river[c] + (upper ? -1 : 1); upper ? r >= end : r <= end; r += upper ? -1 : 1) add(r, c, kind);
    const target = upper ? forestTarget : 16 - forestTarget;
    while (terrain.filter(t => t.kind === kind).length < target) {
      const cells = terrain.filter(t => t.kind === kind);
      const frontier = board.filter(p => !used.has(p.r * 8 + p.c) && (upper ? p.r < river[p.c] : p.r > river[p.c] && p.r <= 6) && cells.some(q => Math.abs(p.r - q.r) + Math.abs(p.c - q.c) === 1));
      if (!frontier.length) break;
      const cell = frontier[Math.floor(random() * frontier.length)]; add(cell.r, cell.c, kind);
    }
  }
  const symmetry = Math.floor(random() * 8);
  return terrain.map(t => { let {r, c} = t; if (symmetry >= 4) c = 7 - c; for (let i = 0; i < symmetry % 4; i++) [r, c] = [c, 7-r]; return {r, c, kind:t.kind}; });
}

export function generateMap(difficulty: number, seed: number, id: string, recent: string[], spec: MapGenerationSpec, disabled: readonly string[] = [], history: readonly MapFeatures[] = [], budgetMs = generationBudget(difficulty)) {
  const restriction = facilityRestrictionError(difficulty, disabled);
  if (restriction) throw new MapGenerationConstraintError(restriction);
  const started = Date.now(), deadline = started + Math.min(generationBudget(difficulty), budgetMs), random = seeded(seed);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const shuffle = <T,>(items: readonly T[]) => { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
  const allowed = facilityLibrary.filter(p => !disabled.includes(`${p.kind}_${p.shape}`) && !(difficulty >= 7 && p.kind === 'camp' && p.shape === 'single' && facilityLibrary.some(q => q.kind === 'camp' && q.shape !== 'single' && !disabled.includes(`${q.kind}_${q.shape}`))));
  const previous = history.filter(m => m.difficulty === difficulty).slice(-40);
  const failures: Record<string, number> = {};
  const reject = (reason: string) => { failures[reason] = (failures[reason] ?? 0) + 1; };
  let attempts = 0, proofs = 0, logicChecks = 0;
  for (; attempts < 6000 && Date.now() < deadline; attempts++) {
    const terrain = planTerrain(random);
    if (terrain.length < 9) { reject('terrain'); continue; }
    const target = spec.min + Math.floor(random() ** 2 * (spec.max - spec.min + 1));
    const minMulti = spec.multi;
    const capacity = 64 - terrain.length;
    if (capacity < target + minMulti + 2) { reject('activity space'); continue; }
    const level: Level = { id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain, pieces: allowed, rows: Array(8).fill(8), cols: Array(8).fill(8) };
    const omitted = pick(['none', 'none', 'pool', 'powerTower']);
    const groups = difficulty >= 7 ? [] : placementDomains(level).filter(g => g.piece.kind !== omitted).map(g => ({ ...g, domain: shuffle(g.domain) })).filter(g => g.domain.length);
    const entries: { piece: Piece; p: Candidate }[] = [];
    const rows = Array(8).fill(0), cols = Array(8).fill(0);
    let nodes = 0;
    const layoutDeadline = Math.min(deadline, Date.now() + 18);
    function construct(used: bigint, campsMask: bigint, multi: number, area: number): boolean {
      if (++nodes > 240 || (nodes % 16 === 1 && Date.now() >= layoutDeadline)) return false;
      if (entries.length === target) return multi >= minMulti;
      const needMulti = minMulti - multi, slots = target - entries.length;
      const moves: { piece: Piece; valid: Candidate[]; weight: number }[] = [];
      for (const g of groups) {
        const piece = g.piece, size = offsets(piece.shape, 0).length;
        if (!entries.length && (piece.kind !== 'camp' || (!disabled.length && difficulty < 7 && piece.shape !== 'single'))) continue;
        if (entries.length && needMulti > 0 && size === 1) continue;
        if (entries.length && size > 1 && multi >= minMulti) continue;
        if (piece.kind === 'camp' && size > 1 && entries.filter(e => e.piece.kind === 'camp' && e.piece.shape !== 'single').length >= 3) continue;
        const count = entries.filter(e => e.piece.kind === piece.kind).length;
        const cap = piece.kind === 'camp' ? Math.max(2, Math.ceil(target * .27)) : piece.kind === 'powerTower' || piece.kind === 'pool' ? 2 : piece.kind === 'cabin' || piece.kind === 'tower' ? Math.max(2, Math.ceil(target * .2)) : Math.max(2, Math.ceil(target * .27));
        if (count >= cap || area + size + slots - 1 + Math.max(0, needMulti - (size > 1 ? 1 : 0)) > Math.min(capacity - 2, 56 - terrain.length)) continue;
        const valid = g.domain.filter(p => {
          if (p.mask & used || p.rows.some((v, r) => rows[r] + v > 7) || p.cols.some((v, c) => cols[c] + v > 7) || entries.some(e => !compatible(p, e.piece.kind, e.p))) return false;
          const next = used | p.mask;
          if (CAMP_REQUIREMENTS[piece.kind] && !p.connections.some(link => (link.camp & campsMask) && !(link.gap & next))) return false;
          return !entries.some(e => CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link => (link.camp & campsMask) && !(link.gap & next)));
        });
        if (valid.length) moves.push({ piece, valid, weight: (size > 1 && needMulti > 0 ? 3 : 1) * (count ? .7 : 1.5) / Math.sqrt(valid.length) });
      }
      // Roles are chosen from currently feasible domains. This composes new
      // neighborhoods, rather than forcing a preselected impossible inventory.
      while (moves.length) {
        let cursor = random() * moves.reduce((s, m) => s + m.weight, 0);
        const move = moves.find(m => (cursor -= m.weight) <= 0) ?? moves[0];
        moves.splice(moves.indexOf(move), 1);
        const size = offsets(move.piece.shape, 0).length, start = Math.floor(random() * move.valid.length);
        for (let i = 0; i < Math.min(5, move.valid.length); i++) {
          const p = move.valid[(start + i) % move.valid.length], piece = { ...move.piece, id: `wild-${entries.length}` };
          entries.push({ piece, p });
          for (let j = 0; j < 8; j++) { rows[j] += p.rows[j]; cols[j] += p.cols[j]; }
          if (construct(used | p.mask, piece.kind === 'camp' ? campsMask | p.mask : campsMask, multi + (size > 1 ? 1 : 0), area + size)) return true;
          for (let j = 0; j < 8; j++) { rows[j] -= p.rows[j]; cols[j] -= p.cols[j]; }
          entries.pop();
          if (nodes > 240 || Date.now() >= layoutDeadline) return false;
        }
      }
      return false;
    }
    if (difficulty >= 7) {
      const campShapes = allowed.filter(p => p.kind === 'camp');
      const campShape = (campShapes.find(p => p.shape === 'long') ?? campShapes.find(p => p.shape === 'el') ?? pick(campShapes)).shape;
      const focused = { ...level, pieces: allowed.filter(p => p.kind !== 'camp' || p.shape === campShape || !campShapes.some(q => q.shape === 'long')) };
      const tiled = tileFacilities(focused, target, spec.multi, random, Math.min(deadline, Date.now() + 35));
      if (tiled) entries.push(...tiled);
    }
    if (difficulty >= 7 ? !entries.length : !construct(0n, 0n, 0, 0)) { reject('combination layout'); continue; }
    // Assign the most informative legal rule role to each constructed footprint.
    // This is a single layout pass, before clues/proof, with no solver feedback.
    const clueLevel = { ...level, rows, cols };
    const roleDomains = difficulty >= 7 ? [] : placementDomains(clueLevel).filter(g => g.piece.kind !== omitted);
    const usedMask = entries.reduce((m, e) => m | e.p.mask, 0n);
    for (const entry of difficulty >= 7 ? [] : shuffle(entries)) {
      const choices = roleDomains.filter(g => g.piece.shape === entry.piece.shape && g.domain.some(p => p.mask === entry.p.mask)).sort((a, b) => {
        const cost = (g: typeof a) => g.domain.length / (1 + entries.filter(e => e.piece.kind === g.piece.kind && e.piece.shape === g.piece.shape).length);
        return cost(a) - cost(b);
      });
      for (const role of choices) {
        if (role.piece.kind === entry.piece.kind) break;
        if (!disabled.length && difficulty < 7 && entry.piece.kind === 'camp' && entry.piece.shape === 'single' && entries.filter(e => e.piece.kind === 'camp' && e.piece.shape === 'single').length === 1) continue;
        if (entries.filter(e => e.piece.kind === role.piece.kind).length >= (role.piece.kind === 'camp' ? Math.ceil(target * .3) : Math.max(2, Math.ceil(target * .27)))) continue;
        const position = role.domain.find(p => p.mask === entry.p.mask)!;
        if (entries.some(e => e !== entry && !compatible(position, e.piece.kind, e.p))) continue;
        const campMask = entries.reduce((m, e) => (e === entry ? role.piece.kind : e.piece.kind) === 'camp' ? m | e.p.mask : m, 0n);
        if (entries.some(e => {
          const kind = e === entry ? role.piece.kind : e.piece.kind, p = e === entry ? position : e.p;
          return CAMP_REQUIREMENTS[kind] && !p.connections.some(link => (link.camp & campMask) && !(link.gap & usedMask));
        })) continue;
        entry.piece = { ...role.piece, id: entry.piece.id }; entry.p = position; break;
      }
    }
    const pieces = entries.map(e => e.piece);
    const placements = entries.map(e => ({ ...e.p.at, id: e.piece.id }));
    let draft = withEditorPlacements({ level: { ...level, pieces }, placements }, placements);
    // One bounded shoreline/woodland/ridge adjustment, using domain geometry
    // only. Grow existing regions; never sprinkle isolated obstacles or consult
    // a solver for successive repairs.
    const intended = entries.reduce((m, e) => m | e.p.mask, 0n);
    const maxGrowth = Math.min(2 + Math.floor(random() * 5), 26 - terrain.length, 56 - terrain.length - entries.reduce((s, e) => s + e.p.cells.length, 0));
    const campMask = entries.filter(e => e.piece.kind === 'camp').reduce((m, e) => m | e.p.mask, 0n);
    let terrainMask = terrain.reduce((m, t) => m | (1n << BigInt(t.r * 8 + t.c)), 0n);
    for (let growth = 0; growth < maxGrowth && Date.now() < deadline; growth++) {
      const candidates = placementDomains(draft.level);
      let best: Terrain | undefined, bestScore = 0;
      for (const cell of board) {
        const bit = 1n << BigInt(cell.r * 8 + cell.c);
        if ((bit & intended) || terrain.some(t => t.r === cell.r && t.c === cell.c)) continue;
        for (const kind of ['water', 'forest', 'mountain'] as TerrainKind[]) {
          const neighbors = terrain.filter(t => t.kind === kind && adjacent(t, cell)).length;
          if (!neighbors) continue;
          const added = { ...cell, kind };
          if (entries.some(e => terrainConflict(e.piece.kind, e.p.cells, added))) continue;
          if (entries.some(e => e.piece.kind === 'foodTruck' && !e.p.connections.some(link => (link.camp & campMask) && !(link.gap & (intended | terrainMask | bit))))) continue;
          let score = 0;
          for (const g of candidates) for (const p of g.domain) {
            if (entries.some(e => e.piece.kind === g.piece.kind && e.piece.shape === g.piece.shape && e.p.mask === p.mask)) continue;
            if ((p.mask & bit) || terrainConflict(g.piece.kind, p.cells, added)) score += g.ids.length / Math.max(1, g.domain.length);
          }
          score += neighbors * .04 + random() * .03;
          if (score > bestScore) { bestScore = score; best = added; }
        }
      }
      if (!best || bestScore < .05) break;
      terrain.push(best); terrainMask |= 1n << BigInt(best.r * 8 + best.c); draft = { ...draft, level: { ...draft.level, terrain: [...terrain] } };
    }
    const quality = mapQuality(draft);
    if (!quality.accepted || !evaluate(draft.level, placements).won) { reject('layout quality'); continue; }
    logicChecks++;
    const logic = reasonLevel(draft.level, { deadline: Math.min(deadline, Date.now() + 45), maxAssumptions: difficulty <= 3 ? 0 : difficulty <= 6 ? 8 : 24, maxDepth: difficulty >= 7 ? 2 : 1 });
    if (!logic.solved || logic.aborted) { reject(logic.aborted ? 'logic budget' : 'logic stalled'); continue; }
    if (logic.initialForced / pieces.length > .65 || (difficulty >= 4 && logic.rounds < 2)) { reject('too immediate'); continue; }
    const preliminary = generationDifficulty(draft, { occupied: 0, candidates: 0, nodes: 0, branches: 0 }, logic);
    const lower = [1.3, 2.2, 2.7, 3.2, 3.6, 4, 4.2, 4.5, 4.8, 5.1][difficulty - 1];
    const upper = [3.9, 5.2, 6.2, 6.8, 7.5, 8.2, 9, 9.3, 9.6, 10][difficulty - 1];
    if (preliminary.score < lower || preliminary.score > upper || (difficulty >= 4 && preliminary.logic.relationships < 2)) { reject('reasoning tier'); continue; }
    const fingerprint = mapFingerprint(draft), features = mapFeatures(draft, difficulty);
    if (recent.includes(fingerprint) || previous.some(old => { const c = compareMaps(features, old); return c.equivalent || c.similarity > .88; })) { reject('recent similarity'); continue; }
    proofs++;
    const solved = solveLevel(draft.level, 2, { deadline: Math.min(deadline, Date.now() + 180), maxNodes: 16000 });
    if (solved.aborted || solved.count !== 1) { reject(solved.aborted ? 'proof budget' : 'not unique'); continue; }
    return { id, difficulty, seed, draft, fingerprint, metrics: generationDifficulty(draft, solved, logic),
      diagnostics: { elapsed: Date.now() - started, attempts: attempts + 1, proofs, logicChecks, failures, unique: true, quality, reasoning: logic } };
  }
  const labels: Record<string, string> = { 'terrain': '地形规划', 'activity space': '草地空间不足', 'combination layout': '设施组合不可行', 'layout quality': '布局质量', 'logic budget': '逻辑推演预算', 'logic stalled': '缺少可解释路径', 'too immediate': '初始位置过于直接', 'recent similarity': '近期地图相似', 'proof budget': '唯一解证明未完成', 'not unique': '未证明唯一解', 'reasoning tier': '推理难度不符' };
  const reason = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${labels[name] ?? name} ${count}`).join(', ') || '计算预算已用完';
  throw new MapGenerationSearchError(`预算内未找到满足地形质量、逻辑路径和唯一解的地图（${attempts} 次构造；${reason}）。${disabled.length ? '当前禁用组合可能限制了可用依赖关系，请调整设施或重试。' : '请重试。'}`, { elapsed: Date.now() - started, attempts, proofs, logicChecks, failures });
}
