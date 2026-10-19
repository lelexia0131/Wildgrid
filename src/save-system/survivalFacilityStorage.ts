import { normalizeDisabled } from '../game-modes/survival/survivalFacilities';

const KEY = 'wildgrid-survival-disabled-v1';
export function readDisabledFacilities(): string[] {
  try { return normalizeDisabled(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; }
}
export function writeDisabledFacilities(disabled: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(normalizeDisabled(disabled))); }
  catch { throw new Error('禁用设施保存失败，请重试'); }
}
