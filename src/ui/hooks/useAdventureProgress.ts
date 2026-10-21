import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { adventureStartSnapshot, completeAdventureLevel, recordAdventureHint, recordAdventureProgress, restartAdventureLevel } from '../../game-modes/adventure/adventureProgress';
import type { AdventureSave } from '../../game-modes/adventure/adventureProgress';
import type { AdventureHintAction } from '../../game-modes/adventure/adventureBadges';
import { readSave, writeSave } from '../../save-system/adventureStorage';
import type { Placement, Settings } from '../../engine';
import { audio } from '../../platform/audio/WildernessAudio';

export function useAdventureProgress() {
  const [save, setSave] = useState(() => readSave());
  const current = useRef(save);
  const [saved, setSaved] = useState(true);
  useLayoutEffect(() => { setSaved(writeSave(current.current)); }, []);
  // Read-modify-write once per action. The ref also makes duplicate completion
  // callbacks idempotent before React has rendered the previous update.
  const commit = useCallback((update: (previous: AdventureSave) => AdventureSave) => {
    const previous = current.current, next = update(previous);
    if (next !== previous) { current.current = next; setSave(next); setSaved(writeSave(next)); }
    return next;
  }, []);
  const recordProgress = useCallback((id: number, placements: readonly Placement[]) => {
    commit(s => recordAdventureProgress(s, id, placements));
  }, [commit]);
  function completeLevel(id: number) {
    const first = !current.current.completed.includes(id);
    const next = commit(s => completeAdventureLevel(s, id));
    return { first, tier: next.badges[id] };
  }
  function updateSettings(update: (settings: Settings) => Settings) {
    commit(s => ({ ...s, settings: update(s.settings) }));
  }
  function getStartSnapshot(id: number, reset = false) {
    return adventureStartSnapshot(current.current, id, reset);
  }
  return { save, saved, recordProgress, completeLevel, updateSettings, getStartSnapshot,
    recordHint: (id: number, placements: readonly Placement[], action: AdventureHintAction) => { commit(s => recordAdventureHint(s, id, placements, action)); },
    restartLevel: (id: number) => { commit(s => restartAdventureLevel(s, id)); },
    retrySave: () => { const result = writeSave(current.current); setSaved(result); audio.feedback(result ? 'success' : 'error'); } };
}
