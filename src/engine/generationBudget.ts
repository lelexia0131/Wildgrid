export type QuantityRange = Readonly<{ min: number; max: number }>;
export type BudgetItem = QuantityRange & Readonly<{ id: string; area: number }>;

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
  return { items, target, min, max, chooseArea, sample(random: () => number) {
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
