import { SURVIVAL_DIFFICULTIES } from './survivalDifficulty';
import { facilityLibrary } from '../../engine/facilityRegistry';
import type { Piece } from '../../engine/types';

export const facilityKey = (piece: Pick<Piece, 'kind' | 'shape'>) => `${piece.kind}_${piece.shape}`;
export const SURVIVAL_FACILITIES = facilityLibrary;
export const MIN_ALLOWED_FACILITIES = [3, 3, 4, 4, 5, 5, 6, 7, 8, 9];
export function facilityRestrictionError(difficulty: number, disabled: readonly string[]): string | null {
  const allowed = facilityLibrary.filter(p => !disabled.includes(facilityKey(p)));
  if (!allowed.some(p => p.kind === 'camp')) return '至少需要保留一种营地';
  if (SURVIVAL_DIFFICULTIES[difficulty - 1]?.multi && !allowed.some(p => p.shape !== 'single')) return '此难度需要多格设施，请至少保留一种多格设施。';
  const min = MIN_ALLOWED_FACILITIES[difficulty - 1];
  if (allowed.length < min) return `${difficulty}难至少需要保留${min}种设施，请调整禁用设施。`;
  return null;
}
export function normalizeDisabled(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && facilityLibrary.some(p => facilityKey(p) === id)))] : [];
}
