export const SURVIVAL_DIFFICULTIES = [
  { min: 4, max: 5, xp: 1, label: '非常简单', multi: 0 },
  { min: 6, max: 7, xp: 3, label: '简单', multi: 1 },
  { min: 8, max: 9, xp: 6, label: '较简单', multi: 2 },
  { min: 9, max: 11, xp: 10, label: '普通', multi: 2 },
  { min: 11, max: 13, xp: 15, label: '中等', multi: 3 },
  { min: 13, max: 14, xp: 25, label: '中等偏难', multi: 4 },
  { min: 14, max: 16, xp: 36, label: '困难', multi: 5 },
  { min: 15, max: 17, xp: 50, label: '很困难', multi: 5 },
  { min: 17, max: 19, xp: 70, label: '极困难', multi: 5 },
  { min: 18, max: 20, xp: 100, label: '最高难度', multi: 6 },
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
