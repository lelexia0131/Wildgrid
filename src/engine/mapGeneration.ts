import { hasRoleSwap, repartitionCount, refineFacilities, activityDomains, ACTIVITY_LIMITS } from './facilityConstruction';
import { facilityLibrary } from './facilityRegistry';
import { CAMP_REQUIREMENTS, evaluate } from './placementRules';
import { withEditorPlacements, mapFingerprint } from './mapBlueprint';
import type { SandboxDraft } from './mapBlueprint';
import { solveLevel } from './solver';
import type { SolverResult } from './solver';
import { reasonLevel, reasonedDomains } from './logicalSolver';
import { mapQuality } from './mapQuality';
import { facilityRestrictionError, generationBudgets, inventoryViolations, templateId, MAX_GENERATED_LINE_OCCUPANCY, MAX_GENERATED_FACILITIES, MAX_GENERATED_EMPTY_LINES } from './generationConfig';
import { terrainRegistry } from './terrainRegistry';
import { activityRectangles, layoutTerrain } from './terrainLayout';
import { coordinateGenerationBudget } from './generationBudget';
import { refineTerrain, refineLogicalLayout } from './generationRefinement';
import { placementDomains } from './placementDomains';
import type { LogicResult } from './logicalSolver';
import { compareMaps, mapFeatures } from './mapNovelty';
import type { MapFeatures } from './mapNovelty';
import type { Level } from './types';
import { occupied } from './boardGeometry';

export const MAP_GENERATION_TIMEOUT = 8000;
export const generationBudget = (difficulty: number) => difficulty <= 3 ? 2800 : difficulty <= 6 ? 5000 : 7600;
export class MapGenerationSearchError extends Error {
  constructor(message: string, readonly diagnostics?: { elapsed: number; attempts: number; proofs: number; logicChecks: number; failures: Record<string, number>; phases: Record<string, {calls:number;ms:number}>; construction: Record<string,number>; candidatesGenerated?:number; candidatesValidated?:number; proofExhaustions?:number; cutoffs?:Record<string,number>; timeDependent?:boolean }) { super(message); }
}
export class MapGenerationConstraintError extends Error {}
export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, value | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export const nextGenerationSeed = (seed: number) => Math.floor(seeded(seed)() * 0x100000000);

export const generationReasoningBudget = (difficulty: number) => ({ maxAssumptions: difficulty <= 3 ? 0 : difficulty <= 6 ? 8 : 64, maxDepth: difficulty >= 7 ? 2 : 1, maxUnresolved: difficulty >= 7 ? 96 : 32 });

export function generationDifficulty(draft: SandboxDraft, solved: Pick<SolverResult, 'occupied' | 'candidates' | 'nodes' | 'branches'>, logic?: LogicResult, difficulty = 10) {
  const policy = generationReasoningBudget(difficulty);
  logic ??= reasonLevel(draft.level, { ...policy, deadline: Date.now() + generationBudget(difficulty) });
  const count = draft.level.pieces.length;
  const relationships = logic.steps.filter(s => s.rule === 'relationship' || s.rule === 'overlap').length;
  const techniques = new Set(logic.steps.map(s => s.rule)).size;
  const score = Math.min(10, 1 + Math.min(4, logic.rounds * .28) + Math.min(2, relationships * .12) + Math.min(2, logic.steps.filter(s => s.rule === 'assumption').length * .3) + (techniques - 1) * .25);
  const reasoningStatus = logic.contradiction ? 'contradiction' : logic.aborted || !logic.solved && policy.maxAssumptions > 0 && logic.assumptions >= policy.maxAssumptions ? 'budget-exhausted' : logic.solved ? 'solved' : 'stalled';
  const firstAssumption = logic.steps.findIndex(s => s.rule === 'assumption');
  const opening = firstAssumption < 0 ? logic.steps : logic.steps.slice(0, firstAssumption);
  const lower = [1.3, 2.2, 2.7, 3.2, 3.6, 4, 4.2, 4.5, 4.8, 5.1][difficulty - 1];
  const upper = [3.9, 5.2, 6.2, 6.8, 7.5, 8.2, 9, 9.3, 9.6, 10][difficulty - 1];
  const rejection = reasoningStatus === 'budget-exhausted' ? 'logic budget' : logic.contradiction ? 'logic contradiction' : !logic.solved ? 'logic stalled'
    : !logic.initialForced && !opening.some(s => s.removed > 0) ? 'no logical opening'
    : logic.initialForced / count > .65 || difficulty >= 4 && logic.rounds < 2 ? 'too immediate'
    : score < lower ? 'reasoning tier low' : score > upper ? 'reasoning tier high'
    : difficulty >= 4 && relationships < 2 ? 'reasoning relationships' : null;
  return { status: rejection === 'logic budget' ? 'budget-exhausted' as const : rejection ? 'rejected' as const : 'accepted' as const, rejection,
    score, density: solved.occupied / 64, facilityDensity: count / 64, candidates: solved.candidates / count,
    dependencies: draft.level.pieces.filter(p => CAMP_REQUIREMENTS[p.kind]).length / count,
    forced: logic.initialForced / count, nodes: solved.nodes, branches: solved.branches,
    logic: { status: reasoningStatus,
      solved: logic.solved, rounds: logic.rounds, deductions: logic.deductions, assumptions: logic.assumptions, maxDepth: logic.maxDepth, techniques, relationships, initialForced: logic.initialForced },
  };
}

