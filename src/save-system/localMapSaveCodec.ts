import { decodeMap, encodeMap } from '../engine';
import type { LocalMap } from '../game-modes/sandbox/localMapCollection';
import { validateLocalMapProgress } from '../game-modes/sandbox/localMapCollection';
import type { SurvivalSave } from '../game-modes/survival/survivalChallenge';
import { isMapIcon } from '../game-modes/sandbox/mapIcons';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseLocalMapsSave(raw: string | null, survivalSave: SurvivalSave): LocalMap[] {
  let value: unknown;
  try { value = JSON.parse(raw || 'null'); } catch { return []; }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.maps)) return [];
  const maps: LocalMap[] = [];
  const completed = new Set(survivalSave.completed.map(c => c.id));
  for (const entry of value.maps) {
    if (!object(entry) || typeof entry.id !== 'number' || !Number.isSafeInteger(entry.id) || entry.id < 1 || maps.some(map => map.id === entry.id) || typeof entry.code !== 'string') continue;
    try {
      const draft = decodeMap(entry.code);
      const customName = typeof entry.customName === 'string' ? entry.customName.trim() : '';
      const info = entry.survival;
      if (entry.source === 'survival' && (!object(info) || typeof info.challengeId !== 'string' || typeof info.difficulty !== 'number' || !Number.isInteger(info.difficulty) || info.difficulty < 1 || info.difficulty > 10 || typeof info.seed !== 'number' || !Number.isInteger(info.seed))) continue;
      const survival = entry.source === 'survival' && object(info) ? { challengeId: info.challengeId as string, difficulty: info.difficulty as number, seed: info.seed as number, completed: completed.has(info.challengeId as string) || info.completed === true, blueprintUnlocked: completed.has(info.challengeId as string) || info.blueprintUnlocked === true || survivalSave.challenge?.id !== info.challengeId } : undefined;
      maps.push({ id: entry.id, name: '', ...(customName ? { customName } : {}), ...(isMapIcon(entry.icon) ? { icon: entry.icon } : {}), draft, progress: validateLocalMapProgress(draft, entry.progress), ...(survival ? { source: 'survival' as const, survival } : {}) });
    } catch { /* Keep other valid maps when an individual save is damaged. */ }
  }
  return maps.sort((a, b) => a.id - b.id).map((map, index) => ({ ...map, name: map.customName || `本地地图${index + 1}` }));
}

export function parseLocalMapsForWrite(stored: string | null, survivalSave: SurvivalSave): LocalMap[] {
  let raw;
  try { raw = JSON.parse(stored || 'null'); } catch { throw new Error('本地地图无法读取，原数据已保留'); }
  const maps = parseLocalMapsSave(stored, survivalSave);
  if (raw && (raw.version !== 1 || !Array.isArray(raw.maps) || raw.maps.length !== maps.length)) throw new Error('本地地图不完整或版本不兼容，原数据已保留');
  return maps;
}
export function serializeLocalMaps(maps: LocalMap[]): string {
  const entries = maps.map(map => ({ id: map.id, customName: map.customName, icon: map.icon, code: encodeMap(map.draft), progress: map.progress, source: map.source, survival: map.survival }));
  return JSON.stringify({ version: 1, maps: entries });
}

