import { analyzeAdventureHint } from '../engine';
import type { HintRequest } from '../engine';

self.onmessage = (event: MessageEvent<HintRequest>) => self.postMessage(analyzeAdventureHint(event.data));
