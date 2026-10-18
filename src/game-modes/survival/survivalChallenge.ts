import { encodeMap, evaluate, generateMap } from '../../engine';
import type { Placement, Shape, SandboxDraft } from '../../engine';
import { rankFor, SURVIVAL_DIFFICULTIES } from './survivalDifficulty';

export type SurvivalChallenge = { id: string; difficulty: number; seed: number; startedAt?: number; draft: SandboxDraft; fingerprint: string };
export type SurvivalProgress = { id: string; status: 'active'; placements: readonly Placement[]; past: readonly (readonly Placement[])[]; future: readonly (readonly Placement[])[]; rotations: Partial<Record<Shape, number>>; selectedId: string | null };
export type SurvivalCompletion = { id: string; difficulty: number; seed: number; at: number };
export type SurvivalRecord = { id: string; difficulty: number; seed: number; startedAt?: number; finishedAt?: number; code?: string; placements: readonly Placement[] };
export type SurvivalSave = { version: 1; completed: SurvivalCompletion[]; records: SurvivalRecord[]; recent: string[]; challenge: SurvivalChallenge | null; progress: SurvivalProgress | null };
export type SurvivalReward = { earned: number; xp: number; count: number; beforeRank: number; rank: number };
export const createSurvivalSave = (): SurvivalSave => ({ version: 1, completed: [], records: [], recent: [], challenge: null, progress: null });
export function survivalTotals(save: SurvivalSave) {
  const counts = SURVIVAL_DIFFICULTIES.map((_, i) => save.completed.filter(c => c.difficulty === i + 1).length);
  return { counts, total: save.completed.length, xp: counts.reduce((sum, count, i) => sum + count * SURVIVAL_DIFFICULTIES[i].xp, 0) };
}
export const emptySurvivalProgress = (id: string): SurvivalProgress => ({ id, status: 'active', placements: [], past: [], future: [], rotations: {}, selectedId: null });

export function generateSurvival(difficulty: number, seed: number, id: string, recent: string[] = []): SurvivalChallenge {
  const spec = SURVIVAL_DIFFICULTIES[difficulty - 1];
  if (!spec) throw new Error('请选择 1难至10难');
  return generateMap(difficulty, seed, id, recent, spec);
}


export function archiveSurvivalRecord(save: SurvivalSave, challenge: SurvivalChallenge, placements: readonly Placement[], finishedAt?: number): SurvivalSave {
  if (save.records.some(r => r.id === challenge.id && r.finishedAt !== undefined)) return save;
  const record: SurvivalRecord = { id: challenge.id, difficulty: challenge.difficulty, seed: challenge.seed, startedAt: challenge.startedAt, finishedAt, code: encodeMap(challenge.draft), placements: structuredClone(placements) };
  return { ...save, records: [...save.records.filter(r => r.id !== challenge.id), record] };
}

// The adapter supplies the latest ledger and persists the returned settlement once.
export function settleSurvival(latest: SurvivalSave, challenge: SurvivalChallenge, placements: readonly Placement[], at: number): { save: SurvivalSave; reward: SurvivalReward } {
  if (!evaluate(challenge.draft.level, placements).won) throw new Error('挑战尚未完成');
  let save = { ...latest, completed: [...latest.completed] };
  const before = survivalTotals(save).xp;
  const earned = save.completed.some(c => c.id === challenge.id) ? 0 : SURVIVAL_DIFFICULTIES[challenge.difficulty - 1].xp;
  if (earned && save.challenge?.id !== challenge.id) throw new Error('挑战已结束，无法继续挑战');
  if (earned) {
    save = archiveSurvivalRecord(save, challenge, placements, at);
    save.completed.push({ id: challenge.id, difficulty: challenge.difficulty, seed: challenge.seed, at });
  }
  if (save.challenge?.id === challenge.id) { save.challenge = null; save.progress = null; }
  const totals = survivalTotals(save);
  return { save, reward: { earned, xp: totals.xp, count: totals.counts[challenge.difficulty - 1], beforeRank: rankFor(before), rank: rankFor(totals.xp) } };
}

export function updateSurvivalProgress(save: SurvivalSave, challengeId: string, progress: Omit<SurvivalProgress, 'id' | 'status'>): SurvivalSave {
  return save.challenge?.id === challengeId ? { ...save, progress: { id: challengeId, status: 'active', ...progress } } : save;
}
export function replaceSurvivalChallenge(save: SurvivalSave, challenge: SurvivalChallenge): SurvivalSave {
  const archived = save.challenge ? archiveSurvivalRecord(save, save.challenge, save.progress?.placements || []) : save;
  return { ...archived, recent: [...archived.recent, challenge.fingerprint].slice(-40), challenge, progress: emptySurvivalProgress(challenge.id) };
}
export function abandonSurvivalChallenge(save: SurvivalSave, challengeId: string | undefined): SurvivalSave {
  if (!save.challenge || save.challenge.id !== challengeId) return save;
  return { ...archiveSurvivalRecord(save, save.challenge, save.progress?.placements || []), challenge: null, progress: null };
}
export function restartSurvivalChallenge(save: SurvivalSave, challenge: SurvivalChallenge): SurvivalSave {
  return save.challenge?.id === challenge.id ? save : { ...save, challenge, progress: emptySurvivalProgress(challenge.id) };
}

