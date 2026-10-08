import type { Level, Placement, Settings } from './types';
import { evaluate } from './rules';
export type Save = { version: 1; completed: number[]; current: number; progress: Record<number, Placement[]>; settings: Settings };
const fresh = (): Save => ({ version: 1, completed: [], current: 1, progress: {}, settings: { music: 0.35, effects: 0.65, muted: false, facilityTips: true, continuousPlacement: true } });
const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
export function progressForPlay(save: Save, level: Level): Placement[] {
  const progress = save.progress[level.id] || [];
  return evaluate(level, progress).won ? [] : progress;
}
export function readSave(levels: Level[]): Save {
  try {
    const raw = JSON.parse(localStorage.getItem('wildgrid-save-v1') || 'null');
    if (!raw || raw.version !== 1) return fresh();
    const save = fresh();
    save.completed = Array.isArray(raw.completed) ? [...new Set<number>(raw.completed.filter((id: number) => levels.some(l => l.id === id)))] : [];
    save.current = levels.some(l => l.id === raw.current) ? raw.current : 1;
    for (const l of levels) {
      const seen = new Set<string>();
      save.progress[l.id] = Array.isArray(raw.progress?.[l.id]) ? raw.progress[l.id].filter((p: Placement) => {
        if (!p || !l.pieces.some(item => item.id === p.id) || seen.has(p.id) || ![p.r, p.c, p.rotation].every(Number.isInteger) || p.r < 0 || p.c < 0 || p.r >= l.size || p.c >= l.size || p.rotation < 0 || p.rotation > 3) return false;
        seen.add(p.id); return true;
      }) : [];
    }
    save.settings = { music: volume(raw.settings?.music, .35), effects: volume(raw.settings?.effects, .65), muted: raw.settings?.muted === true, facilityTips: raw.settings?.facilityTips !== false, continuousPlacement: raw.settings?.continuousPlacement !== false };
    return save;
  } catch { return fresh(); }
}
export function writeSave(save: Save) {
  try { localStorage.setItem('wildgrid-save-v1', JSON.stringify(save)); return true; } catch { return false; }
}
