import { useCallback, useRef, useState } from 'react';
import { createSession, dispatch } from '../engine';
import type { Snapshot } from '../engine';

export function useGameHistory(initial: () => Snapshot, onChange: () => void, onRestore: () => void, onAction?: (type: 'undo' | 'redo') => void) {
  const [history, setHistory] = useState(() => createSession({ mode: 'adventure', present: initial() }));
  const current = useRef(history);
  const execute = useCallback((command: Parameters<typeof dispatch>[1]) => {
    const outcome = dispatch(current.current, command);
    if (outcome.session !== current.current) {
      onChange(); current.current = outcome.session; setHistory(outcome.session);
    }
    return outcome;
  }, [onChange]);
  const undo = useCallback(() => {
    const before = current.current;
    if (execute({ type: 'undo' }).session !== before) onAction?.('undo');
    onRestore();
  }, [execute, onRestore, onAction]);
  const redo = useCallback(() => {
    const before = current.current;
    if (execute({ type: 'redo' }).session !== before) onAction?.('redo');
    onRestore();
  }, [execute, onRestore, onAction]);
  const restore = useCallback((config: Parameters<typeof createSession>[0]) => {
    const next = createSession(config); current.current = next; setHistory(next);
  }, []);
  return { history, dispatch: execute, undo, redo, restore };
}
