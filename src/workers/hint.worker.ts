import { analyzeAdventureHint } from '../engine/adventureHints';
import type { HintRequest } from '../engine/adventureHints';

self.onmessage = (event: MessageEvent<HintRequest>) => self.postMessage(analyzeAdventureHint(event.data));
