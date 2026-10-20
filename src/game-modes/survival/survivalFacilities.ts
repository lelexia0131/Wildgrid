import { facilityLibrary } from '../../engine';
import type { Piece } from '../../engine';

export const facilityKey = (piece: Pick<Piece, 'kind' | 'shape'>) => `${piece.kind}_${piece.shape}`;
export const SURVIVAL_FACILITIES = facilityLibrary;
export { MIN_ALLOWED_FACILITIES, facilityRestrictionError } from '../../engine';
export function normalizeDisabled(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && facilityLibrary.some(p => facilityKey(p) === id)))] : [];
}
