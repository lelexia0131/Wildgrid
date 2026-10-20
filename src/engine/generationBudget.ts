export type QuantityRange = Readonly<{ min: number; max: number }>;
export type BudgetItem = QuantityRange & Readonly<{ id: string; area: number }>;

// Suffix reachability chooses the budget first, then samples only combinations
// that can complete it. No rejection sampling and no per-type independent draw.
export function prepareBudget(items: readonly BudgetItem[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id) || !Number.isInteger(item.min) || !Number.isInteger(item.max) || item.min < 0 || item.max < item.min || !Number.isInteger(item.area) || item.area < 1)
      throw new Error(`Invalid generation quantity: ${item.id}`);
    ids.add(item.id);
  }
  const target = items.reduce((sum, item) => sum + (item.min + item.max) * item.area / 2, 0);
  const min = Math.ceil(target * .9), max = Math.floor(target * 1.1);
  const suffix: Set<number>[] = Array.from({ length: items.length + 1 }, () => new Set());
  suffix[items.length].add(0);
  for (let i = items.length - 1; i >= 0; i--) for (let n = items[i].min; n <= items[i].max; n++)
    for (const rest of suffix[i + 1]) if (n * items[i].area + rest <= max) suffix[i].add(n * items[i].area + rest);
  const budgets = [...suffix[0]].filter(area => area >= min && area <= max).sort((a,b)=>a-b);
  if (!budgets.length) throw new Error(`No integer generation budget in [${min}, ${max}] (target ${target}; ${items.map(i => i.id).join(', ')})`);
  const chooseArea=(random:()=>number)=>budgets[Math.floor(random()*budgets.length)];
  return { items, target, min, max, chooseArea, sample(random: () => number) {
    const area = chooseArea(random), counts: Record<string, number> = {};
    let remaining = area;
    for (let i = 0; i < items.length; i++) {
      const item = items[i], options: number[] = [];
      for (let n = item.min; n <= item.max; n++) if (suffix[i + 1].has(remaining - n * item.area)) options.push(n);
      const count = options[Math.floor(random() * options.length)];
      counts[item.id] = count; remaining -= count * item.area;
    }
    return { counts, area, target, min, max };
  } };
}
