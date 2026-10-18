import { useCallback, useLayoutEffect, useState } from 'react';
import { adventureStartSnapshot, completeAdventureLevel, recordAdventureProgress } from '../engine';
import { readSave, writeSave } from '../game/storage';
import type { Placement, Settings } from '../engine';
import { audio } from '../game/audio';

export function useAdventureProgress() {
  const [save, setSave] = useState(() => readSave());
  const [saved, setSaved] = useState(true);
  useLayoutEffect(() => { setSaved(writeSave(save)); }, [save]);
  const recordProgress = useCallback((id: number, placements: Placement[]) => {
    setSave(s => recordAdventureProgress(s, id, placements));
  }, []);
  function completeLevel(id: number) {
    setSave(s => completeAdventureLevel(s, id));
  }
  function updateSettings(update: (settings: Settings) => Settings) {
    setSave(s => ({ ...s, settings: update(s.settings) }));
  }
  function getStartSnapshot(id: number, reset = false) {
    return adventureStartSnapshot(save, id, reset);
  }
  return { save, saved, recordProgress, completeLevel, updateSettings, getStartSnapshot, retrySave: () => { const result = writeSave(save); setSaved(result); audio.feedback(result ? 'success' : 'error'); } };
}
