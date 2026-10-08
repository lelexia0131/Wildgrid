import { generateSurvival } from './survivalGenerator';
self.onmessage = (event: MessageEvent<{ difficulty: number; seed: number; id: string; recent: string[] }>) => {
  try { self.postMessage({ challenge: generateSurvival(event.data.difficulty, event.data.seed, event.data.id, event.data.recent) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : '地图生成失败，请重试' }); }
};
