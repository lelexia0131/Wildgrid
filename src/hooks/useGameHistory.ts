import { useCallback, useState } from 'react';
import type { Level, Placement } from '../game/types';

export type Snapshot = { level: Level; placements: Placement[] };
export type GameHistory = { past: Snapshot[]; present: Snapshot; future: Snapshot[] };

export function useGameHistory(initial: () => Snapshot, onChange: () => void, onRestore: () => void, onAction?: (type: 'undo' | 'redo') => void) {
  const [history, setHistory] = useState<GameHistory>(() => ({ past: [], present: initial(), future: [] }));
  const commit = useCallback((present: Snapshot) => {
    onChange();
    setHistory(h => ({ past: [...h.past.slice(-79), h.present], present, future: [] }));
  }, [onChange]);
  const undo = useCallback(() => {
    if (history.past.length) { onChange(); onAction?.('undo'); }
    setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
    onRestore();
  }, [history.past.length, onChange, onRestore, onAction]);
  const redo = useCallback(() => {
    if (history.future.length) { onChange(); onAction?.('redo'); }
    setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
    onRestore();
  }, [history.future.length, onChange, onRestore, onAction]);
  const restore = useCallback((next: GameHistory) => setHistory(next), []);
  return { history, commit, undo, redo, restore };
}
