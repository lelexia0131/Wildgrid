import { decodeMap, encodeMap, validatePlacements } from '../../engine';
import type { Placement, SandboxDraft } from '../../engine';
import type { SurvivalChallenge, SurvivalSave } from '../survival/survivalChallenge';
import type { MapIconId } from './mapIcons';

export type SurvivalMapInfo = { challengeId: string; difficulty: number; seed: number; completed: boolean; blueprintUnlocked: boolean };
export type LocalMap = { id: number; name: string; customName?: string; icon?: MapIconId; draft: SandboxDraft; progress: readonly Placement[]; source?: 'survival'; survival?: SurvivalMapInfo };
export function validateLocalMapProgress(draft: SandboxDraft, value: unknown): Placement[] {
  if (!Array.isArray(value) || value.length > draft.level.pieces.length) throw new Error('地图游玩进度不完整');
  const { placements, error } = validatePlacements(draft.level, value);
  if (error) {
    if (error.code === 'unknown' || error.code === 'duplicate') throw new Error('地图游玩进度包含未知或重复设施');
    if (error.code === 'coordinates' || error.code === 'rotation') throw new Error('地图游玩进度的坐标或旋转方向无效');
    throw new Error(`地图游玩进度无效：${error.message}`);
  }
  return placements;
}

export function upsertLocalMap(maps: LocalMap[], draft: SandboxDraft, progress: readonly Placement[] = [], existingId?: number, survival?: SurvivalMapInfo): { maps: LocalMap[]; saved: LocalMap } {
  const code = encodeMap(draft);
  const restored = decodeMap(code), savedProgress = validateLocalMapProgress(restored, progress);
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
