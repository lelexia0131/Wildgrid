import { key, occupied, placementBlock } from './rules';
import type { Level, Placement } from './types';

export type PlacementValidationError = {
  code: 'array' | 'unknown' | 'duplicate' | 'coordinates' | 'rotation' | 'bounds' | 'terrain' | 'overlap';
  id?: string;
  otherId?: string;
  message?: string;
};
export type PlacementValidationResult = { placements: Placement[]; error: PlacementValidationError | null };

// Save recovery skips damaged records; imported maps and challenge histories
// require every record to be valid. Gameplay relationships remain editable.
export function validatePlacements(level: Level, value: unknown, mode: 'strict' | 'recover' = 'strict'): PlacementValidationResult {
  if (!Array.isArray(value)) return { placements: [], error: { code: 'array' } };
  const placements: Placement[] = [], seen = new Set<string>();
  let firstError: PlacementValidationError | null = null;
  for (const entry of value) {
    const at = entry as Partial<Placement> | null;
    const piece = at && typeof at === 'object' && !Array.isArray(at) && typeof at.id === 'string' ? level.pieces.find(piece => piece.id === at.id) : undefined;
    let error: PlacementValidationError | null = null;
    if (!at || !piece) error = { code: 'unknown' };
    else if (seen.has(piece.id)) error = { code: 'duplicate', id: piece.id };
    else if (typeof at.r !== 'number' || typeof at.c !== 'number' || ![at.r, at.c].every(Number.isInteger) || at.r < 0 || at.c < 0 || at.r >= level.size || at.c >= level.size) error = { code: 'coordinates', id: piece.id };
    else if (typeof at.rotation !== 'number' || !Number.isInteger(at.rotation) || at.rotation < 0 || at.rotation > 3) error = { code: 'rotation', id: piece.id };
    else {
      const placement = { id: piece.id, r: at.r, c: at.c, rotation: at.rotation };
      const message = placementBlock(level, placements, placement);
      if (message) {
        // Classify the rules module's rejection for mode-specific error text.
        const cells = occupied(piece, placement);
        if (cells.some(cell => cell.r < 0 || cell.c < 0 || cell.r >= level.size || cell.c >= level.size)) error = { code: 'bounds', id: piece.id, message };
        else if (cells.some(cell => level.terrain.some(terrain => key(cell) === key(terrain)))) error = { code: 'terrain', id: piece.id, message };
        else {
          const other = placements.find(other => occupied(level.pieces.find(item => item.id === other.id)!, other).some(cell => cells.some(candidate => key(cell) === key(candidate))));
          error = { code: 'overlap', id: piece.id, otherId: other?.id, message };
        }
      } else {
        seen.add(piece.id);
        placements.push(mode === 'recover' ? entry as Placement : placement);
      }
    }
    if (error) {
      firstError ||= error;
      if (mode === 'strict') return { placements, error };
    }
  }
  return { placements, error: firstError };
}
