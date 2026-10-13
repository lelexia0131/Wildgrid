import { useCallback, useLayoutEffect, useState } from 'react';
import { getLevelById } from '../game/levels';
import { progressForPlay, readSave, writeSave } from '../game/storage';
import type { Placement, Settings } from '../game/types';

export function useAdventureProgress() {
  const [save, setSave] = useState(() => readSave());
  const [saved, setSaved] = useState(true);
  useLayoutEffect(() => { setSaved(writeSave(save)); }, [save]);
  const recordProgress = useCallback((id: number, placements: Placement[]) => {
    setSave(s => ({ ...s, current: id, progress: { ...s.progress, [id]: placements } }));
  }, []);
  function completeLevel(id: number) {
    setSave(s => ({ ...s, completed: [...new Set([...s.completed, id])] }));
  }
  function updateSettings(update: (settings: Settings) => Settings) {
    setSave(s => ({ ...s, settings: update(s.settings) }));
  }
  function getStartSnapshot(id: number, reset = false) {
    const level = getLevelById(id)!;
    return { level, placements: reset ? [] : progressForPlay(save, level) };
  }
  return { save, saved, recordProgress, completeLevel, updateSettings, getStartSnapshot, retrySave: () => setSaved(writeSave(save)) };
}
