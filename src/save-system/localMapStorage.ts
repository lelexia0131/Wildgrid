import { parseLocalMapsForWrite, parseLocalMapsSave, serializeLocalMaps } from './localMapSaveCodec';
import { removeLocalMap, renameLocalMapEntry, setLocalMapEntryIcon, unlockSurvivalMapEntries, upsertLocalMap } from '../game-modes/sandbox/localMapCollection';
import type { LocalMap, SurvivalMapInfo } from '../game-modes/sandbox/localMapCollection';
import type { MapIconId } from '../game-modes/sandbox/mapIcons';
import type { Placement, SandboxDraft } from '../engine';
import { readSurvival } from './survivalStorage';

const STORAGE_KEY = 'wildgrid-local-maps-v1';
export function readLocalMaps(): LocalMap[] {
  try { return parseLocalMapsSave(localStorage.getItem(STORAGE_KEY), readSurvival()); } catch { return []; }
}
function readMapsForWrite(): LocalMap[] {
  let stored;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { throw new Error('本地地图无法读取，原数据已保留'); }
  return parseLocalMapsForWrite(stored, readSurvival());
}
function writeLocalMaps(maps: LocalMap[]) {
  const stored = serializeLocalMaps(maps);
  try { localStorage.setItem(STORAGE_KEY, stored); } catch { throw new Error('本地地图保存失败，请检查存储空间或本地存储权限后重试'); }
}
export function saveLocalMap(draft: SandboxDraft, progress: readonly Placement[] = [], existingId?: number, survival?: SurvivalMapInfo): LocalMap {
  const result = upsertLocalMap(readMapsForWrite(), draft, progress, existingId, survival);
  writeLocalMaps(result.maps);
  return result.saved;
}
export function unlockSurvivalMaps(challengeId: string): void {
  const maps = readMapsForWrite(), next = unlockSurvivalMapEntries(maps, challengeId);
  if (next !== maps) writeLocalMaps(next);
}
export function deleteLocalMap(id: number): boolean {
  const maps = readMapsForWrite(), next = removeLocalMap(maps, id);
  if (next === maps) return false;
  writeLocalMaps(next);
  return true;
}
export function renameLocalMap(id: number, name: string): void {
  writeLocalMaps(renameLocalMapEntry(readMapsForWrite(), id, name));
}
export function setLocalMapIcon(id: number, icon: MapIconId): void {
  writeLocalMaps(setLocalMapEntryIcon(readMapsForWrite(), id, icon));
}
