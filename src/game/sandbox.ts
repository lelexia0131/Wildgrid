import data from '../data/levels.json';
import { evaluate, key, occupied, offsets } from './rules';
import { solveLevel } from './solver';
import type { FacilityKind, Level, Piece, Placement, TerrainKind } from './types';

export type SandboxDraft = { level: Level; placements: Placement[] };
export type SandboxCheck = { status: 'unique' | 'multiple' | 'none' | 'invalid'; message: string };

// Stable IDs describe existing kind/shape definitions, independent of display
// names, level order, or the individual instances created by the editor.
export const facilityLibrary: Piece[] = Array.from(new Map((data as Level[]).flatMap(level => level.pieces).map(piece => {
  const id = `${piece.kind}_${piece.shape}`;
  return [id, { id, kind: piece.kind, shape: piece.shape }] as const;
})).values());

const terrainKinds: TerrainKind[] = ['water', 'forest', 'mountain'];
const names: Record<FacilityKind, string> = { camp: '营地', fire: '篝火', tower: '瞭望塔', picnic: '野餐桌', cabin: '林间木屋', foodTruck: '餐车', powerTower: '电塔', pool: '泳池' };
const maxCodeLength = 32768;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const instanceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value) && !['constructor', 'prototype'].includes(value);

export function createSandbox(size: 6 | 8): SandboxDraft {
  if (size !== 6 && size !== 8) throw new Error('地图尺寸只能选择 6×6 或 8×8');
  return { level: { id: 0, name: '自定义地图', chapter: '沙盒模式', tip: '让每一处设施找到合适的位置，完成营地规划。', size, terrain: [], pieces: [], rows: Array<number>(size).fill(0), cols: Array<number>(size).fill(0) }, placements: [] };
}

export function withEditorPlacements(draft: SandboxDraft, placements: Placement[]): SandboxDraft {
  const rows = Array<number>(draft.level.size).fill(0), cols = Array<number>(draft.level.size).fill(0);
  const pieces = draft.level.pieces.filter(piece => placements.some(at => at.id === piece.id));
  for (const at of placements) {
    const piece = pieces.find(p => p.id === at.id);
    if (!piece) continue;
    for (const cell of occupied(piece, at)) if (cell.r >= 0 && cell.c >= 0 && cell.r < draft.level.size && cell.c < draft.level.size) { rows[cell.r]++; cols[cell.c]++; }
  }
  return { level: { ...draft.level, pieces, rows, cols }, placements };
}

function draftError(value: unknown): string | null {
  if (!object(value) || !object(value.level) || !Array.isArray(value.placements)) return '地图数据不完整';
  const level = value.level, placements = value.placements;
  if (level.size !== 6 && level.size !== 8) return '地图尺寸只能选择 6×6 或 8×8';
  const n = level.size;
  if (!integer(level.id, 0, Number.MAX_SAFE_INTEGER) || typeof level.name !== 'string' || typeof level.chapter !== 'string' || typeof level.tip !== 'string') return '地图信息不完整';
  if (!Array.isArray(level.terrain) || !Array.isArray(level.pieces) || !Array.isArray(level.rows) || !Array.isArray(level.cols)) return '地图地形、设施或行列提示数据不完整';
  if (level.terrain.length > n * n || level.pieces.length > n * n || placements.length > n * n) return '地图元素数量超过棋盘可容纳范围';
  if (!level.pieces.length) return '请至少放置一处设施，再进行营地自检';
  if (level.rows.length !== n || level.cols.length !== n || [...level.rows, ...level.cols].some(v => !integer(v, 0, n))) return '行列占格提示不合法';
  const terrainCells = new Set<string>();
  for (const terrain of level.terrain) {
    if (!object(terrain) || !terrainKinds.includes(terrain.kind as TerrainKind)) return '地图包含无法识别的地形';
    if (!integer(terrain.r, 0, n - 1) || !integer(terrain.c, 0, n - 1)) return '地形坐标超出棋盘范围';
    const cell = `${terrain.r},${terrain.c}`;
    if (terrainCells.has(cell)) return '同一格不能设置多个地形';
    terrainCells.add(cell);
  }
  const ids = new Set<string>();
  for (const piece of level.pieces) {
    if (!object(piece) || !instanceId(piece.id)) return '设施编号无效';
    if (!facilityLibrary.some(item => item.kind === piece.kind && item.shape === piece.shape)) return '地图包含无法识别的设施或形状';
    if (ids.has(piece.id)) return '地图中存在重复的设施编号';
    ids.add(piece.id);
  }
  const placed = new Set<string>();
  for (const at of placements) {
    if (!object(at) || !instanceId(at.id) || !ids.has(at.id)) return '放置数据包含未知设施';
    if (placed.has(at.id)) return '同一设施出现了多次放置数据';
    if (!integer(at.r, 0, n - 1) || !integer(at.c, 0, n - 1)) return '设施坐标超出棋盘范围';
    if (!integer(at.rotation, 0, 3)) return '设施旋转方向无效';
    placed.add(at.id);
  }
  if (placed.size !== ids.size) return '请将设施库中已选的设施放入地图，或取消选择';
  const draft = value as SandboxDraft;
  const used = new Map<string, Piece>();
  for (const at of draft.placements) {
    const piece = draft.level.pieces.find(p => p.id === at.id)!;
    for (const cell of occupied(piece, at)) {
      if (cell.r < 0 || cell.c < 0 || cell.r >= n || cell.c >= n) return `${names[piece.kind]}超出棋盘边界`;
      if (terrainCells.has(key(cell))) return `${names[piece.kind]}覆盖了固定地形`;
      const other = used.get(key(cell));
      if (other) return `${names[other.kind]}与${names[piece.kind]}发生重叠`;
      used.set(key(cell), piece);
    }
  }
  const area = draft.level.pieces.reduce((sum, piece) => sum + offsets(piece.shape, 0).length, 0);
  if (draft.level.rows.reduce((a, b) => a + b, 0) !== area || draft.level.cols.reduce((a, b) => a + b, 0) !== area) return '行列占格提示与设施总占格数不一致';
  // Blueprint legality uses the actual gameplay rules; clue feasibility is
  // tested separately by the solver, rather than forcing the blueprint answer.
  const result = evaluate({ ...draft.level, rows: Array<number>(n).fill(n), cols: Array<number>(n).fill(n) }, draft.placements);
  for (const piece of draft.level.pieces) {
    const issue = result.issues[piece.id];
    if (issue.status !== 'VALID') return `${names[piece.kind]}：${issue.reasons[0]}`;
  }
  return null;
}

