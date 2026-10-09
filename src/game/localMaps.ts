import { placementBlock } from './rules';
import { decodeMap, encodeMap } from './sandbox';
import type { SandboxDraft } from './sandbox';
import type { Placement } from './types';
import { readSurvival } from './survival';

export type SurvivalMapInfo = { challengeId: string; difficulty: number; seed: number; completed: boolean; blueprintUnlocked: boolean };
export type LocalMap = { id: number; name: string; customName?: string; draft: SandboxDraft; progress: Placement[]; source?: 'survival'; survival?: SurvivalMapInfo };
const storageKey = 'wildgrid-local-maps-v1';
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function validateProgress(draft: SandboxDraft, value: unknown): Placement[] {
  if (!Array.isArray(value) || value.length > draft.level.pieces.length) throw new Error('地图游玩进度不完整');
  const progress: Placement[] = [], seen = new Set<string>();
  for (const at of value) {
    if (!object(at) || typeof at.id !== 'string' || !draft.level.pieces.some(piece => piece.id === at.id) || seen.has(at.id)) throw new Error('地图游玩进度包含未知或重复设施');
    if (typeof at.r !== 'number' || typeof at.c !== 'number' || typeof at.rotation !== 'number' || ![at.r, at.c, at.rotation].every(Number.isInteger) || at.r < 0 || at.c < 0 || at.r >= draft.level.size || at.c >= draft.level.size || at.rotation < 0 || at.rotation > 3) throw new Error('地图游玩进度的坐标或旋转方向无效');
    const placement = { id: at.id, r: at.r, c: at.c, rotation: at.rotation };
    const blocked = placementBlock(draft.level, progress, placement);
    if (blocked) throw new Error(`地图游玩进度无效：${blocked}`);
    seen.add(at.id);
    progress.push(placement);
  }
  return progress;
}

function parseLocalMaps(raw: string | null): LocalMap[] {
  let value: unknown;
  try { value = JSON.parse(raw || 'null'); } catch { return []; }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.maps)) return [];
  const maps: LocalMap[] = [];
  const survivalSave = readSurvival(), completed = new Set(survivalSave.completed.map(c => c.id));
  for (const entry of value.maps) {
    if (!object(entry) || typeof entry.id !== 'number' || !Number.isSafeInteger(entry.id) || entry.id < 1 || maps.some(map => map.id === entry.id) || typeof entry.code !== 'string') continue;
    try {
      const draft = decodeMap(entry.code);
      const customName = typeof entry.customName === 'string' ? entry.customName.trim() : '';
      const info = entry.survival;
      if (entry.source === 'survival' && (!object(info) || typeof info.challengeId !== 'string' || typeof info.difficulty !== 'number' || !Number.isInteger(info.difficulty) || info.difficulty < 1 || info.difficulty > 10 || typeof info.seed !== 'number' || !Number.isInteger(info.seed))) continue;
      const survival = entry.source === 'survival' && object(info) ? { challengeId: info.challengeId as string, difficulty: info.difficulty as number, seed: info.seed as number, completed: completed.has(info.challengeId as string) || info.completed === true, blueprintUnlocked: completed.has(info.challengeId as string) || info.blueprintUnlocked === true || survivalSave.challenge?.id !== info.challengeId } : undefined;
      maps.push({ id: entry.id, name: '', ...(customName ? { customName } : {}), draft, progress: validateProgress(draft, entry.progress), ...(survival ? { source: 'survival' as const, survival } : {}) });
    } catch { /* Keep other valid maps when an individual save is damaged. */ }
  }
  return maps.sort((a, b) => a.id - b.id).map((map, index) => ({ ...map, name: map.customName || `本地地图${index + 1}` }));
}

export function readLocalMaps(): LocalMap[] {
  try { return parseLocalMaps(localStorage.getItem(storageKey)); } catch { return []; }
}

function readMapsForWrite(): LocalMap[] {
  try { return parseLocalMaps(localStorage.getItem(storageKey)); } catch { throw new Error('无法读取本地地图，请检查本地存储权限后重试'); }
}

function writeLocalMaps(maps: LocalMap[]) {
  const entries = maps.map(map => ({ id: map.id, customName: map.customName, code: encodeMap(map.draft), progress: map.progress, source: map.source, survival: map.survival }));
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, maps: entries })); } catch { throw new Error('本地地图保存失败，请检查存储空间或本地存储权限后重试'); }
}

export function saveLocalMap(draft: SandboxDraft, progress: Placement[] = [], existingId?: number, survival?: SurvivalMapInfo): LocalMap {
  const code = encodeMap(draft);
  const restored = decodeMap(code), savedProgress = validateProgress(restored, progress);
  const maps = readMapsForWrite();
  if (existingId !== undefined && !maps.some(map => map.id === existingId)) throw new Error('要保存的本地地图存档不存在');
  const id = existingId ?? Math.max(0, ...maps.map(map => map.id)) + 1;
  if (!Number.isSafeInteger(id)) throw new Error('本地地图存档编号已超出范围');
  const existing = maps.find(map => map.id === id);
  const sameOriginal = !existing || encodeMap(existing.draft) === code;
  if (existing?.survival && !existing.survival.blueprintUnlocked && !sameOriginal) throw new Error('通关或放弃挑战后才能编辑荒野求生地图');
  const info = survival || (sameOriginal ? existing?.survival : undefined);
  const saved: LocalMap = { id, name: existing?.name || `本地地图${maps.length + 1}`, ...(existing?.customName ? { customName: existing.customName } : {}), draft: restored, progress: savedProgress, ...(info ? { source: 'survival', survival: info } : {}) };
  writeLocalMaps([...maps.filter(map => map.id !== id), saved]);
  return saved;
}

export function unlockSurvivalMaps(challengeId: string): void {
  const maps = readMapsForWrite();
  if (!maps.some(map => map.survival?.challengeId === challengeId)) return;
  for (const map of maps) if (map.survival?.challengeId === challengeId) map.survival = { ...map.survival, completed: true, blueprintUnlocked: true };
  writeLocalMaps(maps);
}

export function deleteLocalMap(id: number): boolean {
  const maps = readMapsForWrite();
  if (!maps.some(map => map.id === id)) return false;
  writeLocalMaps(maps.filter(map => map.id !== id));
  return true;
}

export function renameLocalMap(id: number, name: string): void {
  const maps = readMapsForWrite();
  const map = maps.find(map => map.id === id);
  if (!map) throw new Error('要编辑的本地地图存档不存在');
  map.customName = name.trim() || undefined;
  writeLocalMaps(maps);
}
