import type { Level, Placement } from '../../engine/types';
import { key, occupied } from '../../engine/boardGeometry';

export const ADVENTURE_BADGES = {
  gold: { name: '独立破解', material: '金色徽章', review: '全程未使用提示', condition: '完全未使用提示。' },
  silver: { name: '灵感启发', material: '银色徽章', review: '从少量观察中获得灵感', condition: '仅使用一级提示，累计权重不超过 2。' },
  bronze: { name: '指引破解', material: '铜色徽章', review: '循着线索完成规划', condition: '累计权重为 3～6，未使用三级提示或放置预览。' },
  wood: { name: '完成挑战', material: '普通通关', review: '坚持完成营地规划', condition: '使用三级提示、放置预览，或累计权重超过 6。' },
} as const;
export type AdventureBadgeTier = keyof typeof ADVENTURE_BADGES;
export type AdventureHintAction = 1 | 2 | 3 | 'preview';
export type AdventureAttempt = { revision: number; seen: Record<string, number> };
export type AdventureHintUsage = { weight: number; maxLevel: number; preview: boolean };
export const ADVENTURE_HINT_COSTS = { 1: 1, 2: 2, 3: 3, preview: 4 } as const;
const actionBits = { 1: 1, 2: 2, 3: 4, preview: 8 } as const;
export const isAdventureBadgeTier = (value: unknown): value is AdventureBadgeTier => typeof value === 'string' && Object.hasOwn(ADVENTURE_BADGES, value);

// Interchangeable IDs and equivalent rotations must not charge twice for the
// same visible layout. Use the existing occupied-cell geometry to identify it.
export const adventureHintBoardKey = (level: Level, placements: readonly Placement[]) => JSON.stringify(placements.map(at => {
  const piece = level.pieces.find(p => p.id === at.id)!;
  return `${piece.kind}/${piece.shape}:${occupied(piece, at).map(key).sort().join(';')}`;
}).sort());
export function recordAttemptHint(attempt: AdventureAttempt, board: string, action: AdventureHintAction): AdventureAttempt {
  const previous = attempt.seen[board] ?? 0, next = previous | actionBits[action];
  return previous === next ? attempt : { ...attempt, seen: { ...attempt.seen, [board]: next } };
}
export function adventureHintUsage(attempt?: AdventureAttempt): AdventureHintUsage {
  let weight = 0, maxLevel = 0, preview = false;
  for (const mask of Object.values(attempt?.seen ?? {})) {
    for (const level of [1, 2, 3] as const) if (mask & actionBits[level]) { weight += ADVENTURE_HINT_COSTS[level]; maxLevel = Math.max(maxLevel, level); }
    if (mask & actionBits.preview) { weight += ADVENTURE_HINT_COSTS.preview; preview = true; }
  }
  return { weight, maxLevel, preview };
}
export function evaluateAdventureBadge({ weight, maxLevel, preview }: AdventureHintUsage): AdventureBadgeTier {
  if (weight === 0 && maxLevel === 0 && !preview) return 'gold';
  if (!preview && maxLevel === 1 && weight <= 2) return 'silver';
  if (!preview && maxLevel <= 2 && weight >= 3 && weight <= 6) return 'bronze';
  return 'wood';
}

// Only real completion records receive legacy honors. This is migration, never
// the normal award path; valid persisted grades are not re-evaluated.
export function migrateAdventureBadges(completed: readonly number[], stored: unknown): Record<number, AdventureBadgeTier> {
  const badges = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {};
  return Object.fromEntries(completed.map(id => [id, isAdventureBadgeTier(badges[id]) ? badges[id] : 'gold']));
}
export function adventureBadgeCounts(badges: Readonly<Record<number, AdventureBadgeTier>>) {
  const counts = { gold: 0, silver: 0, bronze: 0, wood: 0 };
  for (const tier of Object.values(badges)) counts[tier]++;
  return counts;
}
