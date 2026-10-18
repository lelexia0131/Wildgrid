import type { Level, Placement, Settings } from '../../engine';
import { evaluate, getLevelById } from '../../engine';

export type AdventureSave = { version: 1; completed: number[]; current: number; progress: Record<number, readonly Placement[]>; settings: Settings };
export function levelUnlocked(id: number, completed: number[]): boolean {
  if (id >= 31) return completed.includes(15) && (id === 31 || completed.includes(id - 1));
  return id <= Math.min(30, Math.max(1, ...completed.filter(day => day <= 30).map(day => day + 1)));
}
export function progressForPlay(save: AdventureSave, level: Level): readonly Placement[] {
  const progress = save.progress[level.id] || [];
  return evaluate(level, progress).won ? [] : progress;
}
export const recordAdventureProgress = (save: AdventureSave, id: number, placements: readonly Placement[]): AdventureSave => ({ ...save, current: id, progress: { ...save.progress, [id]: placements } });
export const completeAdventureLevel = (save: AdventureSave, id: number): AdventureSave => ({ ...save, completed: [...new Set([...save.completed, id])] });
export function adventureStartSnapshot(save: AdventureSave, id: number, reset = false) {
  const level = getLevelById(id)!;
  return { level, placements: reset ? [] : progressForPlay(save, level) };
}
