export const SURVIVAL_DIFFICULTIES = [
  { xp: 1 },
  { xp: 3 },
  { xp: 6 },
  { xp: 10 },
  { xp: 15 },
  { xp: 25 },
  { xp: 36 },
  { xp: 50 },
  { xp: 70 },
  { xp: 100 },
];
const identities = ['荒野新人', '露营学徒', '荒野探索者', '荒野专家', '荒野传奇'];
const badges = ['newcomer', 'apprentice', 'explorer', 'veteran', 'legend'];
const thresholds = [0, 10, 50, 100, 300, 500, 1000, 3000, 5000, 10000, 20000, 30000, 40000, 60000, 80000];
export const SURVIVAL_RANKS = thresholds.map((xp, i) => ({
  level: i + 1, name: `${identities[Math.floor(i / 3)]} ${['Ⅰ', 'Ⅱ', 'Ⅲ'][i % 3]}`,
  xp, icon: `survival-ranks/${badges[Math.floor(i / 3)]}-${['bronze', 'silver', 'gold'][i % 3]}`,
}));
export const rankFor = (xp: number) => SURVIVAL_RANKS.reduce((current, rank, i) => xp >= rank.xp ? i : current, 0);
export function rankProgress(xp: number) {
  const rank = rankFor(xp), current = SURVIVAL_RANKS[rank], next = SURVIVAL_RANKS[rank + 1];
  return { rank, current, next, fill: next ? (xp - current.xp) / (next.xp - current.xp) : 1 };
}
