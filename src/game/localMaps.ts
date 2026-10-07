import { placementBlock } from './rules';
import { decodeMap, encodeMap } from './sandbox';
import type { SandboxDraft } from './sandbox';
import type { Placement } from './types';

export type LocalMap = { id: number; name: string; customName?: string; draft: SandboxDraft; progress: Placement[] };
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
  for (const entry of value.maps) {
    if (!object(entry) || typeof entry.id !== 'number' || !Number.isSafeInteger(entry.id) || entry.id < 1 || maps.some(map => map.id === entry.id) || typeof entry.code !== 'string') continue;
    try {
      const draft = decodeMap(entry.code);
      const customName = typeof entry.customName === 'string' ? entry.customName.trim() : '';
      maps.push({ id: entry.id, name: '', ...(customName ? { customName } : {}), draft, progress: validateProgress(draft, entry.progress) });
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
  const entries = maps.map(map => ({ id: map.id, customName: map.customName, code: encodeMap(map.draft), progress: map.progress }));
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, maps: entries })); } catch { throw new Error('本地地图保存失败，请检查存储空间或本地存储权限后重试'); }
}

export function saveLocalMap(draft: SandboxDraft, progress: Placement[] = [], existingId?: number): LocalMap {
  const code = encodeMap(draft);
  const restored = decodeMap(code), savedProgress = validateProgress(restored, progress);
  const maps = readMapsForWrite();
  if (existingId !== undefined && !maps.some(map => map.id === existingId)) throw new Error('要保存的本地地图存档不存在');
  const id = existingId ?? Math.max(0, ...maps.map(map => map.id)) + 1;
  if (!Number.isSafeInteger(id)) throw new Error('本地地图存档编号已超出范围');
  const existing = maps.find(map => map.id === id);
  const saved = { id, name: existing?.name || `本地地图${maps.length + 1}`, ...(existing?.customName ? { customName: existing.customName } : {}), draft: restored, progress: savedProgress };
  writeLocalMaps([...maps.filter(map => map.id !== id), saved]);
  return saved;
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
