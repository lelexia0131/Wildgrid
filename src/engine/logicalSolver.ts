import { CAMP_REQUIREMENTS, evaluate } from './placementRules';
import { boardCells, cellBit, compatible, placementDomains } from './placementDomains';
import type { Candidate, PlacementGroup } from './placementDomains';
import type { Level, Placement } from './types';

export type LogicStep = { rule: 'line' | 'overlap' | 'relationship' | 'capacity' | 'shape' | 'assumption'; group: string; removed: number; remaining: number; round: number; placements?: Placement[]; eliminated?: Placement[]; assumed?: Placement; included?: boolean; contradiction?: string; proof?: LogicStep[] };
export type LogicResult = { solved: boolean; contradiction: boolean; aborted: boolean; steps: LogicStep[]; rounds: number; initialForced: number; deductions: number; assumptions: number; maxDepth: number; remaining: number; placements: Placement[]; initialPlacements: Placement[] };
type State = { domains: Candidate[][]; required: bigint; forbidden: bigint; pinned: Candidate[][] };

// Top-level eliminations are proved for this exact map. Nested assumption
// traces are hypothetical and must never be reused as unconditional pruning.
export function reasonedDomains(groups: PlacementGroup[], logic: LogicResult): PlacementGroup[] {
  const eliminated=new Map<string,Set<string>>();
  const key=(p:Placement)=>`${p.r}/${p.c}/${p.rotation}`;
  for(const step of logic.steps) if(step.eliminated) {
    const positions=eliminated.get(step.group)??new Set<string>();
    for(const p of step.eliminated) positions.add(key(p));
    eliminated.set(step.group,positions);
  }
  return groups.map(g=>({...g,domain:g.domain.filter(p=>!eliminated.get(`${g.piece.kind}_${g.piece.shape}`)?.has(key(p.at)))}));
}

