export type QuantityRange = Readonly<{ min: number; max: number }>;
export type BudgetItem = QuantityRange & Readonly<{ id: string; area: number }>;

export type GenerationPhase = 'terrain' | 'construction' | 'facility refinement' | 'terrain refinement' | 'logical refinement' | 'logic' | 'witness search' | 'witness refinement' | 'proof';

// Soft shares coordinate cumulative work; unused time is borrowable. Only the
// overall deadline is hard. Optional work protects a full logic pass and proof;
// logic can borrow everything except the final proof reserve.
export function coordinateGenerationBudget(started:number, duration:number) {
  const deadline=started+duration;
  const shares:Record<GenerationPhase,number>={'terrain':.08,'construction':.35,'facility refinement':.03,'terrain refinement':.12,'logical refinement':.08,'logic':.20,'witness search':.04,'witness refinement':.06,'proof':.04};
  const phases:Record<string,{calls:number;ms:number}>={},cutoffs:Record<string,number>={};
  const proofReserve=()=>Math.max(Math.min(200,duration*.04),(phases.proof?.ms??0)/Math.max(1,phases.proof?.calls??0)*2);
  const validationReserve=()=>proofReserve()+Math.max(duration*.02,phases.logic?phases.logic.ms/phases.logic.calls*2:duration*.12);
  const remaining=()=>Math.max(0,deadline-Date.now());
  return {deadline,phases,cutoffs,remaining,
    urgent:()=>remaining()<=validationReserve()*2,
    canConstruct:()=>remaining()>validationReserve(),
    phaseDeadline(phase:GenerationPhase) {
      if(phase==='proof') return deadline;
      const reserve=phase==='logic'?proofReserve():validationReserve();
      if(phase==='logic') return deadline-reserve;
      const available=Math.max(0,remaining()-reserve);
      const credit=Math.max(0,duration*shares[phase]-(phases[phase]?.ms??0));
      // Construction can borrow broadly. Depleted optional improvement and
      // witness phases borrow in small slices, so repeated repairs cannot each
      // claim a quarter of the remaining round and starve exploration.
      const optional=phase.includes('refinement') || phase==='witness search';
      const loan=Math.min(available*.25,optional?duration*.002:Infinity);
      return Math.min(deadline-reserve,Date.now()+Math.max(credit,loan));
    },
    measure<T>(phase:GenerationPhase, work:(until:number)=>T):T {
      const until=this.phaseDeadline(phase),start=performance.now();
      try {return work(until);}
      finally {
        const stats=phases[phase]??={calls:0,ms:0};stats.calls++;stats.ms+=performance.now()-start;
        if(Date.now()>=until) cutoffs[phase]=(cutoffs[phase]??0)+1;
      }
    },
  };
}

// Suffix reachability chooses the budget first, then samples only combinations
// that can complete it. No rejection sampling and no per-type independent draw.
export function prepareBudget(items: readonly BudgetItem[], maxCount = Infinity) {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id) || !Number.isInteger(item.min) || !Number.isInteger(item.max) || item.min < 0 || item.max < item.min || !Number.isInteger(item.area) || item.area < 1)
      throw new Error(`Invalid generation quantity: ${item.id}`);
    ids.add(item.id);
  }
  let target = items.reduce((sum, item) => sum + (item.min + item.max) * item.area / 2, 0);
  let min = Math.ceil(target * .9), max = Math.floor(target * 1.1);
  const suffix: Map<number,number>[] = Array.from({ length: items.length + 1 }, () => new Map());
  suffix[items.length].set(0,0);
  for (let i = items.length - 1; i >= 0; i--) for (let n = items[i].min; n <= items[i].max; n++)
    for (const [rest,count] of suffix[i + 1]) if (n + count <= maxCount) {
      const area = n * items[i].area + rest;
      suffix[i].set(area,Math.min(suffix[i].get(area)??Infinity,n+count));
    }
  let budgets = [...suffix[0].keys()].filter(area => area >= min && area <= max).sort((a,b)=>a-b);
  // A hard count cap takes precedence when the original area range is unreachable.
  if (!budgets.length && Number.isFinite(maxCount) && suffix[0].size) {
    target = Math.max(...suffix[0].keys());
    min = Math.ceil(target * .9); max = Math.floor(target * 1.1);
    budgets = [...suffix[0].keys()].filter(area => area >= min && area <= max).sort((a,b)=>a-b);
  }
  if (!budgets.length) throw new Error(`No integer generation budget in [${min}, ${max}] (target ${target}; ${items.map(i => i.id).join(', ')})`);
  const chooseArea=(random:()=>number)=>budgets[Math.floor(random()*budgets.length)];
  return { items, target, min, max, areas:budgets as readonly number[], chooseArea, sample(random: () => number) {
    const area = chooseArea(random), counts: Record<string, number> = {};
    let remaining = area, available = maxCount;
    for (let i = 0; i < items.length; i++) {
      const item = items[i], options: number[] = [];
      for (let n = item.min; n <= item.max; n++) {
        const rest = suffix[i + 1].get(remaining - n * item.area);
        if (rest !== undefined && rest <= available - n) options.push(n);
      }
      const count = options[Math.floor(random() * options.length)];
      counts[item.id] = count; remaining -= count * item.area; available -= count;
    }
    return { counts, area, target, min, max };
  } };
}
