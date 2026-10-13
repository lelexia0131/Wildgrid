import { decodeMap, encodeMap } from './sandbox';
import type { SandboxDraft } from './sandbox';
import { evaluate } from './rules';
import { validatePlacements } from './placementValidation';
import type { Placement, Shape } from './types';

export const survivalDifficulties = [
  { min: 4, max: 5, xp: 1, label: '非常简单', bases: [6], multi: 0 },
  { min: 6, max: 7, xp: 3, label: '简单', bases: [15], multi: 1 },
  { min: 8, max: 9, xp: 6, label: '较简单', bases: [16, 17], multi: 2 },
  { min: 9, max: 11, xp: 10, label: '普通', bases: [17, 18, 19, 20], multi: 2 },
  { min: 11, max: 13, xp: 15, label: '中等', bases: [20, 21, 23, 24], multi: 3 },
  { min: 13, max: 14, xp: 25, label: '中等偏难', bases: [23, 24, 25], multi: 4 },
  { min: 14, max: 16, xp: 36, label: '困难', bases: [25, 26, 27], multi: 5 },
  { min: 15, max: 17, xp: 50, label: '很困难', bases: [26, 27, 28], multi: 5 },
  { min: 17, max: 19, xp: 70, label: '极困难', bases: [28, 29, 30], multi: 5 },
  { min: 18, max: 20, xp: 100, label: '最高难度', bases: [29, 30], multi: 6 },
];
export const survivalRanks = [
  { name: '荒野新人', xp: 0 }, { name: '露营学徒', xp: 10 },
  { name: '荒野探索者', xp: 100 }, { name: '资深生存家', xp: 500 }, { name: '荒野传奇', xp: 1000 },
];
export const rankFor = (xp: number) => survivalRanks.reduce((current, rank, i) => xp >= rank.xp ? i : current, 0);
export type SurvivalChallenge = { id: string; difficulty: number; seed: number; startedAt?: number; draft: SandboxDraft; fingerprint: string };
export type SurvivalProgress = { id: string; status: 'active'; placements: Placement[]; past: Placement[][]; future: Placement[][]; rotations: Partial<Record<Shape, number>>; selectedId: string | null };
export type SurvivalCompletion = { id: string; difficulty: number; seed: number; at: number };
export type SurvivalRecord = { id: string; difficulty: number; seed: number; startedAt?: number; finishedAt?: number; code?: string; placements: Placement[] };
export type SurvivalSave = { version: 1; completed: SurvivalCompletion[]; records: SurvivalRecord[]; recent: string[]; challenge: SurvivalChallenge | null; progress: SurvivalProgress | null };
export type SurvivalReward = { earned: number; xp: number; count: number; beforeRank: number; rank: number };
const storageKey = 'wildgrid-survival-v1';
const fresh = (): SurvivalSave => ({ version: 1, completed: [], records: [], recent: [], challenge: null, progress: null });
const difficultyValid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10;
export function survivalTotals(save: SurvivalSave) {
  const counts = survivalDifficulties.map((_, i) => save.completed.filter(c => c.difficulty === i + 1).length);
  return { counts, total: save.completed.length, xp: counts.reduce((sum, count, i) => sum + count * survivalDifficulties[i].xp, 0) };
}
export const emptySurvivalProgress = (id: string): SurvivalProgress => ({ id, status: 'active', placements: [], past: [], future: [], rotations: {}, selectedId: null });
export const survivalFingerprint = (draft: SandboxDraft) => JSON.stringify({ terrain: draft.level.terrain.map(t => `${t.r},${t.c}:${t.kind}`).sort(), pieces: draft.level.pieces.map(p => `${p.kind}_${p.shape}`).sort(), rows: draft.level.rows, cols: draft.level.cols });

export function readSurvivalForWrite(): SurvivalSave {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { throw new Error('挑战存档无法读取，原数据已保留'); }
  const save = readSurvival();
  if (raw && (raw.version !== 1 || !Array.isArray(raw.completed) || raw.completed.length !== save.completed.length || raw.challenge && !save.challenge || raw.records && (!Array.isArray(raw.records) || raw.records.length > save.records.length))) throw new Error('挑战存档不完整或版本不兼容，原数据已保留');
  if (raw?.challenge && (!Array.isArray(raw.progress?.placements) || raw.progress.placements.length !== save.progress?.placements.length || Array.isArray(raw.progress.past) && Math.min(80, raw.progress.past.length) !== save.progress?.past.length || Array.isArray(raw.progress.future) && Math.min(80, raw.progress.future.length) !== save.progress?.future.length)) throw new Error('挑战存档不完整或版本不兼容，原数据已保留');
  return save;
}

