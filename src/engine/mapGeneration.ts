import { hasRoleSwap, refineFacilities, activityDomains } from './facilityConstruction';
import { facilityLibrary } from './facilityRegistry';
import { CAMP_REQUIREMENTS, evaluate } from './placementRules';
import { withEditorPlacements, mapFingerprint } from './mapBlueprint';
import type { SandboxDraft } from './mapBlueprint';
import { solveLevel } from './solver';
import type { SolverResult } from './solver';
import { reasonLevel, reasonedDomains } from './logicalSolver';
import { mapQuality } from './mapQuality';
import { generationBudgets, inventoryViolations, templateId } from './generationConfig';
import { terrainRegistry } from './terrainRegistry';
import { layoutTerrain } from './terrainLayout';
import { refineTerrain } from './generationRefinement';
import { placementDomains } from './placementDomains';
import type { PlacementGroup } from './placementDomains';
import { compareMaps, mapFeatures } from './mapNovelty';
import type { MapFeatures } from './mapNovelty';
import type { Level } from './types';
import { facilityRestrictionError } from '../game-modes/survival/survivalFacilities';
import { occupied } from './boardGeometry';

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

export function planTerrain(random: () => number, difficulty: number) {
  const allocation = generationBudgets(difficulty).terrain.sample(random);
  const terrain = layoutTerrain(random, allocation.counts, terrainRegistry, allocation.area);
  return terrain ? {terrain, budget:allocation.area, allocation} : undefined;
}

