import type { Level, Placement, Settings } from '../../engine';
import { evaluate, getLevelById, levels } from '../../engine';
import { adventureHintBoardKey, adventureHintUsage, evaluateAdventureBadge, recordAttemptHint } from './adventureBadges';
import type { AdventureAttempt, AdventureBadgeTier, AdventureHintAction } from './adventureBadges';

export type AdventureSave = { version: 1; completed: number[]; current: number; progress: Record<number, readonly Placement[]>; settings: Settings; badges: Record<number, AdventureBadgeTier>; attempts: Record<number, AdventureAttempt> };
export function levelUnlocked(id: number, completed: number[]): boolean {
  if (id >= 31) return completed.includes(15) && (id === 31 || completed.includes(id - 1));
  return id <= Math.min(30, Math.max(1, ...completed.filter(day => day <= 30).map(day => day + 1)));
}
export function progressForPlay(save: Pick<AdventureSave, 'progress'>, level: Level): readonly Placement[] {
  const progress = save.progress[level.id] || [];
  return evaluate(level, progress).won ? [] : progress;
}
export function adventureContinueId(save: AdventureSave): number {
  const playable = levels.filter(level => levelUnlocked(level.id, save.completed));
  const unfinished = playable.filter(level => !save.completed.includes(level.id));
  const inProgress = unfinished.filter(level => progressForPlay(save, level).length > 0);
  return (inProgress.find(level => level.id === save.current) || inProgress[0]
    || unfinished.find(level => level.id === save.current) || unfinished[0]
    || playable.find(level => level.id === save.current) || playable[0]).id;
}
export const recordAdventureProgress = (save: AdventureSave, id: number, placements: readonly Placement[]): AdventureSave => ({ ...save, current: id, progress: { ...save.progress, [id]: placements } });
export function recordAdventureHint(save: AdventureSave, id: number, placements: readonly Placement[], action: AdventureHintAction): AdventureSave {
  if (save.completed.includes(id)) return save;
  const attempt = save.attempts[id] ?? { revision: 0, seen: {} };
  const next = recordAttemptHint(attempt, adventureHintBoardKey(getLevelById(id)!, placements), action);
  if (next === attempt) return save;
  return { ...recordAdventureProgress(save, id, placements), attempts: { ...save.attempts, [id]: next } };
}
export function restartAdventureLevel(save: AdventureSave, id: number): AdventureSave {
  const next = recordAdventureProgress(save, id, []);
  return save.completed.includes(id) ? next : { ...next, attempts: { ...save.attempts, [id]: { revision: (save.attempts[id]?.revision ?? 0) + 1, seen: {} } } };
}
export function completeAdventureLevel(save: AdventureSave, id: number): AdventureSave {
  if (save.completed.includes(id)) return save;
  const attempts = { ...save.attempts }; delete attempts[id];
  return { ...save, completed: [...save.completed, id], badges: { ...save.badges, [id]: save.badges[id] ?? evaluateAdventureBadge(adventureHintUsage(save.attempts[id])) }, attempts };
}
export function adventureStartSnapshot(save: AdventureSave, id: number, reset = false) {
  const level = getLevelById(id)!;
  return { level, placements: reset ? [] : progressForPlay(save, level) };
}
