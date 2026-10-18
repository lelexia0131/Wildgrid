import { createSurvivalSave, parseSurvivalForWrite, parseSurvivalSave, serializeSurvivalSave, settleSurvival } from '../engine';
import type { Placement, SurvivalChallenge, SurvivalReward, SurvivalSave } from '../engine';
export type { SurvivalChallenge, SurvivalProgress, SurvivalCompletion, SurvivalRecord, SurvivalSave, SurvivalReward } from '../engine';

const storageKey = 'wildgrid-survival-v1';
export function readSurvivalForWrite(): SurvivalSave {
  let stored;
  try { stored = localStorage.getItem(storageKey); } catch { throw new Error('挑战存档无法读取，原数据已保留'); }
  return parseSurvivalForWrite(stored);
}
export function readSurvival(): SurvivalSave {
  try { return parseSurvivalSave(localStorage.getItem(storageKey)); } catch { return createSurvivalSave(); }
}
export function writeSurvival(save: SurvivalSave): void {
  readSurvivalForWrite();
  const stored = serializeSurvivalSave(save);
  try { localStorage.setItem(storageKey, stored); }
  catch { throw new Error('挑战保存失败，请检查本地存储空间或权限后重试'); }
}
export function completeSurvival(challenge: SurvivalChallenge, placements: Placement[]): { save: SurvivalSave; reward: SurvivalReward } {
  const settled = settleSurvival(readSurvivalForWrite(), challenge, placements, Date.now());
  writeSurvival(settled.save);
  return settled;
}
