import { generateSurvival } from '../game-modes/survival/survivalChallenge';
import { MapGenerationSearchError } from '../engine';
import type { SurvivalGenerationRequest, SurvivalGenerationResult } from './survivalProtocol';
self.onmessage = (event: MessageEvent<SurvivalGenerationRequest>) => {
  let result: SurvivalGenerationResult;
  try { result = { status: 'success', challenge: generateSurvival(event.data.difficulty, event.data.seed, event.data.id, event.data.recent, event.data.disabled, event.data.history, event.data.budgetMs) }; }
  catch (cause) { result = { status: cause instanceof MapGenerationSearchError ? 'search-failed' : 'error', error: cause instanceof Error ? cause.message : '地图生成失败，请重试' }; }
  self.postMessage(result);
};
