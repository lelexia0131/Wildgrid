// Public Wildgrid Engine contract. Internal modules import each other directly.
export type { TerrainKind, GameMode, FacilityKind, Shape, Status, Cell, Terrain, Piece, Placement, Level, Snapshot, Issue, Settings } from './types';
export { facilities, facilityLibrary, facilityNames, facilityTips, shapeNames, terrainNames } from './facilityRegistry';
export type { FacilityDefinition } from './facilityRegistry';
export { levels, solutions, getLevelById, getSolution } from './levels';
export { key, adjacent, offsets, occupied, placementOrigin, rotateAround } from './boardGeometry';
export { placementBlock, evaluate } from './placementRules';
export { validatePlacements } from './placementValidation';
export type { PlacementValidationError, PlacementValidationResult } from './placementValidation';
export { placementHints } from './placementHints';
export { solveLevel, countSolutions } from './solver';
export type { SolverResult } from './solver';
export { createSandbox, withEditorPlacements, checkSandbox, encodeMap, decodeMap } from './mapBlueprint';
export type { SandboxDraft, SandboxCheck } from './mapBlueprint';
export { generateMap, MAP_GENERATION_TIMEOUT, generationBudget } from './mapGeneration';
export type { MapGenerationSpec } from './mapGeneration';
export { MAX_HISTORY_STEPS, createSession, dispatch, getState, getAvailableActions } from './gameSession';
export type { GameSession, GameCommand, GameEvent, CommandResult } from './gameSession';
