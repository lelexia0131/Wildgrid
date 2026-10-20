import { ACTIVITY_LIMITS, hasRoleSwap, tileFacilities } from './facilityConstruction';
import { facilityLibrary } from './facilityRegistry';
import { CAMP_REQUIREMENTS, evaluate, terrainConflict } from './placementRules';
import { adjacent } from './boardGeometry';
import { withEditorPlacements, mapFingerprint } from './mapBlueprint';
import type { SandboxDraft } from './mapBlueprint';
import { solveLevel } from './solver';
import type { SolverResult } from './solver';
import { reasonLevel } from './logicalSolver';
import { mapQuality, TERRAIN_LIMITS, terrainPlacementScores } from './mapQuality';
import { cellBit, compatible, placementDomains, domainsWithClues } from './placementDomains';
import type { PlacementGroup } from './placementDomains';
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
export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, value | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}

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

// Choose a small inventory independently of the reasoning tier. Frontier scores
// share the same component/window limits as final acceptance and refinement.
export function planTerrain(random: () => number, target: number, multi: number, allowed: readonly Piece[]) {
  const terrain: Terrain[] = [];
  const kinds: TerrainKind[]=['water','forest','mountain'];
  const caps:Record<TerrainKind,number>={...TERRAIN_LIMITS.counts};
  if(!allowed.some(p=>p.kind==='cabin')) caps.forest=random()<.5?0:2;
  else if(random()<TERRAIN_LIMITS.omitChance) caps.forest=0;
  if(!allowed.some(p=>p.kind==='tower')) caps.mountain=random()<.5?0:2;
  else if(random()<TERRAIN_LIMITS.omitChance) caps.mountain=0;
  const desired=random()<TERRAIN_LIMITS.specialChance?TERRAIN_LIMITS.normalMax+1:TERRAIN_LIMITS.min+Math.floor(random()*(TERRAIN_LIMITS.normalMax-TERRAIN_LIMITS.min+1));
  const budget=Math.min(desired,TERRAIN_LIMITS.max,caps.water+caps.forest+caps.mountain,64-target-multi*2-8);
  const reserve=budget>TERRAIN_LIMITS.min && random()<TERRAIN_LIMITS.reserveChance?TERRAIN_LIMITS.refinements:0;
  const counts:Record<TerrainKind,number>={water:1,forest:0,mountain:0};
  for(let i=1;i<budget-reserve;i++) {
    const available=kinds.filter(kind=>counts[kind]<caps[kind]);
    let cursor=random()*available.reduce((n,kind)=>n+(kind==='water'?.8:1)/(1+counts[kind]*.1),0);
    const kind=available.find(kind=>(cursor-=(kind==='water'?.8:1)/(1+counts[kind]*.1))<=0)??available[0];
    counts[kind]++;
  }
  const clustering=random()*TERRAIN_LIMITS.clusterBias.range+TERRAIN_LIMITS.clusterBias.min, mountainForestAffinity=random()*TERRAIN_LIMITS.mixedAffinity, jitter=TERRAIN_LIMITS.jitter.min+random()*TERRAIN_LIMITS.jitter.range;
  while(terrain.length<budget-reserve) {
    const pending=kinds.filter(kind=>counts[kind]>0), kind=pending[Math.floor(random()*pending.length)];
    const candidates=terrainPlacementScores(terrain,kind,budget).map(({cell,score})=>{
      const same=terrain.filter(t=>t.kind===kind && adjacent(t,cell)).length;
      const mixed=kind==='water'?0:terrain.filter(t=>t.kind!=='water' && t.kind!==kind && adjacent(t,cell)).length;
      return {cell,score:score+(same?clustering:0)+mixed*mountainForestAffinity+random()*jitter};
    }).sort((a,b)=>b.score-a.score);
    if(!candidates.length) return;
    terrain.push({...candidates[0].cell,kind}); counts[kind]--;
  }
  return {terrain,budget};
}

