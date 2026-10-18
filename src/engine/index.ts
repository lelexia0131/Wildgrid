// Public Wildgrid Engine contract. Internal modules import each other directly.
export * from './types';
export { facilities, facilityRegistry, facilityLibrary, facilityNames, facilityTips, shapeNames, terrainNames } from './facilityRegistry';
export type { FacilityDefinition } from './facilityRegistry';
export { levels, solutions, getLevelById, getSolution } from './levels';
export { key, adjacent, offsets, occupied, rotateAround, placementBlock, evaluate } from './rules';
export { validatePlacements } from './placementValidation';
export type { PlacementValidationError, PlacementValidationResult } from './placementValidation';
export { placementHints } from './placementHints';
export { solveLevel, countSolutions } from './solver';
export type { SolverResult } from './solver';
export { createSandbox, withEditorPlacements, checkSandbox, encodeMap, decodeMap } from './sandbox';
export type { SandboxDraft, SandboxCheck } from './sandbox';
export { generateSurvival, survivalGenerationTimeout } from './survivalGenerator';
export * from './mapIcons';
export * from './session';
export * from './adventure';
export * from './survival';
export * from './localMaps';
