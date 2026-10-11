import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placementBlock } from '../game/rules';
import { finishLesson, freshTutorial, matchesAction, readTutorial, resolveTutorial, writeTutorial } from '../game/tutorial';
import type { TutorialEvent, TutorialLesson, TutorialState } from '../game/tutorial';
import type { GameMode, Level, Piece, Placement, Shape } from '../game/types';
import { dictionaries } from '../i18n';

type Options = { screen: string; mode: GameMode; level: Level; placements: Placement[]; selected: Piece | null; rotations: Partial<Record<Shape, number>>; won: boolean; paused: boolean; winOpen: boolean };
export function useTutorial({ screen, mode, level, placements, selected, rotations, won, paused, winOpen }: Options) {
  const [state, setState] = useState(readTutorial);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState<'resetReady' | null>(null);
  const [active, setActive] = useState<{ lesson: TutorialLesson; index: number; level: Level; mode: GameMode } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const visible = screen === 'game' && state.enabled && !paused && (!winOpen || active?.lesson.basic === 'completion') && active?.level === level && active.mode === mode;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useLayoutEffect(() => { setSaved(writeTutorial(state)); }, [state]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [message]);
  const practicePiece = selected || level.pieces.find(p => !placements.some(at => at.id === p.id));
  const practiceCell = practicePiece ? Array.from({ length: level.size * level.size }, (_, i) => ({ r: Math.floor(i / level.size), c: i % level.size }))
    .find(cell => !placementBlock(level, placements, { ...cell, id: practicePiece.id, rotation: rotations[practicePiece.shape] || 0 })) : undefined;
  useEffect(() => {
    if (screen !== 'game' || !state.enabled || active && (active.level !== level || active.mode !== mode)) { setActive(null); return; }
    if (active || paused) return;
    const lesson = resolveTutorial(state, { mode, level, placements, selected, won, practiceCell });
    if (lesson) setActive({ lesson, index: 0, level, mode });
  }, [screen, mode, level, placements, selected, won, paused, state, active]);
  const next = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    if (current.index + 1 < current.lesson.steps.length) setActive({ ...current, index: current.index + 1 });
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
      const updated = finishLesson(s, active.lesson, true);
      return active.lesson.basic ? { ...updated, basicComplete: true, basicSeen: freshTutorial(true).basicSeen } : updated;
    });
    setActive(null);
  }
  function update(updateState: (s: TutorialState) => TutorialState) { setState(updateState); setMessage(null); }
  function reset() { setState(s => freshTutorial(false, s.language)); setActive(null); setMessage('resetReady'); }
  let step = active?.lesson.steps[active.index];
  if ((step?.id === 'place' || step?.id === 'replace') && practiceCell) step = { ...step, target: { type: 'cell', cell: practiceCell }, shape: 'circle' };
  if (step?.id === 'select' && practicePiece) step = { ...step, target: { type: 'facility', kind: practicePiece.kind } };
  return { state, saved, message, copy: dictionaries[state.language], active: visible && active && step ? { lesson: active.lesson, step, index: active.index } : null,
    next, back: () => { if (active) setActive({ ...active, index: Math.max(0, active.index - 1) }); }, skip, onAction, update, reset };
}