// Group cardinality treats interchangeable IDs as one set of placements. All
// eliminations are necessary conditions, never a preference for the blueprint.
export function reasonLevel(level: Level, budget: { deadline?: number; maxAssumptions?: number; maxDepth?: number; maxUnresolved?: number } = {}, prepared?: PlacementGroup[]): LogicResult {
  const groups = prepared ?? placementDomains(level), n = level.size, board = boardCells(n);
  const full = (1n << BigInt(n * n)) - 1n;
  const lines = Array.from({ length: n * 2 }, (_, i) => board.reduce((mask, p) => (i < n ? p.r === i : p.c === i - n) ? mask | cellBit(p, n) : mask, 0n));
  const clues = [...level.rows, ...level.cols], counts = groups.map(g => g.ids.length);
  const steps: LogicStep[] = [];
  const singleBounds = [0, 1, 2, 3].map(value => ({ low: value, high: value }));
  const result: LogicResult = { solved: false, contradiction: false, aborted: false, steps, rounds: 0, initialForced: groups.reduce((s, g) => s + (g.domain.length === g.ids.length ? g.ids.length : 0), 0), deductions: 0, assumptions: 0, maxDepth: 0, remaining: 0, placements: [], initialPlacements: groups.flatMap(g => g.domain.length === g.ids.length ? g.domain.map((p, i) => ({ ...p.at, id: g.ids[i] })) : []) };
  const pop = (mask: bigint) => { let count = 0; while (mask) { mask &= mask - 1n; count++; } return count; };
  const expired = () => { if (Date.now() < (budget.deadline ?? Infinity)) return false; result.aborted = true; return true; };
  // Unchanged groups recur across propagation rounds. Their combinations
  // depend only on this domain, owned/forbidden cells and pinned placements.
  // Cache only unpinned groups; clues and counts are fixed for this call.
  const combinationCache=new WeakMap<Candidate[],Map<bigint,{value:{mask:bigint;indices:number[];lines:number[]}[]|undefined}>>();
  let branchTrace: LogicStep[] | undefined;
  const fail = (contradiction: string) => {
    branchTrace?.push({ rule: 'capacity', group: '*', removed: 0, remaining: 0, round: 0, contradiction });
    return false;
  };
  function propagate(state: State, record: boolean): boolean {
    let changed = true;
    while (changed) {
      if (expired()) return true;
      changed = false;
      if (state.domains.some((d, g) => state.pinned[g].length > counts[g] || state.pinned[g].some(p => !d.includes(p)))) return fail('假设位置已被排除');
      if (record) result.rounds++;
      if (state.domains.some((d, g) => d.length < counts[g])) return fail('合法候选少于同类设施数量');
      const roundDomains = state.domains.map(d => d);
      const roundUnions = state.domains.map(d => d.reduce((m, p) => m | p.mask, 0n));
      const owned = groups.map((_, g) => state.required & ~roundUnions.reduce((m, u, h) => g === h ? m : m | u, 0n) & full);
      const combinations = state.domains.map((domain, g) => {
        if (counts[g] === 1 || domain.length > 24) return undefined;
        const key=owned[g] | (state.forbidden<<BigInt(n*n));
        let cached=combinationCache.get(domain);
        if(!state.pinned[g].length && cached?.has(key)) return cached.get(key)!.value;
        const found: { mask: bigint; indices: number[]; lines:number[] }[] = [];
        const totals=Array<number>(n*2).fill(0);
        let visits = 0, overflow = false;
        function enumerate(start: number, mask: bigint, selected: number[]) {
          if (++visits > 1600 || found.length >= 100) { overflow = true; return; }
          if (pop(owned[g] & ~mask) > (counts[g] - selected.length) * domain[0].cells.length) return;
          if (selected.length === counts[g]) { if (owned[g] & ~mask || mask & state.forbidden) return; if (state.pinned[g].some(p => !selected.some(i => domain[i] === p))) return; found.push({ mask, indices: selected, lines:[...totals] }); return; }
          for (let i = start; i <= domain.length - counts[g] + selected.length; i++) {
            const p = domain[i];
            if (p.mask & state.forbidden || mask & p.mask || selected.some(j => !compatible(p, groups[g].piece.kind, domain[j]))) continue;
            const next = mask | p.mask;
            if (totals.some((v,l)=>v+(l<n?p.rows[l]:p.cols[l-n])>clues[l])) continue;
            for(let l=0;l<n;l++){totals[l]+=p.rows[l];totals[l+n]+=p.cols[l];}
            enumerate(i + 1, next, [...selected, i]);
            for(let l=0;l<n;l++){totals[l]-=p.rows[l];totals[l+n]-=p.cols[l];}
            if (overflow) return;
          }
        }
        enumerate(0, 0n, []);
        const value=overflow?undefined:found;
        if(!state.pinned[g].length) {
          if(!cached) {cached=new Map();combinationCache.set(domain,cached);}
          cached.set(key,{value});
        }
        return value;
      });
      if (combinations.some(c => c && !c.length)) return fail('同类设施的数量、形状和必占格无法同时满足');
      const mandatory = state.domains.map((domain, g) => {
        if (combinations[g]) return combinations[g]!.reduce((mask, c) => mask & c.mask, full);
        if (counts[g] === 1) return domain.reduce((mask, p) => mask & p.mask, full) | state.pinned[g].reduce((mask, p) => mask | p.mask, 0n);
        // A cell appearing in more than D-k placements must be occupied by
        // at least one of the k selected placements (pigeonhole principle).
        let mask = state.pinned[g].reduce((m, p) => m | p.mask, 0n);
        const support = Array<number>(n * n).fill(0);
        for (const p of domain) for (const cell of p.cells) support[cell.r * n + cell.c]++;
        for (let i = 0; i < support.length; i++) if (support[i] > domain.length - counts[g]) mask |= cellBit(board[i], n);
        return mask;
      });
      let required = state.required, possible = 0n;
      for (let g = 0; g < groups.length; g++) {
        if (state.domains[g].length < counts[g]) return fail('合法候选少于同类设施数量');
        for (let h = 0; h < g; h++) if (mandatory[g] & mandatory[h]) return fail('两组设施要求占用同一格');
        required |= mandatory[g];
        for (const p of state.domains[g]) possible |= p.mask;
      }
      if (required & state.forbidden || required & ~possible) return fail('必占格被排除或没有设施能够覆盖');
      let forbidden = state.forbidden;
      for (let line = 0; line < lines.length; line++) {
        const known = pop(required & lines[line]), capacity = pop(possible & lines[line] & ~forbidden);
        if (known > clues[line] || capacity < clues[line]) return fail(`第 ${line % n + 1} ${line < n ? '行' : '列'}无法满足占格提示`);
        if (known === clues[line]) forbidden |= lines[line] & ~required;
        if (capacity === clues[line]) required |= possible & lines[line] & ~forbidden;
      }
      if (required !== state.required || forbidden !== state.forbidden) changed = true;
      state.required = required; state.forbidden = forbidden;
      const unions = state.domains.map(domain => domain.reduce((m, p) => m | p.mask, 0n));
      const exclusive = groups.map((_, g) => required & ~unions.reduce((m, u, h) => h === g ? m : m | u, 0n) & full);
      const ownSupport = combinations.map(c => c ? new Set(c.flatMap(v => v.indices)) : undefined);
      const lineValues = state.domains.map((domain, g) => lines.map((_, line) => {
        const values = domain.map(p => line < n ? p.rows[line] : p.cols[line - n]);
        return counts[g] === 1 ? values : values.sort((a, b) => a - b);
      }));
      const min = groups.map((_, g) => lines.map((_, line) => combinations[g] ? Math.min(...combinations[g]!.map(c => c.lines[line])) : counts[g] === 1 ? Math.min(...lineValues[g][line]) : lineValues[g][line].slice(0, counts[g]).reduce((a, b) => a + b, 0)));
      const max = groups.map((_, g) => lines.map((_, line) => combinations[g] ? Math.max(...combinations[g]!.map(c => c.lines[line])) : counts[g] === 1 ? Math.max(...lineValues[g][line]) : lineValues[g][line].slice(-counts[g]).reduce((a, b) => a + b, 0)));
      const bounds = groups.map((_, g) => lines.map((_, l) => {
        if (counts[g] === 1) return singleBounds;
        const values = lineValues[g][l], prefix = [0], copies = counts[g] - 1;
        for (const value of values) prefix.push(prefix[prefix.length - 1] + value);
        return [0, 1, 2, 3].map(value => {
          const index = values.indexOf(value), inLow = index >= 0 && index < copies, inHigh = index >= values.length - copies;
          return { low: value + prefix[copies + Number(inLow)] - (inLow ? value : 0),
            high: value + prefix[values.length] - prefix[values.length - copies - Number(inHigh)] - (inHigh ? value : 0) };
        });
      }));
      const totalMin = lines.map((_, l) => min.reduce((s, m) => s + m[l], 0)), totalMax = lines.map((_, l) => max.reduce((s, m) => s + m[l], 0));
      if (clues.some((v, l) => v < totalMin[l] || v > totalMax[l])) return fail('设施组合占格上下界与行列提示冲突');
      for (let g = 0; g < groups.length; g++) {
        const reasons = new Map<LogicStep['rule'], Candidate[]>();
        const before = state.domains[g];
        const next = before.filter((p, index) => {
          let reason: LogicStep['rule'] | undefined;
          if (p.mask & forbidden) reason = 'line';
          else if (state.pinned[g].length === counts[g] && !state.pinned[g].includes(p)) reason = 'shape';
          else if (state.pinned[g].some(q => q !== p && !compatible(p, groups[g].piece.kind, q))) reason = 'shape';
          else if (ownSupport[g] && !ownSupport[g]!.has(index)) reason = 'shape';
          else if (counts[g] === 1 && (exclusive[g] & ~p.mask)) reason = 'capacity';
          for (let h = 0; !reason && h < groups.length; h++) {
            if (g === h) continue;
            if (p.mask & mandatory[h]) { reason = 'overlap'; break; }
            if (combinations[h] && !combinations[h]!.some(c => c.indices.every(i => compatible(p, groups[h].piece.kind, roundDomains[h][i])))) { reason = 'shape'; break; }
            let supported = 0;
            for (const q of state.domains[h]) if (compatible(p, groups[h].piece.kind, q) && ++supported >= counts[h]) break;
            if (supported < counts[h]) { reason = 'relationship'; break; }
          }
          if (!reason && CAMP_REQUIREMENTS[groups[g].piece.kind]) {
            const camps = groups.flatMap((group, h) => group.piece.kind === 'camp' ? state.domains[h].filter(q => compatible(p, 'camp', q)) : []);
            if (!p.connections.some(link => camps.some(q => (q.mask & link.camp) && !(q.mask & link.gap)) && !(link.gap & required))) reason = 'relationship';
          }
          if (!reason) for (let l = 0; l < lines.length; l++) {
            const value = l < n ? p.rows[l] : p.cols[l - n];
            const { low, high } = bounds[g][l][value];
            if (low + totalMin[l] - min[g][l] > clues[l] || high + totalMax[l] - max[g][l] < clues[l]) { reason = 'line'; break; }
          }
          if (reason) { reasons.set(reason, [...(reasons.get(reason) ?? []), p]); return false; }
          return true;
        });
        if (next.length < counts[g]) return fail(`${groups[g].piece.kind}_${groups[g].piece.shape} 的候选不足`);
        if (next.length !== before.length) {
          changed = true; state.domains[g] = next;
          if (record || branchTrace) for (const [rule, eliminated] of reasons) {
            if (record) result.deductions += eliminated.length;
            const step: LogicStep = { rule, group: `${groups[g].piece.kind}_${groups[g].piece.shape}`, removed: eliminated.length, remaining: next.length, round: record ? result.rounds : 0,
              eliminated: eliminated.map(p => p.at),
              ...(next.length === counts[g] ? { placements: next.map((p, i) => ({ ...p.at, id: groups[g].ids[i] })) } : {}) };
            (record ? steps : branchTrace!).push(step);
          }
        }
      }
    }
    return true;
  }
  const clone = (state: State): State => ({ ...state, domains: state.domains.map(d => [...d]), pinned: state.pinned.map(d => [...d]) });
  function viable(state: State, depth: number): boolean | undefined {
    if (!propagate(state, false)) return false;
    if (result.aborted) return undefined;
    if (!depth || state.domains.every((d, g) => d.length === counts[g])) return true;
    const g = state.domains.findIndex((d, i) => d.length > counts[i] && d.some(p => !state.pinned[i].includes(p)));
    if (g < 0) return true;
    const p = state.domains[g].find(p => !state.pinned[g].includes(p))!;
    for (const include of [true, false]) {
      if (result.assumptions >= (budget.maxAssumptions ?? 0)) return undefined;
      result.assumptions++; result.maxDepth = Math.max(result.maxDepth, (budget.maxDepth ?? 1) - depth + 1);
      const branch = clone(state);
      if (include) branch.pinned[g].push(p); else branch.domains[g] = branch.domains[g].filter(q => q !== p);
      branchTrace?.push({ rule: 'assumption', group: `${groups[g].piece.kind}_${groups[g].piece.shape}`, removed: 0, remaining: branch.domains[g].length, round: 0, assumed: p.at, included: include });
      const found = viable(branch, depth - 1);
      if (found !== false) return found;
    }
    return false;
  }
  const state: State = { domains: groups.map(g => [...g.domain]), required: 0n, forbidden: 0n, pinned: groups.map(() => []) };
  result.contradiction = !propagate(state, true);
  while (state.domains.reduce((s, d, g) => s + d.length - counts[g], 0) <= (budget.maxUnresolved??32) && !result.contradiction && !result.aborted && result.assumptions < (budget.maxAssumptions ?? 0)) {
    let removed = false;
    outer: for (const g of groups.map((_,i)=>i).sort((a,b)=>(state.domains[a].length-counts[a])-(state.domains[b].length-counts[b]))) {
      if (state.domains[g].length <= counts[g] || state.domains[g].length > 24) continue;
      for (const p of state.domains[g]) {
        if (result.assumptions >= (budget.maxAssumptions ?? 0) || expired()) break outer;
        result.assumptions++; result.maxDepth = Math.max(result.maxDepth, 1);
        const branch = clone(state); branch.pinned[g].push(p);
        branchTrace = [];
        const possible = viable(branch, (budget.maxDepth ?? 1) - 1), proof = branchTrace;
        branchTrace = undefined;
        if (possible !== false) continue;
        state.domains[g] = state.domains[g].filter(q => q !== p);
        steps.push({ rule: 'assumption', group: `${groups[g].piece.kind}_${groups[g].piece.shape}`, removed: 1, remaining: state.domains[g].length, round: result.rounds, assumed: p.at, included: true, eliminated: [p.at], proof });
        result.contradiction = !propagate(state, true); removed = true; break outer;
      }
    }
    if (!removed) break;
  }
  result.remaining = state.domains.reduce((s, d, g) => s + d.length - counts[g], 0);
  if (!result.contradiction && !result.aborted && result.remaining === 0) {
    result.placements = state.domains.flatMap((domain, g) => domain.map((p, i) => ({ ...p.at, id: groups[g].ids[i] })));
    result.solved = evaluate(level, result.placements).won;
    if (!result.solved) result.contradiction = true;
  }
  return result;
}
