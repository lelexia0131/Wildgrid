import { validatePlacements } from './placementValidation';
import { decodeMap, encodeMap } from './sandbox';
import type { SandboxDraft } from './sandbox';
import type { Placement } from './types';
import type { SurvivalChallenge, SurvivalSave } from './survival';
import { isMapIcon } from './mapIcons';
import type { MapIconId } from './mapIcons';

export type SurvivalMapInfo = { challengeId: string; difficulty: number; seed: number; completed: boolean; blueprintUnlocked: boolean };
export type LocalMap = { id: number; name: string; customName?: string; icon?: MapIconId; draft: SandboxDraft; progress: Placement[]; source?: 'survival'; survival?: SurvivalMapInfo };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function validateProgress(draft: SandboxDraft, value: unknown): Placement[] {
  if (!Array.isArray(value) || value.length > draft.level.pieces.length) throw new Error('地图游玩进度不完整');
  const { placements, error } = validatePlacements(draft.level, value);
  if (error) {
    if (error.code === 'unknown' || error.code === 'duplicate') throw new Error('地图游玩进度包含未知或重复设施');
    if (error.code === 'coordinates' || error.code === 'rotation') throw new Error('地图游玩进度的坐标或旋转方向无效');
    throw new Error(`地图游玩进度无效：${error.message}`);
  }
  return placements;
}

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
      maps.push({ id: entry.id, name: '', ...(customName ? { customName } : {}), ...(isMapIcon(entry.icon) ? { icon: entry.icon } : {}), draft, progress: validateProgress(draft, entry.progress), ...(survival ? { source: 'survival' as const, survival } : {}) });
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

export function upsertLocalMap(maps: LocalMap[], draft: SandboxDraft, progress: Placement[] = [], existingId?: number, survival?: SurvivalMapInfo): { maps: LocalMap[]; saved: LocalMap } {
  const code = encodeMap(draft);
  const restored = decodeMap(code), savedProgress = validateProgress(restored, progress);
  if (existingId !== undefined && !maps.some(map => map.id === existingId)) throw new Error('要保存的本地地图存档不存在');
  const id = existingId ?? Math.max(0, ...maps.map(map => map.id)) + 1;
  if (!Number.isSafeInteger(id)) throw new Error('本地地图存档编号已超出范围');
  const existing = maps.find(map => map.id === id);
  const sameOriginal = !existing || encodeMap(existing.draft) === code;
  if (existing?.survival && !existing.survival.blueprintUnlocked && !sameOriginal) throw new Error('通关或放弃挑战后才能编辑荒野求生地图');
  const info = survival || (sameOriginal ? existing?.survival : undefined);
  const saved: LocalMap = { id, name: existing?.name || `本地地图${maps.length + 1}`, ...(existing?.customName ? { customName: existing.customName } : {}), ...(existing?.icon ? { icon: existing.icon } : {}), draft: restored, progress: savedProgress, ...(info ? { source: 'survival', survival: info } : {}) };
  return { maps: [...maps.filter(map => map.id !== id), saved], saved };
}

export function unlockSurvivalMapEntries(maps: LocalMap[], challengeId: string): LocalMap[] {
  if (!maps.some(map => map.survival?.challengeId === challengeId)) return maps;
  return maps.map(map => map.survival?.challengeId === challengeId ? { ...map, survival: { ...map.survival, completed: true, blueprintUnlocked: true } } : map);
}
export function removeLocalMap(maps: LocalMap[], id: number): LocalMap[] {
  return maps.some(map => map.id === id) ? maps.filter(map => map.id !== id) : maps;
}
export function renameLocalMapEntry(maps: LocalMap[], id: number, name: string): LocalMap[] {
  if (!maps.some(map => map.id === id)) throw new Error('要编辑的本地地图存档不存在');
  return maps.map(map => map.id === id ? { ...map, customName: name.trim() || undefined } : map);
}
export function setLocalMapEntryIcon(maps: LocalMap[], id: number, icon: MapIconId): LocalMap[] {
  if (!maps.some(map => map.id === id)) throw new Error('要编辑的本地地图存档不存在');
  return maps.map(map => map.id === id ? { ...map, icon } : map);
}
export function survivalCollectionTarget(maps: LocalMap[], save: SurvivalSave, challenge: SurvivalChallenge): { existingId: number | undefined; survival: SurvivalMapInfo } {
  const completed = save.completed.some(c => c.id === challenge.id);
  return { existingId: maps.find(map => map.survival?.challengeId === challenge.id)?.id, survival: { challengeId: challenge.id, difficulty: challenge.difficulty, seed: challenge.seed, completed, blueprintUnlocked: completed } };
}
