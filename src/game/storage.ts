import { adventureSaveWritable, createAdventureSave, parseAdventureSave } from '../engine';
import type { Level, Save } from '../engine';
export type { Save } from '../engine';

const storageKey = 'wildgrid-save-v1';
let readFailed = false;
export function readSave(levels?: Level[]): Save {
  try {
    const save = parseAdventureSave(localStorage.getItem(storageKey), levels);
    readFailed = false;
    return save;
  } catch { readFailed = true; return createAdventureSave(); }
}
export function writeSave(save: Save) {
  if (readFailed) return false;
  try {
    // Never replace an unreadable or newer save with readSave's fallback.
    if (!adventureSaveWritable(localStorage.getItem(storageKey))) return false;
    localStorage.setItem(storageKey, JSON.stringify(save)); return true;
  } catch { return false; }
}
