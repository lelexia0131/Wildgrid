export const SURVIVAL_DIFFICULTIES = [
  { min: 4, max: 5, xp: 1, label: '非常简单', bases: [6], multi: 0 },
  { min: 6, max: 7, xp: 3, label: '简单', bases: [15], multi: 1 },
  { min: 8, max: 9, xp: 6, label: '较简单', bases: [16, 17], multi: 2 },
  { min: 9, max: 11, xp: 10, label: '普通', bases: [17, 18, 19, 20], multi: 2 },
  { min: 11, max: 13, xp: 15, label: '中等', bases: [20, 21, 23, 24], multi: 3 },
  { min: 13, max: 14, xp: 25, label: '中等偏难', bases: [23, 24, 25], multi: 4 },
  { min: 14, max: 16, xp: 36, label: '困难', bases: [25, 26, 27], multi: 5 },
  { min: 15, max: 17, xp: 50, label: '很困难', bases: [26, 27, 28], multi: 5 },
  { min: 17, max: 19, xp: 70, label: '极困难', bases: [28, 29, 30], multi: 5 },
  { min: 18, max: 20, xp: 100, label: '最高难度', bases: [29, 30], multi: 6 },
];
export const SURVIVAL_RANKS = [
  { name: '荒野新人', xp: 0 }, { name: '露营学徒', xp: 10 },
  { name: '荒野探索者', xp: 100 }, { name: '资深生存家', xp: 500 }, { name: '荒野传奇', xp: 1000 },
];
export const rankFor = (xp: number) => SURVIVAL_RANKS.reduce((current, rank, i) => xp >= rank.xp ? i : current, 0);
