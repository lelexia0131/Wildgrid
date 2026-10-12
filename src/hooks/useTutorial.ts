import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { finishLesson, freshTutorial, matchesAction, readTutorial, resolveTutorial, writeTutorial } from '../game/tutorial';
import type { TutorialEvent, TutorialLesson, TutorialState } from '../game/tutorial';
import type { GameMode, Level, Piece, Placement, Shape } from '../game/types';
import { dictionaries } from '../i18n';

type Options = { screen: string; mode: GameMode; level: Level; placements: Placement[]; selected: Piece | null; rotations: Partial<Record<Shape, number>>; undoAvailable: boolean; won: boolean; paused: boolean; winOpen: boolean };
export function useTutorial({ screen, mode, level, placements, selected, undoAvailable, won, paused, winOpen }: Options) {
  const [state, setState] = useState(readTutorial);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState<'resetReady' | null>(null);
  const [active, setActive] = useState<{ lesson: TutorialLesson; index: number; level: Level; mode: GameMode } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const visible = screen === 'game' && state.enabled && !paused && (!winOpen || active?.lesson.steps[active.index]?.id === 'complete') && active?.level === level && active.mode === mode;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useLayoutEffect(() => { setSaved(writeTutorial(state)); }, [state]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (screen !== 'game' || !state.enabled || active && (active.level !== level || active.mode !== mode)) { setActive(null); return; }
    if (active || paused) return;
    const lesson = resolveTutorial(state, { mode, level, placements, selected, won });
    if (lesson) {
      let index = state.activeStep?.day === level.id ? Math.min(state.activeStep.index, lesson.steps.length - 1) : 0;
      const action = lesson.steps[index].actionCondition;
      if (action?.type === 'place' && placements.some(at => matchesAction(action, { type: 'place', pieceId: at.id, r: at.r, c: at.c, rotation: at.rotation }))) index++;
      else if (((action?.type === 'place' || action?.type === 'rotate') && !selected) || (action?.type === 'undo' && !undoAvailable)) {
        while (index > 0 && lesson.steps[index].actionCondition?.type !== 'select') index--;
      }
      setActive({ lesson, index, level, mode });
      setState(s => ({ ...s, activeStep: { day: level.id, index } }));
    }
  }, [screen, mode, level, placements, selected, undoAvailable, won, paused, state, active]);
  const next = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    if (current.index + 1 < current.lesson.steps.length) {
      setActive({ ...current, index: current.index + 1 });
      setState(s => ({ ...s, activeStep: { day: current.level.id, index: current.index + 1 } }));
    }
    else { setState(s => finishLesson(s, current.lesson)); setActive(null); }
  }, []);
  const onAction = useCallback((event: TutorialEvent) => {
    if (!visibleRef.current) return;
    const current = activeRef.current;
    const step = current?.lesson.steps[current.index];
    if (step?.actionCondition && matchesAction(step.actionCondition, event)) next();
  }, [next]);
  useEffect(() => { onAction({ type: 'pageOpened', value: screen }); }, [screen, onAction]);
  useEffect(() => { if (screen === 'game') onAction({ type: 'modeEntered', value: mode }); }, [screen, mode, onAction]);
  useEffect(() => { if (won) onAction({ type: 'complete' }); }, [won, onAction]);
  function skip() {
    if (!active) return;
    setState(s => {
      return finishLesson(s, active.lesson, true);
    });
    setActive(null);
  }
  function update(updateState: (s: TutorialState) => TutorialState) { setState(updateState); setMessage(null); }
  function reset() { setState(s => freshTutorial(false, s.language)); setActive(null); setMessage('resetReady'); }
  const step = active?.lesson.steps[active.index];
  return { state, saved, message, copy: dictionaries[state.language], active: visible && active && step ? { lesson: active.lesson, step, index: active.index } : null,
    next, back: () => { if (active) { const index = Math.max(0, active.index - 1); setActive({ ...active, index }); setState(s => ({ ...s, activeStep: { day: active.level.id, index } })); } }, skip, onAction, update, reset };
}
