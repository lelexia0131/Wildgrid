import type { Level, Placement, Settings } from './types';
import { evaluate } from './rules';
import { levels as fixedLevels } from './levels';
import { validatePlacements } from './placementValidation';
export type Save = { version: 1; completed: number[]; current: number; progress: Record<number, Placement[]>; settings: Settings };
const fresh = (): Save => ({ version: 1, completed: [], current: 1, progress: {}, settings: { music: 0.35, effects: 0.65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false } });
const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
export function levelUnlocked(id: number, completed: number[]): boolean {
  if (id >= 31) return completed.includes(15) && (id === 31 || completed.includes(id - 1));
  return id <= Math.min(30, Math.max(1, ...completed.filter(day => day <= 30).map(day => day + 1)));
}
export function progressForPlay(save: Save, level: Level): Placement[] {
  const progress = save.progress[level.id] || [];
  return evaluate(level, progress).won ? [] : progress;
}
export function readSave(levels: Level[] = fixedLevels): Save {
  try {
    const raw = JSON.parse(localStorage.getItem('wildgrid-save-v1') || 'null');
    if (!raw || raw.version !== 1) return fresh();
    const save = fresh();
    save.completed = Array.isArray(raw.completed) ? [...new Set<number>(raw.completed.filter((id: number) => levels.some(l => l.id === id)))] : [];
    save.current = levels.some(l => l.id === raw.current) ? raw.current : 1;
    for (const l of levels) save.progress[l.id] = validatePlacements(l, raw.progress?.[l.id], 'recover').placements;
    save.settings = { music: volume(raw.settings?.music, .35), effects: volume(raw.settings?.effects, .65), muted: raw.settings?.muted === true, facilityTips: raw.settings?.facilityTips !== false, continuousPlacement: raw.settings?.continuousPlacement !== false, facilityNames: raw.settings?.facilityNames === true };
    return save;
  } catch { return fresh(); }
}
export function writeSave(save: Save) {
  try { localStorage.setItem('wildgrid-save-v1', JSON.stringify(save)); return true; } catch { return false; }
}
