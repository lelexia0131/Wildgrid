import type { MapFeatures } from '../engine';
import type { SurvivalChallenge } from '../game-modes/survival/survivalChallenge';

export type SurvivalGenerationRequest = { difficulty: number; seed: number; id: string; recent: string[]; disabled?: string[]; history?: MapFeatures[]; budgetMs?: number };
export type SurvivalGenerationResult = { status: 'success'; challenge: SurvivalChallenge } | { status: 'search-failed' | 'error'; error: string };
