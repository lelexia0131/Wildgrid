import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createAdventureHintTask } from '../../workers/workerTasks';
import type { AdventureHint, Level, Placement } from '../../engine';
import type { AdventureHintAction } from '../../game-modes/adventure/adventureBadges';

type Analysis = { key: string; hint?: AdventureHint; stage: number; loading: boolean; error: boolean };
export function useAdventureHints(enabled: boolean, level: Level, placements: readonly Placement[], introduced: readonly string[], requestUse: (action: AdventureHintAction) => Promise<boolean>, revision: number) {
  const task = useMemo(createAdventureHintTask, []);
  const key = useMemo(() => enabled ? JSON.stringify([level, [...placements].sort((a, b) => a.id.localeCompare(b.id)), revision]) : 'disabled', [enabled, level, placements, revision]);
  const access = useRef(requestUse); access.current = requestUse;
  const currentKey = useRef(key); currentKey.current = key;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>({ key, stage: 1, loading: false, error: false });
  const current = analysis.key === key ? analysis : { key, stage: 1, loading: false, error: false };
  useLayoutEffect(() => {
    task.cancel(); setPreview(false);
    setAnalysis({ key, stage: 1, loading: false, error: false });
  }, [key, task]);
  useLayoutEffect(() => { if (!enabled) { setOpen(false); setPreview(false); } }, [enabled]);
  useEffect(() => {
    if (!enabled || !open || current.hint || current.error) return;
    let active = true;
    setAnalysis(value => ({ ...value, loading: true }));
    const fail = () => { if (active) setAnalysis(value => ({ ...value, loading: false, error: true })); };
    try {
      task.start({ level, placements, introduced }, {
        onResult: async hint => {
          if (!active) return;
          const allowed = hint.status === 'ready' || hint.status === 'conflict' ? await access.current(1) : true;
          if (!active) return;
          if (allowed) setAnalysis(value => ({ ...value, hint, loading: false }));
          else { setOpen(false); setAnalysis(value => ({ ...value, loading: false })); }
        },
        onError: fail,
      });
    } catch { fail(); }
    return () => { active = false; task.cancel(); };
  }, [enabled, open, key, current.hint, current.error, task]);
  function close() { setOpen(false); setPreview(false); }
  async function next() {
    if (!current.hint || current.stage >= 3) return;
    const stage = current.stage + 1 as 2 | 3;
    if (await access.current(stage) && currentKey.current === key) setAnalysis(value => ({ ...value, stage }));
  }
  async function showPlacement() {
    if (current.hint?.status !== 'ready' || current.stage !== 3) return;
    if (await access.current('preview') && currentKey.current === key) setPreview(true);
  }
  return {
    open: enabled && open, stage: current.stage, hint: current.hint, loading: current.loading, error: current.error,
    region: enabled && open && current.stage >= 2 && current.hint && 'region' in current.hint ? current.hint.region
      : enabled && open && current.stage >= 2 && current.hint?.status === 'conflict' ? current.hint.cells : [],
    placement: enabled && open && preview && current.stage === 3 && current.hint?.status === 'ready' ? current.hint.placement : undefined,
    show: () => { setOpen(true); }, close,
    next, showPlacement,
    reset: () => { close(); task.cancel(); setAnalysis({ key, stage: 1, loading: false, error: false }); },
    retry: () => setAnalysis(value => ({ ...value, hint: undefined, loading: false, error: false })),
  };
}
