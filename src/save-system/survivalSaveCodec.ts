import { parseRecentMaps } from '../engine/mapNovelty';
import { decodeMap, encodeMap, evaluate, validatePlacements, MAX_HISTORY_STEPS } from '../engine';
import type { Placement, Shape } from '../engine';
import { createSurvivalSave, emptySurvivalProgress } from '../game-modes/survival/survivalChallenge';
import type { SurvivalSave } from '../game-modes/survival/survivalChallenge';
import { SURVIVAL_DIFFICULTIES } from '../game-modes/survival/survivalDifficulty';

const difficultyValid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10;
export function parseSurvivalForWrite(stored: string | null): SurvivalSave {
  let raw;
  try { raw = JSON.parse(stored || 'null'); } catch { throw new Error('挑战存档无法读取，原数据已保留'); }
  const save = parseSurvivalSave(stored);
  if (raw && (raw.version !== 1 || !Array.isArray(raw.completed) || raw.completed.length !== save.completed.length || raw.challenge && !save.challenge || raw.records && (!Array.isArray(raw.records) || raw.records.length > save.records.length))) throw new Error('挑战存档不完整或版本不兼容，原数据已保留');
  if (raw?.challenge && (!Array.isArray(raw.progress?.placements) || raw.progress.placements.length !== save.progress?.placements.length || Array.isArray(raw.progress.past) && Math.min(MAX_HISTORY_STEPS, raw.progress.past.length) !== save.progress?.past.length || Array.isArray(raw.progress.future) && Math.min(MAX_HISTORY_STEPS, raw.progress.future.length) !== save.progress?.future.length)) throw new Error('挑战存档不完整或版本不兼容，原数据已保留');
  return save;
}

export function parseSurvivalSave(stored: string | null): SurvivalSave {
  try {
    const raw = JSON.parse(stored || 'null');
    if (!raw || raw.version !== 1) return createSurvivalSave();
    const save = createSurvivalSave(), seen = new Set<string>();
    for (const entry of Array.isArray(raw.completed) ? raw.completed : []) {
      if (!entry || typeof entry.id !== 'string' || seen.has(entry.id) || !difficultyValid(entry.difficulty) || !Number.isInteger(entry.seed) || !Number.isFinite(entry.at)) continue;
      seen.add(entry.id); save.completed.push(entry);
    }
    for (const entry of Array.isArray(raw.records) ? raw.records : []) {
      if (!entry || typeof entry.id !== 'string' || save.records.some(r => r.id === entry.id) || !difficultyValid(entry.difficulty) || !Number.isInteger(entry.seed)) continue;
      let code: string | undefined, placements: readonly Placement[] = [];
      if (typeof entry.code === 'string') {
        try { const draft = decodeMap(entry.code); code = entry.code; placements = validatePlacements(draft.level, entry.placements, 'recover').placements; } catch { /* Retain record metadata if its map is unavailable. */ }
      }
      save.records.push({ id: entry.id, difficulty: entry.difficulty, seed: entry.seed, startedAt: Number.isFinite(entry.startedAt) ? entry.startedAt : undefined, finishedAt: Number.isFinite(entry.finishedAt) ? entry.finishedAt : undefined, code, placements });
    }
    for (const entry of save.completed) if (!save.records.some(r => r.id === entry.id)) save.records.push({ id: entry.id, difficulty: entry.difficulty, seed: entry.seed, finishedAt: entry.at, placements: [] });
    save.recent = Array.isArray(raw.recent) ? raw.recent.filter((s: unknown) => typeof s === 'string').slice(-40) : [];
    save.recentMaps = parseRecentMaps(raw.recentMaps);
    const c = raw.challenge, p = raw.progress;
    if (c && typeof c.id === 'string' && difficultyValid(c.difficulty) && Number.isInteger(c.seed) && typeof c.code === 'string' && p?.id === c.id && p.status === 'active') {
      try {
      const draft = decodeMap(c.code), spec = SURVIVAL_DIFFICULTIES[c.difficulty - 1];
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
        save.progress = { id: c.id, status: 'active', placements: valid(p.placements), past: Array.isArray(p.past) ? p.past.slice(-MAX_HISTORY_STEPS).map(valid) : [], future: Array.isArray(p.future) ? p.future.slice(0, MAX_HISTORY_STEPS).map(valid) : [], rotations, selectedId: draft.level.pieces.some(piece => piece.id === p.selectedId) ? p.selectedId : null };
      } catch { save.progress = emptySurvivalProgress(c.id); }
      } catch { return save; }
    }
    return save;
  } catch { return createSurvivalSave(); }
}

export function serializeSurvivalSave(save: SurvivalSave): string {
  const c = save.challenge;
  const challenge = c ? { id: c.id, difficulty: c.difficulty, seed: c.seed, startedAt: c.startedAt, code: encodeMap(c.draft), fingerprint: c.fingerprint } : null;
  return JSON.stringify({ ...save, challenge });
}

