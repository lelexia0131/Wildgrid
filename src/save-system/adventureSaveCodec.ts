import { levels as fixedLevels, validatePlacements } from '../engine';
import type { Level } from '../engine';
import type { AdventureSave } from '../game-modes/adventure/adventureProgress';

export const createAdventureSave = (): AdventureSave => ({ version: 1, completed: [], current: 1, progress: {}, settings: { music: 0.35, effects: 0.65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true } });
const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

export function parseAdventureSave(stored: string | null, levels: readonly Level[] = fixedLevels): AdventureSave {
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