export function generateMap(difficulty: number, seed: number, id: string, recent: string[], spec: MapGenerationSpec, disabled: readonly string[] = [], history: readonly MapFeatures[] = [], budgetMs = generationBudget(difficulty)) {
  const restriction = facilityRestrictionError(difficulty, disabled);
  if (restriction) throw new MapGenerationConstraintError(restriction);
  const allowed = facilityLibrary.filter(p => !disabled.includes(`${p.kind}_${p.shape}`));
  const requireSingle = allowed.some(p => p.kind === 'camp' && p.shape === 'single');
  const minMultiSize = Math.min(...allowed.filter(p => p.shape !== 'single').map(p => p.shape === 'domino' ? 2 : 3));
  if (spec.multi && (!Number.isFinite(minMultiSize) || spec.min + spec.multi * (minMultiSize - 1) + 8 + 2 > 64 || (requireSingle && spec.multi >= spec.max))) throw new MapGenerationConstraintError('此设施组合无法满足设施数量、多格下限和单格营地要求。');
  const started = Date.now(), deadline = started + Math.min(generationBudget(difficulty), budgetMs), random = seeded(seed);
  const shuffle = <T,>(items: readonly T[]) => { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
  const previous = history.filter(m => m.difficulty === difficulty).slice(-40);
  const failures: Record<string, number> = {};
  const reject = (reason: string) => { failures[reason] = (failures[reason] ?? 0) + 1; };
  let attempts = 0, proofs = 0, logicChecks = 0;
  const candidates: { draft: SandboxDraft; quality: ReturnType<typeof mapQuality>; prepared: PlacementGroup[] }[] = [];
  for (; attempts < 1200 && Date.now() < deadline; attempts++) {
    const target = spec.min + Math.floor(random() ** 2 * (spec.max - spec.min + 1));
    const plan = planTerrain(random, target, spec.multi, allowed);
    if(!plan) { reject('terrain planning'); continue; }
    const {terrain,budget:terrainBudget}=plan;
    // Sparse terrain needs informative clue capacities, not more obstacles.
    // These seeded zero lines may be internal or peripheral; no grass is tiled.
    const lineCount=()=>ACTIVITY_LIMITS.minLines+Math.floor(random()*(ACTIVITY_LIMITS.maxLines-ACTIVITY_LIMITS.minLines+1));
    const activeRows=spec.multi>=ACTIVITY_LIMITS.minMulti?shuffle([0,1,2,3,4,5,6,7]).slice(0,lineCount()):[0,1,2,3,4,5,6,7];
    const activeCols=spec.multi>=ACTIVITY_LIMITS.minMulti?shuffle([0,1,2,3,4,5,6,7]).slice(0,activeRows.length===ACTIVITY_LIMITS.minLines?ACTIVITY_LIMITS.maxLines:lineCount()):[0,1,2,3,4,5,6,7];
    const level: Level = { id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain, pieces: allowed, rows: Array.from({length:8},(_,i)=>activeRows.includes(i)?8:0), cols: Array.from({length:8},(_,i)=>activeCols.includes(i)?8:0) };
    const groups = placementDomains(level);
    const spare = 64 - terrain.length - target - spec.multi * (Number.isFinite(minMultiSize) ? minMultiSize - 1 : 0);
    const grassReserve = Math.max(8, Math.min(12, spare - spec.multi - 4));
    const entries = tileFacilities(level, groups, target, spec.multi, grassReserve, random);
    if (!entries) { reject('combination layout'); continue; }
    const rows = Array<number>(8).fill(0), cols = Array<number>(8).fill(0);
    for (const e of entries) for (let i = 0; i < 8; i++) { rows[i] += e.p.rows[i]; cols[i] += e.p.cols[i]; }
    const clueLevel = { ...level, rows, cols }, roleDomains = domainsWithClues(groups, clueLevel);
    const used = entries.reduce((m, e) => m | e.p.mask, 0n);
    for (const entry of shuffle(entries)) {
      const choices = roleDomains.filter(g => g.piece.shape === entry.piece.shape && g.domain.some(p => p.mask === entry.p.mask)).sort((a, b) => {
        const cost = (g: typeof a) => g.domain.length / (1 + entries.filter(e => e.piece.kind === g.piece.kind && e.piece.shape === g.piece.shape).length);
        return cost(a) - cost(b);
      });
      for (const role of choices) {
        if (role.piece.kind === entry.piece.kind) break;
        if (requireSingle && entry.piece.kind === 'camp' && entry.piece.shape === 'single' && entries.filter(e => e.piece.kind === 'camp' && e.piece.shape === 'single').length === 1) continue;
        if (entries.filter(e => e.piece.kind === role.piece.kind).length >= Math.max(2, Math.ceil(target * .3))) continue;
        const position = role.domain.find(p => p.mask === entry.p.mask)!;
        if (entries.some(e => e !== entry && !compatible(position, e.piece.kind, e.p))) continue;
        const camps = entries.reduce((m, e) => (e === entry ? role.piece.kind : e.piece.kind) === 'camp' ? m | e.p.mask : m, 0n);
        if (entries.some(e => {
          const kind = e === entry ? role.piece.kind : e.piece.kind, p = e === entry ? position : e.p;
          return CAMP_REQUIREMENTS[kind] && !p.connections.some(link => (link.camp & camps) && !(link.gap & used));
        })) continue;
        entry.piece = { ...role.piece, id: entry.piece.id }; entry.p = position; break;
      }
    }
    const pieces = entries.map(e => e.piece), placements = entries.map(e => ({ ...e.p.at, id: e.piece.id }));
    let draft = withEditorPlacements({ level: { ...level, pieces }, placements }, placements);
    let prepared = domainsWithClues(groups, draft.level);
    // Refine a bounded frontier using geometry alone, before either solver runs.
    // Preserve all answer footprints and camp links, including empty truck gaps.
    const camps = entries.filter(e => e.piece.kind === 'camp').reduce((m, e) => m | e.p.mask, 0n);
    const growth = Math.max(0, Math.min(TERRAIN_LIMITS.refinements, terrainBudget - terrain.length, 64 - terrain.length - entries.reduce((s,e) => s+e.p.cells.length,0) - grassReserve));
    for (let step = 0; step < growth; step++) {
      const domains = prepared;
      const terrainMask = terrain.reduce((m,t) => m | cellBit(t),0n);
      let best: Terrain | undefined, bestScore = .1;
      for (const kind of ['water', 'forest', 'mountain'] as TerrainKind[]) {
        for (const {cell,score:distributionScore} of terrainPlacementScores(terrain,kind,terrainBudget)) {
          const bit=cellBit(cell);
          if(bit & used) continue;
          if(!terrain.some(t=>t.kind===kind && adjacent(t,cell))) continue;
          const added = { ...cell, kind };
          if (entries.some(e => terrainConflict(e.piece.kind, e.p.cells, added))) continue;
          if (entries.some(e => e.piece.kind === 'foodTruck' && !e.p.connections.some(link => (link.camp & camps) && !(link.gap & (used | terrainMask | bit))))) continue;
          let score = 0;
          for (const g of domains) for (const p of g.domain) {
            if (entries.some(e => e.piece.kind === g.piece.kind && e.piece.shape === g.piece.shape && e.p.mask === p.mask)) continue;
            if ((p.mask & bit) || terrainConflict(g.piece.kind, p.cells, added)) score += g.ids.length / Math.max(1,g.domain.length);
          }
          score += distributionScore*.02+random()*.02;
          if (score > bestScore) { bestScore = score; best = added; }
        }
      }
      if (!best) break;
      terrain.push(best); draft = { ...draft, level: { ...draft.level, terrain: [...terrain] } };
      prepared = placementDomains(draft.level);
    }
    const quality = mapQuality(draft, { disabled, requireSingle, min: spec.min, max: spec.max, multi: spec.multi });
    if (!quality.accepted || !evaluate(draft.level, placements).won) { reject('layout quality'); continue; }
    if (hasRoleSwap(entries, prepared)) { reject('role ambiguity'); continue; }
    candidates.push({draft, quality, prepared});
    // A fixed batch makes soft quality affect acceptance without time-based selection.
    if (candidates.length < 3) continue;
    const batch = candidates.splice(0).sort((a, b) => b.quality.score - a.quality.score);
    for (const candidate of batch) {
      const {draft, quality, prepared} = candidate, count = draft.level.pieces.length;
      logicChecks++;
      const logic = reasonLevel(draft.level, { deadline, maxAssumptions: difficulty <= 3 ? 0 : difficulty <= 6 ? 8 : 24, maxDepth: difficulty >= 7 ? 2 : 1 }, prepared);
      // Time exhaustion stops the entire run, never changes which candidate wins.
      if (logic.aborted) { reject('logic budget'); break; }
      if (!logic.solved) { reject('logic stalled'); continue; }
      const firstAssumption = logic.steps.findIndex(s => s.rule === 'assumption');
      const opening = firstAssumption < 0 ? logic.steps : logic.steps.slice(0,firstAssumption);
      if (!logic.initialForced && !opening.some(s => s.removed > 0)) { reject('no logical opening'); continue; }
      if (logic.initialForced / count > .65 || (difficulty >= 4 && logic.rounds < 2)) { reject('too immediate'); continue; }
      const preliminary = generationDifficulty(draft, { occupied: 0, candidates: 0, nodes: 0, branches: 0 }, logic);
      const lower = [1.3, 2.2, 2.7, 3.2, 3.6, 4, 4.2, 4.5, 4.8, 5.1][difficulty - 1];
      const upper = [3.9, 5.2, 6.2, 6.8, 7.5, 8.2, 9, 9.3, 9.6, 10][difficulty - 1];
      if (preliminary.score < lower || preliminary.score > upper || (difficulty >= 4 && preliminary.logic.relationships < 2)) { reject('reasoning tier'); continue; }
      const fingerprint = mapFingerprint(draft), features = mapFeatures(draft, difficulty);
      if (recent.includes(fingerprint) || previous.some(old => { const c = compareMaps(features, old); return c.equivalent || c.similarity > .88; })) { reject('recent similarity'); continue; }
      proofs++;
      const solved = solveLevel(draft.level, 2, { deadline, maxNodes: 16000 }, prepared);
      if (solved.aborted || solved.count !== 1) { reject(solved.aborted ? 'proof budget' : 'not unique'); continue; }
      if (Date.now() >= deadline) break;
      return { id, difficulty, seed, draft, fingerprint, metrics: generationDifficulty(draft, solved, logic),
        diagnostics: { elapsed: Date.now() - started, attempts: attempts + 1, proofs, logicChecks, failures, unique: true, quality, reasoning: logic } };
    }
  }
  const labels: Record<string, string> = { 'terrain planning': '地形规划不可行', 'combination layout': '设施组合不可行', 'layout quality': '布局质量或硬约束', 'role ambiguity': '设施角色存在等价交换', 'logic budget': '逻辑推演预算', 'logic stalled': '缺少可解释路径', 'no logical opening': '缺少局部推理入口', 'too immediate': '初始位置过于直接', 'recent similarity': '近期地图相似', 'proof budget': '唯一解证明未完成', 'not unique': '未证明唯一解', 'reasoning tier': '推理难度不符' };
  const reason = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${labels[name] ?? name} ${count}`).join(', ') || '计算预算已用完';
  throw new MapGenerationSearchError(`预算内未找到满足地形质量、逻辑路径和唯一解的地图（${attempts} 次构造；${reason}）。${disabled.length ? '当前禁用组合可能限制了可用依赖关系，请调整设施或重试。' : '请重试。'}`, { elapsed: Date.now() - started, attempts, proofs, logicChecks, failures });
}