export function checkSandbox(draft: SandboxDraft): SandboxCheck {
  const error = draftError(draft);
  if (error) return { status: 'invalid', message: `营地自检失败：${error}` };
  const { count } = solveLevel(draft.level, 2);
  if (count === 0) return { status: 'none', message: '营地自检失败：当前关卡无解' };
  if (count >= 2) return { status: 'multiple', message: '营地自检失败：当前关卡存在多个解' };
  return { status: 'unique', message: '营地自检通过：当前关卡存在唯一解' };
}

function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeMap(draft: SandboxDraft): string {
  const error = draftError(draft);
  if (error) throw new Error(error);
  const payload = {
    v: 1, s: draft.level.size,
    t: draft.level.terrain.map(t => [t.kind, t.r, t.c]),
    f: draft.level.pieces.map(piece => {
      const at = draft.placements.find(p => p.id === piece.id)!;
      return [`${piece.kind}_${piece.shape}`, piece.id, at.r, at.c, at.rotation];
    }),
    r: draft.level.rows, c: draft.level.cols,
  };
  return `WG1:${base64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
}

export function decodeMap(input: string): SandboxDraft {
  const invalid = () => new Error('地图代码无效或已损坏');
  if (typeof input !== 'string' || input.length > maxCodeLength) throw invalid();
  const code = input.trim();
  const prefix = /^WG(\d+):/.exec(code);
  if (prefix && prefix[1] !== '1') throw new Error('该地图来自不支持的 Wildgrid 地图版本');
  if (!code.startsWith('WG1:')) throw invalid();
  const encoded = code.slice(4);
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) throw invalid();
  let payload: unknown;
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (base64url(bytes) !== encoded) throw invalid();
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw invalid(); }
  if (!object(payload)) throw invalid();
  if (typeof payload.v === 'number' && payload.v !== 1) throw new Error('该地图来自不支持的 Wildgrid 地图版本');
  if (payload.v !== 1 || Object.keys(payload).some(k => !['v', 's', 't', 'f', 'r', 'c'].includes(k)) || (payload.s !== 6 && payload.s !== 8)) throw invalid();
  if (!Array.isArray(payload.t) || !Array.isArray(payload.f) || payload.t.length > payload.s * payload.s || payload.f.length > payload.s * payload.s) throw invalid();
  const draft = createSandbox(payload.s);
  for (const t of payload.t) {
    if (!Array.isArray(t) || t.length !== 3 || !terrainKinds.includes(t[0]) || !integer(t[1], 0, payload.s - 1) || !integer(t[2], 0, payload.s - 1)) throw invalid();
    draft.level.terrain.push({ kind: t[0], r: t[1], c: t[2] });
  }
  for (const f of payload.f) {
    if (!Array.isArray(f) || f.length !== 5 || !instanceId(f[1]) || !integer(f[2], 0, payload.s - 1) || !integer(f[3], 0, payload.s - 1) || !integer(f[4], 0, 3)) throw invalid();
    const template = facilityLibrary.find(piece => piece.id === f[0]);
    if (!template) throw new Error('地图包含无法识别的设施');
    draft.level.pieces.push({ ...template, id: f[1] });
    draft.placements.push({ id: f[1], r: f[2], c: f[3], rotation: f[4] });
  }
  if (!Array.isArray(payload.r) || !Array.isArray(payload.c) || payload.r.length !== payload.s || payload.c.length !== payload.s || [...payload.r, ...payload.c].some(v => !integer(v, 0, payload.s as number))) throw invalid();
  draft.level.rows = payload.r;
  draft.level.cols = payload.c;
  const error = draftError(draft);
  if (error) throw new Error(`地图代码无效：${error}`);
  return draft;
}