export function planTerrain(random: () => number, difficulty: number) {
  const allocation = generationBudgets(difficulty).terrain.sample(random);
  const terrain = layoutTerrain(random, allocation.counts, terrainRegistry, allocation.area);
  return terrain ? {terrain, budget:allocation.area, allocation} : undefined;
}

// Look ahead by at most two construction attempts, never by a required number
// of successful candidates. Flush even one pending candidate before stopping.
export function* generationCandidateBatches<T>(construct:()=>T|undefined, canConstruct:()=>boolean, urgent:()=>boolean) {
  let pending:T[]=[],lookahead=0;
  while(canConstruct() || pending.length) {
    if(pending.length && (lookahead>=2 || !canConstruct() || urgent())) {
      yield pending;pending=[];lookahead=0;continue;
    }
    if(pending.length) lookahead++;
    const candidate=construct();
    if(candidate) pending.push(candidate);
  }
}

export function generateMap(difficulty: number, seed: number, id: string, recent: string[], disabled: readonly string[] = [], history: readonly MapFeatures[] = [], budgetMs = generationBudget(difficulty)) {
  const restriction = facilityRestrictionError(difficulty, disabled);
  if (restriction) throw new MapGenerationConstraintError(restriction);
  const allowed = facilityLibrary.filter(p => !disabled.includes(`${p.kind}_${p.shape}`));
  let budgets: ReturnType<typeof generationBudgets>;
  try { budgets = generationBudgets(difficulty, disabled); }
  catch (error) { throw new MapGenerationConstraintError(String(error)); }
  if (budgets.facilities.min + budgets.terrain.min + 8 > 64) throw new MapGenerationConstraintError('设施与地形最低预算超过可用棋盘空间。');
  const started = Date.now(), budget = coordinateGenerationBudget(started, Math.max(0,Math.min(generationBudget(difficulty), budgetMs)));
  const {deadline,phases}=budget;
  const maxEmptyLines=MAX_GENERATED_EMPTY_LINES[difficulty-1];
  const compactCoverageReachable=budgets.facilities.areas.some(f=>budgets.terrain.areas.some(t=>activityRectangles(8,f,t,MAX_GENERATED_LINE_OCCUPANCY,maxEmptyLines).some(p=>p.grass<MAX_GENERATED_LINE_OCCUPANCY && p.terrainArea>=ACTIVITY_LIMITS.spareCells)));
  const previous = history.filter(m => m.difficulty === difficulty).slice(-40);
  const failures: Record<string, number> = {};
  const construction:Record<string,number>={};
  const measure=budget.measure.bind(budget);
  const reject = (reason: string) => { failures[reason] = (failures[reason] ?? 0) + 1; };
  let attempts = 0, proofs = 0, logicChecks = 0, stream=0, tryPlanned=false;
  let candidatesGenerated=0,candidatesValidated=0,proofExhaustions=0,timeDependent=false;
  const seenCandidates=new Set<string>(),provedCandidates=new Set<string>();
  const diagnostics=()=>({elapsed:Date.now()-started,attempts,proofs,logicChecks,failures,phases,construction,candidatesGenerated,candidatesValidated,proofExhaustions,cutoffs:budget.cutoffs,timeDependent:timeDependent || Object.keys(budget.cutoffs).length>0});
  const construct=()=>{
    attempts++;
    // Construction attempts have independent deterministic streams. The number
    // of random moves spent repairing one rejected layout must not steer every
    // later terrain and inventory sample into the same local search trajectory.
    const random=seeded((seed+Math.imul(stream,0x9e3779b9))>>>0);
    const allocation={counts:{} as Record<string,number>,area:budgets.facilities.chooseArea(()=>random()**2),target:budgets.facilities.target,min:budgets.facilities.min,max:budgets.facilities.max},terrainAllocation=budgets.terrain.sample(random);
    if (allocation.area + terrainAllocation.area + 8 > 64) { stream++;tryPlanned=false;reject('board capacity'); return; }
    const lineCapacity=MAX_GENERATED_LINE_OCCUPANCY;
    const rows=Array<number>(8).fill(lineCapacity),cols=Array<number>(8).fill(lineCapacity);
    let terrainActivity:{cells:Set<number>;terrainArea:number}|undefined;
    if(difficulty>=7) {
      const options=activityRectangles(8,allocation.area,terrainAllocation.area,lineCapacity,maxEmptyLines);
      const covered=options.filter(p=>p.grass===0 && p.terrainArea>=2).sort((a,b)=>a.r-b.r || a.c-b.c);
      // Retain compact packing where a real budget leaves less than one full
      // clue line of grass inside a rectangle.
      // Otherwise diversify open layouts by alternating strategies across
      // inventory streams. All streams still use the original quantity rules.
      const choice=random();
      const plan=covered.length?covered[Math.floor(choice*covered.length)]:(compactCoverageReachable?tryPlanned:stream%2===1)?options[Math.floor(choice**2*options.length)]:undefined;
      if(!compactCoverageReachable || covered.length || !options.length || tryPlanned) {stream++;tryPlanned=false;} else tryPlanned=true;
      if(plan) {
        const shuffled=()=>Array.from({length:8},(_,i)=>({i,order:random()})).sort((a,b)=>a.order-b.order).map(p=>p.i);
        for(const r of shuffled().slice(plan.r)) rows[r]=0;
        for(const c of shuffled().slice(plan.c)) cols[c]=0;
        terrainActivity={cells:new Set(Array.from({length:64},(_,i)=>i).filter(i=>rows[Math.floor(i/8)] && cols[i%8])),terrainArea:plan.terrainArea};
      }
    } else stream++;
    let terrain = measure('terrain',()=>layoutTerrain(random,terrainAllocation.counts,terrainRegistry,terrainAllocation.area,terrainActivity));
    let planned=!!terrainActivity;
    if(terrainActivity) construction['activity planned']=(construction['activity planned']??0)+1;
    if(!terrain && terrainActivity) {
      construction['activity fallback']=(construction['activity fallback']??0)+1;
      planned=false;
      rows.fill(lineCapacity);cols.fill(lineCapacity);
      terrain=measure('terrain',()=>layoutTerrain(random,terrainAllocation.counts,terrainRegistry,terrainAllocation.area));
    }
    if (!terrain) { reject('terrain planning'); return; }
    const piecesToPlace = allowed.filter(p=>(budgets.facilities.items.find(i=>i.id===p.id)?.max??0)>0);
    // Sparse terrain needs informative clue capacities, not more obstacles.
    // Zero lines and terrain capacity are planned together. The packing search
    // still chooses every facility count, position and rotation from domains.
    const baseLevel: Level = { id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain, pieces: piecesToPlace, rows, cols };
    const activity=measure('construction',until=>activityDomains(baseLevel,placementDomains(baseLevel),budgets.facilities.items,allocation.area,random,until,construction,MAX_GENERATED_FACILITIES[difficulty-1],maxEmptyLines));
    if (!activity) { reject('combination layout'); return; }
    // Spend the next slot on a new inventory once this stream has already
    // produced a layout. The planned counterpart is a construction fallback,
    // rather than a second expensive repair of the same inventory.
    if(tryPlanned) {stream++;tryPlanned=false;}
    if(planned) construction['activity completed']=(construction['activity completed']??0)+1;
    const {level,groups,entries}=activity;
    for(const item of budgets.facilities.items) allocation.counts[item.id]=entries.filter(e=>templateId(e.piece)===item.id).length;
    measure('facility refinement',until=>refineFacilities(entries,groups,random,until,maxEmptyLines));
    const pieces = entries.map(e => e.piece), placements = entries.map(e => ({ ...e.p.at, id: e.piece.id }));
    const initial = withEditorPlacements({ level: { ...level, pieces }, placements }, placements);
    if(repartitionCount(entries,groups)) {reject('partition ambiguity');return;}
    let draft={...initial,level:measure('terrain refinement',until=>refineTerrain(initial.level,entries,random,until))};
    if(difficulty>=7) {
      const active=placementDomains({...draft.level,rows:level.rows,cols:level.cols});
      for(const e of entries) e.p=active.find(g=>templateId(g.piece)===templateId(e.piece))!.domain.find(p=>p.mask===e.p.mask)!;
      draft=measure('logical refinement',until=>refineLogicalLayout(draft,entries,active,random,until,maxEmptyLines));
    }
    // Construction capacities are preferences. Formal validation must restore
    // every legal domain under the final clues, including after refinement.
    const prepared=placementDomains(draft.level);
    const quality = mapQuality(draft);
    if (!quality.accepted || quality.distribution.violations.length || inventoryViolations(draft.level,difficulty,disabled).length || !evaluate(draft.level, draft.placements).won) { reject('layout quality'); return; }
    if (hasRoleSwap(entries, prepared)) { reject('role ambiguity'); return; }
    if (repartitionCount(entries, prepared)) { reject('partition ambiguity'); return; }
    const fingerprint=mapFingerprint(draft);
    if(seenCandidates.has(fingerprint)) {reject('duplicate candidate');return;}
    seenCandidates.add(fingerprint);candidatesGenerated++;
    return {draft,quality,prepared,allocation,terrainAllocation,random};
  };
  const canConstruct=()=>attempts<1200 && budget.canConstruct();
  const urgent=()=>{const value=budget.urgent();if(value) timeDependent=true;return value;};
  for(const candidates of generationCandidateBatches(construct,canConstruct,urgent)) {
    const batch=candidates.sort((a,b)=>b.quality.score-a.quality.score);
    for (const candidate of batch) {
      let {draft, quality, prepared} = candidate;
      const {allocation,terrainAllocation,random}=candidate;
      candidatesValidated++;
      logicChecks++;
      const logicBudget = { deadline:budget.phaseDeadline('logic'), ...generationReasoningBudget(difficulty) };
      let logic = measure('logic',()=>reasonLevel(draft.level, logicBudget, prepared));
      const excluded: (typeof draft.placements)[]=[];
      for(let refinement=0;!logic.solved && !logic.aborted && refinement<8 && Date.now()<deadline;refinement++) {
        const probe=measure('witness search',until=>solveLevel(draft.level,2,{deadline:until,maxNodes:2400},reasonedDomains(prepared,logic)));
        if(probe.aborted) reject('witness budget');else if(probe.count>1) reject('witness multiple');
        if(probe.aborted || !probe.count) break;
        const signature=(placements:typeof draft.placements)=>placements.map(at=>{
          const piece=draft.level.pieces.find(p=>p.id===at.id)!;
          return templateId(piece)+':'+occupied(piece,at).map(p=>p.r*8+p.c).sort((a,b)=>a-b).join(',');
        }).sort().join(';');
        const answer=signature(draft.placements),witnesses=probe.solutions.filter(p=>signature(p)!==answer);
        if(!witnesses.length) break;
        excluded.push(...witnesses);
        const entries=draft.placements.map(at=>{const piece=draft.level.pieces.find(p=>p.id===at.id)!;return {piece,p:prepared.find(g=>templateId(g.piece)===templateId(piece))!.domain.find(p=>p.mask===occupied(piece,at).reduce((m,c)=>m|(1n<<BigInt(c.r*8+c.c)),0n))!};});
        const next=measure('witness refinement',until=>refineTerrain(draft.level,entries,random,until,excluded));
        if(next===draft.level) break;
        draft={...draft,level:next};prepared=placementDomains(next);quality=mapQuality(draft);
        logicChecks++;logic=measure('logic',()=>reasonLevel(next,logicBudget,prepared));
      }
      // Incomplete logic is never a constraint failure or an acceptance.
      if (logic.aborted) { reject('logic incomplete'); continue; }
      if (!quality.accepted || quality.distribution.violations.length || inventoryViolations(draft.level,difficulty,disabled).length || !evaluate(draft.level,draft.placements).won) { reject('layout quality'); continue; }
      const preliminary = generationDifficulty(draft, { occupied: 0, candidates: 0, nodes: 0, branches: 0 }, logic, difficulty);
      if (preliminary.rejection) { reject(preliminary.rejection); continue; }
      const fingerprint = mapFingerprint(draft), features = mapFeatures(draft, difficulty);
      if (recent.includes(fingerprint) || previous.some(old => { const c = compareMaps(features, old); return c.equivalent || c.similarity > .88; })) { reject('recent similarity'); continue; }
      if(provedCandidates.has(fingerprint)) {reject('duplicate candidate');continue;}
      provedCandidates.add(fingerprint);
      proofs++;
      const solved = measure('proof',()=>solveLevel(draft.level, 2, { deadline, maxNodes: 16000 }, reasonedDomains(prepared,logic)));
      if (solved.aborted || solved.count !== 1) { if(solved.aborted) proofExhaustions++;reject(solved.aborted ? 'proof budget' : 'not unique'); continue; }
      if (Date.now() >= deadline) break;
      return { id, difficulty, seed, draft, fingerprint, metrics: generationDifficulty(draft, solved, logic, difficulty),
        diagnostics: { ...diagnostics(), unique: true, quality, inventory: {facilities:allocation, terrain:terrainAllocation}, reasoning: logic } };
    }
  }
  if(attempts>=1200) reject('attempt budget');
  if(!budget.canConstruct() || Date.now()>=deadline) {reject('search budget');timeDependent=true;}
  const labels: Record<string, string> = { 'attempt budget':'主构造次数预算耗尽','logic contradiction':'逻辑约束矛盾','search budget':'搜索时间预算耗尽','logic incomplete':'逻辑推演未完成','duplicate candidate':'重复候选', 'board capacity':'棋盘容量不足', 'terrain planning': '地形规划未找到', 'combination layout': '联合布局未找到', 'layout quality': '布局质量或硬约束', 'role ambiguity': '设施角色存在等价交换', 'partition ambiguity':'多格设施存在等价重分割', 'logic budget': '逻辑推演预算', 'logic stalled': '缺少可解释路径', 'no logical opening': '缺少局部推理入口', 'too immediate': '初始位置过于直接', 'recent similarity': '近期地图相似', 'proof budget': '唯一解证明未完成', 'not unique': '未证明唯一解', 'witness budget':'多解诊断预算', 'witness multiple':'发现多个解', 'reasoning tier low':'推理难度低于范围', 'reasoning tier high':'推理难度高于范围', 'reasoning relationships':'推理关联不足' };
  const reason = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${labels[name] ?? name} ${count}`).join(', ') || '计算预算已用完';
  throw new MapGenerationSearchError(`预算内未找到满足地形质量、逻辑路径和唯一解的地图（${attempts} 次构造；${reason}）。${disabled.length ? '当前禁用组合可能限制了可用依赖关系，请调整设施或重试。' : '请重试。'}`, diagnostics());
}