export function readSurvival(): SurvivalSave {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!raw || raw.version !== 1) return fresh();
    const save = fresh(), seen = new Set<string>();
    for (const entry of Array.isArray(raw.completed) ? raw.completed : []) {
      if (!entry || typeof entry.id !== 'string' || seen.has(entry.id) || !difficultyValid(entry.difficulty) || !Number.isInteger(entry.seed) || !Number.isFinite(entry.at)) continue;
      seen.add(entry.id); save.completed.push(entry);
    }
    for (const entry of Array.isArray(raw.records) ? raw.records : []) {
      if (!entry || typeof entry.id !== 'string' || save.records.some(r => r.id === entry.id) || !difficultyValid(entry.difficulty) || !Number.isInteger(entry.seed)) continue;
      let code: string | undefined, placements: Placement[] = [];
      if (typeof entry.code === 'string') {
        try { const draft = decodeMap(entry.code); code = entry.code; placements = validatePlacements(draft.level, entry.placements, 'recover').placements; } catch { /* Retain record metadata if its map is unavailable. */ }
      }
      save.records.push({ id: entry.id, difficulty: entry.difficulty, seed: entry.seed, startedAt: Number.isFinite(entry.startedAt) ? entry.startedAt : undefined, finishedAt: Number.isFinite(entry.finishedAt) ? entry.finishedAt : undefined, code, placements });
    }
    for (const entry of save.completed) if (!save.records.some(r => r.id === entry.id)) save.records.push({ id: entry.id, difficulty: entry.difficulty, seed: entry.seed, finishedAt: entry.at, placements: [] });
    save.recent = Array.isArray(raw.recent) ? raw.recent.filter((s: unknown) => typeof s === 'string').slice(-40) : [];
    const c = raw.challenge, p = raw.progress;
    if (c && typeof c.id === 'string' && difficultyValid(c.difficulty) && Number.isInteger(c.seed) && typeof c.code === 'string' && p?.id === c.id && p.status === 'active') {
      try {
      const draft = decodeMap(c.code), spec = survivalDifficulties[c.difficulty - 1];
      if (draft.level.size !== 8 || draft.level.pieces.length < spec.min || draft.level.pieces.length > spec.max || !evaluate(draft.level, draft.placements).won) return save;
      const valid = (value: unknown): Placement[] => {
        const { placements, error } = validatePlacements(draft.level, value);
        if (error) throw new Error('挑战进度损坏');
        return placements;
      };
      save.challenge = { id: c.id, difficulty: c.difficulty, seed: c.seed, startedAt: Number.isFinite(c.startedAt) ? c.startedAt : undefined, draft, fingerprint: c.fingerprint || c.code };
      try {
        const rotations: Partial<Record<Shape, number>> = {};
        for (const shape of ['single', 'domino', 'long', 'el'] as Shape[]) if (Number.isInteger(p.rotations?.[shape]) && p.rotations[shape] >= 0 && p.rotations[shape] <= 3) rotations[shape] = p.rotations[shape];
        save.progress = { id: c.id, status: 'active', placements: valid(p.placements), past: Array.isArray(p.past) ? p.past.slice(-80).map(valid) : [], future: Array.isArray(p.future) ? p.future.slice(0, 80).map(valid) : [], rotations, selectedId: draft.level.pieces.some(piece => piece.id === p.selectedId) ? p.selectedId : null };
      } catch { save.progress = emptySurvivalProgress(c.id); }
      } catch { return save; }
    }
    return save;
  } catch { return fresh(); }
}

export function writeSurvival(save: SurvivalSave): void {
  readSurvivalForWrite();
  const c = save.challenge;
  const challenge = c ? { id: c.id, difficulty: c.difficulty, seed: c.seed, startedAt: c.startedAt, code: encodeMap(c.draft), fingerprint: c.fingerprint } : null;
  try { localStorage.setItem(storageKey, JSON.stringify({ ...save, challenge })); }
  catch { throw new Error('挑战保存失败，请检查本地存储空间或权限后重试'); }
}

export function archiveSurvival(save: SurvivalSave, challenge: SurvivalChallenge, placements: Placement[], finishedAt?: number): void {
  if (save.records.some(r => r.id === challenge.id && r.finishedAt !== undefined)) return;
  const record: SurvivalRecord = { id: challenge.id, difficulty: challenge.difficulty, seed: challenge.seed, startedAt: challenge.startedAt, finishedAt, code: encodeMap(challenge.draft), placements: structuredClone(placements) };
  save.records = [...save.records.filter(r => r.id !== challenge.id), record];
}

// Completion, reward ledger and removal of the unfinished challenge share one
// localStorage write. Read the latest ledger so repeated callbacks cannot reward twice.
export function completeSurvival(challenge: SurvivalChallenge, placements: Placement[]): { save: SurvivalSave; reward: SurvivalReward } {
  if (!evaluate(challenge.draft.level, placements).won) throw new Error('挑战尚未完成');
  const save = readSurvivalForWrite(), before = survivalTotals(save).xp;
  const earned = save.completed.some(c => c.id === challenge.id) ? 0 : survivalDifficulties[challenge.difficulty - 1].xp;
  if (earned && save.challenge?.id !== challenge.id) throw new Error('挑战已结束，无法继续挑战');
  if (earned) {
    const at = Date.now();
    archiveSurvival(save, challenge, placements, at);
    save.completed.push({ id: challenge.id, difficulty: challenge.difficulty, seed: challenge.seed, at });
  }
  if (save.challenge?.id === challenge.id) { save.challenge = null; save.progress = null; }
  writeSurvival(save);
  const totals = survivalTotals(save);
  return { save, reward: { earned, xp: totals.xp, count: totals.counts[challenge.difficulty - 1], beforeRank: rankFor(before), rank: rankFor(totals.xp) } };
}
