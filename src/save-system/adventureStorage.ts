import { adventureSaveWritable, createAdventureSave, parseAdventureSave } from './adventureSaveCodec';
import type { Level } from '../engine';
import type { AdventureSave } from '../game-modes/adventure/adventureProgress';

const STORAGE_KEY = 'wildgrid-save-v1';
let readFailed = false;
export function readSave(levels?: readonly Level[]): AdventureSave {
  try {
    const save = parseAdventureSave(localStorage.getItem(STORAGE_KEY), levels);
    readFailed = false;
    return save;
  } catch { readFailed = true; return createAdventureSave(); }
}
export function writeSave(save: AdventureSave) {
  if (readFailed) return false;
  try {
    // Never replace an unreadable or newer save with readSave's fallback.
    if (!adventureSaveWritable(localStorage.getItem(STORAGE_KEY))) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); return true;
  } catch { return false; }
}