// Keep the adapter signature; legacy total-count specs no longer set inventory.
export function generateMap(difficulty: number, seed: number, id: string, recent: string[], _spec: MapGenerationSpec, disabled: readonly string[] = [], history: readonly MapFeatures[] = [], budgetMs = generationBudget(difficulty)) {
  const restriction = facilityRestrictionError(difficulty, disabled);
  if (restriction) throw new MapGenerationConstraintError(restriction);
  const allowed = facilityLibrary.filter(p => !disabled.includes(`${p.kind}_${p.shape}`));
  let budgets: ReturnType<typeof generationBudgets>;
  try { budgets = generationBudgets(difficulty, disabled); }
  catch (error) { throw new MapGenerationConstraintError(String(error)); }
  if (budgets.facilities.min + budgets.terrain.min + 8 > 64) throw new MapGenerationConstraintError('设施与地形最低预算超过可用棋盘空间。');
  const started = Date.now(), deadline = started + Math.min(generationBudget(difficulty), budgetMs), random = seeded(seed);
  const previous = history.filter(m => m.difficulty === difficulty).slice(-40);
  const failures: Record<string, number> = {};
  const reject = (reason: string) => { failures[reason] = (failures[reason] ?? 0) + 1; };
  let attempts = 0, proofs = 0, logicChecks = 0;
  const candidates: { draft: SandboxDraft; quality: ReturnType<typeof mapQuality>; prepared: PlacementGroup[]; allocation: ReturnType<typeof budgets.facilities.sample>; terrainAllocation: ReturnType<typeof budgets.terrain.sample> }[] = [];
  for (; attempts < 1200 && Date.now() < deadline; attempts++) {
    const allocation={counts:{} as Record<string,number>,area:budgets.facilities.chooseArea(()=>random()**2),target:budgets.facilities.target,min:budgets.facilities.min,max:budgets.facilities.max},terrainAllocation=budgets.terrain.sample(random);
    if (allocation.area + terrainAllocation.area + 8 > 64) { reject('board capacity'); continue; }
    const terrain = layoutTerrain(random,terrainAllocation.counts,terrainRegistry,terrainAllocation.area);
    if (!terrain) { reject('terrain planning'); continue; }
    const piecesToPlace = allowed.filter(p=>(budgets.facilities.items.find(i=>i.id===p.id)?.max??0)>0);
    // Sparse terrain needs informative clue capacities, not more obstacles.
    // These seeded zero lines may be internal or peripheral; no grass is tiled.
    const baseLevel: Level = { id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain, pieces: piecesToPlace, rows: Array<number>(8).fill(8), cols: Array<number>(8).fill(8) };
    const activity=activityDomains(baseLevel,placementDomains(baseLevel),budgets.facilities.items,allocation.area,random,deadline);
    if (!activity) { reject('combination layout'); continue; }
    const {level,groups,entries}=activity;
    for(const item of budgets.facilities.items) allocation.counts[item.id]=entries.filter(e=>templateId(e.piece)===item.id).length;
    refineFacilities(entries,groups,random,deadline);
    const pieces = entries.map(e => e.piece), placements = entries.map(e => ({ ...e.p.at, id: e.piece.id }));
    const initial = withEditorPlacements({ level: { ...level, pieces }, placements }, placements);
    const draft = {...initial,level:refineTerrain(initial.level,entries,random,deadline)};
    const prepared = placementDomains(draft.level);
    const quality = mapQuality(draft);
    if (!quality.accepted || quality.distribution.violations.length || inventoryViolations(draft.level,difficulty,disabled).length || !evaluate(draft.level, placements).won) { reject('layout quality'); continue; }
    if (hasRoleSwap(entries, prepared)) { reject('role ambiguity'); continue; }
    candidates.push({draft, quality, prepared, allocation, terrainAllocation});
    // A fixed batch makes soft quality affect acceptance without time-based selection.
    if (candidates.length < 3) continue;
    const batch = candidates.splice(0).sort((a, b) => b.quality.score - a.quality.score);
    for (const candidate of batch) {
      let {draft, quality, prepared} = candidate;
      const {allocation,terrainAllocation}=candidate, count = draft.level.pieces.length;
      logicChecks++;
      const logicBudget = { deadline, maxAssumptions: difficulty <= 3 ? 0 : difficulty <= 6 ? 8 : 64, maxDepth: difficulty >= 7 ? 2 : 1, maxUnresolved: difficulty>=7?96:32 };
      let logic = reasonLevel(draft.level, logicBudget, prepared);
      const excluded: (typeof draft.placements)[]=[];
      for(let refinement=0;!logic.solved && !logic.aborted && refinement<8 && Date.now()<deadline;refinement++) {
        const probe=solveLevel(draft.level,2,{deadline,maxNodes:2400},reasonedDomains(prepared,logic));
        if(probe.aborted || !probe.count) break;
        const signature=(placements:typeof draft.placements)=>placements.map(at=>{
          const piece=draft.level.pieces.find(p=>p.id===at.id)!;
          return templateId(piece)+':'+occupied(piece,at).map(p=>p.r*8+p.c).sort((a,b)=>a-b).join(',');
        }).sort().join(';');
        const answer=signature(draft.placements),witnesses=probe.solutions.filter(p=>signature(p)!==answer);
        if(!witnesses.length) break;
        excluded.push(...witnesses);
        const entries=draft.placements.map(at=>{const piece=draft.level.pieces.find(p=>p.id===at.id)!;return {piece,p:prepared.find(g=>templateId(g.piece)===templateId(piece))!.domain.find(p=>p.mask===occupied(piece,at).reduce((m,c)=>m|(1n<<BigInt(c.r*8+c.c)),0n))!};});
        const next=refineTerrain(draft.level,entries,random,deadline,excluded);
        if(next===draft.level) break;
        draft={...draft,level:next};prepared=placementDomains(next);quality=mapQuality(draft);
        logicChecks++;logic=reasonLevel(next,logicBudget,prepared);
      }
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
      const solved = solveLevel(draft.level, 2, { deadline, maxNodes: 16000 }, reasonedDomains(prepared,logic));
      if (solved.aborted || solved.count !== 1) { reject(solved.aborted ? 'proof budget' : 'not unique'); continue; }
      if (Date.now() >= deadline) break;
      return { id, difficulty, seed, draft, fingerprint, metrics: generationDifficulty(draft, solved, logic),
        diagnostics: { elapsed: Date.now() - started, attempts: attempts + 1, proofs, logicChecks, failures, unique: true, quality, inventory: {facilities:allocation, terrain:terrainAllocation}, reasoning: logic } };
    }
  }
  const labels: Record<string, string> = { 'terrain planning': '地形规划不可行', 'combination layout': '设施组合不可行', 'layout quality': '布局质量或硬约束', 'role ambiguity': '设施角色存在等价交换', 'logic budget': '逻辑推演预算', 'logic stalled': '缺少可解释路径', 'no logical opening': '缺少局部推理入口', 'too immediate': '初始位置过于直接', 'recent similarity': '近期地图相似', 'proof budget': '唯一解证明未完成', 'not unique': '未证明唯一解', 'reasoning tier': '推理难度不符' };
  const reason = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${labels[name] ?? name} ${count}`).join(', ') || '计算预算已用完';
  throw new MapGenerationSearchError(`预算内未找到满足地形质量、逻辑路径和唯一解的地图（${attempts} 次构造；${reason}）。${disabled.length ? '当前禁用组合可能限制了可用依赖关系，请调整设施或重试。' : '请重试。'}`, { elapsed: Date.now() - started, attempts, proofs, logicChecks, failures });
}
