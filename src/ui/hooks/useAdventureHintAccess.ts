import { useLayoutEffect, useRef, useState } from 'react';
import { ADVENTURE_HINT_COSTS, adventureHintBoardKey, adventureHintUsage, evaluateAdventureBadge } from '../../game-modes/adventure/adventureBadges';
import type { AdventureBadgeTier, AdventureHintAction } from '../../game-modes/adventure/adventureBadges';
import { recordAdventureHint } from '../../game-modes/adventure/adventureProgress';
import type { AdventureSave } from '../../game-modes/adventure/adventureProgress';
import type { Level, Placement } from '../../engine/types';

export type HintBadgeConfirmation = { from: AdventureBadgeTier; to: AdventureBadgeTier; cost: number };
export function useAdventureHintAccess(enabled: boolean, save: AdventureSave, level: Level, placements: readonly Placement[], record: (id: number, placements: readonly Placement[], action: AdventureHintAction) => void) {
  const levelId = level.id;
  const context = JSON.stringify([enabled, levelId, save.attempts[levelId]?.revision ?? 0, adventureHintBoardKey(level, placements)]);
  const currentContext = useRef(context); currentContext.current = context;
  const request = useRef<{ context: string; grant: () => void; resolve: (allowed: boolean) => void } | null>(null);
  const [pending, setPending] = useState<HintBadgeConfirmation | null>(null);
  function finish(allowed: boolean) {
    const previous = request.current; request.current = null; setPending(null);
    if (previous) {
      const accepted = allowed && previous.context === currentContext.current;
      if (accepted) previous.grant();
      previous.resolve(accepted);
    }
  }
  useLayoutEffect(() => () => { request.current?.resolve(false); request.current = null; }, []);
  useLayoutEffect(() => { if (request.current && request.current.context !== context) finish(false); }, [context]);
  function requestUse(action: AdventureHintAction): Promise<boolean> {
    if (!enabled) return Promise.resolve(false);
    const next = recordAdventureHint(save, levelId, placements, action);
    if (next === save) return Promise.resolve(true);
    const from = evaluateAdventureBadge(adventureHintUsage(save.attempts[levelId]));
    const to = evaluateAdventureBadge(adventureHintUsage(next.attempts[levelId]));
    const grant = () => record(levelId, placements, action);
    if (from === to) { grant(); return Promise.resolve(true); }
    finish(false);
    return new Promise(resolve => {
      request.current = { context, grant, resolve };
      setPending({ from, to, cost: ADVENTURE_HINT_COSTS[action] });
    });
  }
  return { pending, requestUse, confirm: () => finish(true), cancel: () => finish(false) };
}
