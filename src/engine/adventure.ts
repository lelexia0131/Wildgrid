import type { Level, Placement, Settings } from './types';
import { evaluate } from './rules';
import { levels as fixedLevels, getLevelById } from './levels';
import { validatePlacements } from './placementValidation';

export type Save = { version: 1; completed: number[]; current: number; progress: Record<number, Placement[]>; settings: Settings };
export const createAdventureSave = (): Save => ({ version: 1, completed: [], current: 1, progress: {}, settings: { music: 0.35, effects: 0.65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true } });
const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

export function levelUnlocked(id: number, completed: number[]): boolean {
  if (id >= 31) return completed.includes(15) && (id === 31 || completed.includes(id - 1));
  return id <= Math.min(30, Math.max(1, ...completed.filter(day => day <= 30).map(day => day + 1)));
}
export function progressForPlay(save: Save, level: Level): Placement[] {
  const progress = save.progress[level.id] || [];
  return evaluate(level, progress).won ? [] : progress;
}
export function parseAdventureSave(stored: string | null, levels: Level[] = fixedLevels): Save {
  const raw = JSON.parse(stored || 'null');
  if (!raw || raw.version !== 1) return createAdventureSave();
  const save = createAdventureSave();
  save.completed = Array.isArray(raw.completed) ? [...new Set<number>(raw.completed.filter((id: number) => levels.some(l => l.id === id)))] : [];
  save.current = levels.some(l => l.id === raw.current) ? raw.current : 1;
  for (const l of levels) save.progress[l.id] = validatePlacements(l, raw.progress?.[l.id], 'recover').placements;
  save.settings = { music: volume(raw.settings?.music, .35), effects: volume(raw.settings?.effects, .65), muted: raw.settings?.muted === true, facilityTips: raw.settings?.facilityTips !== false, continuousPlacement: raw.settings?.continuousPlacement !== false, facilityNames: raw.settings?.facilityNames === true, ruleDisplay: raw.settings?.ruleDisplay !== false };
  return save;
}
export function adventureSaveWritable(stored: string | null): boolean {
  if (stored === null) return true;
  const raw = JSON.parse(stored);
  return raw === null || typeof raw === 'object' && raw.version === 1;
}
export const recordAdventureProgress = (save: Save, id: number, placements: Placement[]): Save => ({ ...save, current: id, progress: { ...save.progress, [id]: placements } });
export const completeAdventureLevel = (save: Save, id: number): Save => ({ ...save, completed: [...new Set([...save.completed, id])] });
export function adventureStartSnapshot(save: Save, id: number, reset = false) {
  const level = getLevelById(id)!;
  return { level, placements: reset ? [] : progressForPlay(save, level) };
}
