import { createSurvivalSave, settleSurvival } from '../game-modes/survival/survivalChallenge';
import { parseSurvivalForWrite, parseSurvivalSave, serializeSurvivalSave } from './survivalSaveCodec';
import type { Placement } from '../engine';
import type { SurvivalChallenge, SurvivalReward, SurvivalSave } from '../game-modes/survival/survivalChallenge';

const STORAGE_KEY = 'wildgrid-survival-v1';
export function readSurvivalForWrite(): SurvivalSave {
  let stored;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { throw new Error('挑战存档无法读取，原数据已保留'); }
  return parseSurvivalForWrite(stored);
}
export function readSurvival(): SurvivalSave {
  try { return parseSurvivalSave(localStorage.getItem(STORAGE_KEY)); } catch { return createSurvivalSave(); }
}
export function writeSurvival(save: SurvivalSave): void {
  readSurvivalForWrite();
  const stored = serializeSurvivalSave(save);
  try { localStorage.setItem(STORAGE_KEY, stored); }
  catch { throw new Error('挑战保存失败，请检查本地存储空间或权限后重试'); }
}
export function completeSurvival(challenge: SurvivalChallenge, placements: readonly Placement[]): { save: SurvivalSave; reward: SurvivalReward } {
  const settled = settleSurvival(readSurvivalForWrite(), challenge, placements, Date.now());
  writeSurvival(settled.save);
  return settled;
}
