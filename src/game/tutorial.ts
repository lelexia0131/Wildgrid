import type { BasicCopyKey, Language } from '../i18n';
import type { Cell, FacilityKind, GameMode, Level, Piece, Placement, Shape } from './types';
import { getLevelById } from './levels';

export const tutorialStorageKey = 'wildgrid-tutorial-v1';
export const basicLessons = ['orientation', 'placing', 'adjusting', 'rotation', 'completion'] as const;
type BasicLesson = typeof basicLessons[number];
export type TutorialState = {
  version: 1; enabled: boolean; language: Language; basicComplete: boolean;
  basicSeen: BasicLesson[]; facilitiesSeen: FacilityKind[]; skipped: string[];
};
export type TutorialEvent = {
  type: 'pageOpened' | 'modeEntered' | 'select' | 'place' | 'rotate' | 'undo' | 'redo' | 'pickup' | 'closeHint' | 'complete';
  kind?: FacilityKind; pieceId?: string; value?: string;
};
export type TutorialTarget =
  | { type: 'ui'; id: 'board' | 'facilities' | 'undo' | 'feedback' | 'goal' | 'win' }
  | { type: 'clues' }
  | { type: 'facility'; kind: FacilityKind; shape?: Shape }
  | { type: 'cell'; cell: Cell }
  | { type: 'instance'; pieceId: string };
export type TutorialStep = {
  id: BasicCopyKey | FacilityKind; copy: 'basics' | 'facilities'; target: TutorialTarget;
  shape: 'circle' | 'rounded-rect'; arrow: boolean; placement: 'auto' | 'top' | 'bottom';
  advance: 'next' | 'click' | 'action'; actionCondition?: Partial<TutorialEvent>;
  blockInteraction: boolean; allowSkip: boolean;
};
export type TutorialLesson = { id: string; basic?: BasicLesson; facility?: FacilityKind; steps: TutorialStep[] };
const kinds: FacilityKind[] = ['camp', 'fire', 'tower', 'picnic', 'cabin', 'foodTruck', 'powerTower', 'pool'];
export function freshTutorial(experienced = false, language: Language = 'zh'): TutorialState {
  return { version: 1, enabled: true, language, basicComplete: experienced, basicSeen: experienced ? [...basicLessons] : [], facilitiesSeen: [], skipped: [] };
}
// Infer experience from actual play records, never from merely having a v1 save.
export function hasPlayedBefore(): boolean {
  try {
    const adventure = JSON.parse(localStorage.getItem('wildgrid-save-v1') || 'null');
    const survival = JSON.parse(localStorage.getItem('wildgrid-survival-v1') || 'null');
    const maps = JSON.parse(localStorage.getItem('wildgrid-local-maps-v1') || 'null');
    return !!(adventure?.completed?.length || Object.values(adventure?.progress || {}).some(p => Array.isArray(p) && p.length) || survival?.challenge || survival?.completed?.length || maps?.maps?.length);
  } catch { return false; }
}
export function readTutorial(experienced = hasPlayedBefore()): TutorialState {
  const fallback = freshTutorial(experienced);
  if (experienced) {
    try {
      const legacy = JSON.parse(localStorage.getItem('wildgrid-save-v1') || 'null');
      const played = [...(Array.isArray(legacy?.completed) ? legacy.completed : []), ...Object.entries(legacy?.progress || {}).filter(([, p]) => Array.isArray(p) && p.length).map(([id]) => Number(id))];
      fallback.facilitiesSeen = [...new Set<FacilityKind>(played.flatMap(id => getLevelById(id)?.pieces.map(p => p.kind) || []))];
    } catch { /* A damaged legacy save must not prevent tutorial preferences from loading. */ }
  }
  try {
    const raw = JSON.parse(localStorage.getItem(tutorialStorageKey) || 'null');
    if (raw?.version !== 1) return fallback;
    const basicSeen = basicLessons.filter(id => Array.isArray(raw.basicSeen) && raw.basicSeen.includes(id));
    return { version: 1, enabled: raw.enabled !== false, language: raw.language === 'en' ? 'en' : 'zh',
      basicComplete: raw.basicComplete === true || basicSeen.length === basicLessons.length,
      basicSeen, facilitiesSeen: kinds.filter(kind => Array.isArray(raw.facilitiesSeen) && raw.facilitiesSeen.includes(kind)),
      skipped: Array.isArray(raw.skipped) ? raw.skipped.filter((id: unknown): id is string => typeof id === 'string') : [],
    };
  } catch { return fallback; }
}
export function writeTutorial(state: TutorialState): boolean {
  try { localStorage.setItem(tutorialStorageKey, JSON.stringify(state)); return true; } catch { return false; }
}
export function matchesAction(condition: Partial<TutorialEvent>, event: TutorialEvent): boolean {
  return Object.entries(condition).every(([field, value]) => event[field as keyof TutorialEvent] === value);
}
export function finishLesson(state: TutorialState, lesson: TutorialLesson, skipped = false): TutorialState {
  const basicSeen = lesson.basic ? [...new Set([...state.basicSeen, lesson.basic])] : state.basicSeen;
  return { ...state, basicSeen, basicComplete: basicLessons.every(id => basicSeen.includes(id)),
    facilitiesSeen: lesson.facility ? [...new Set([...state.facilitiesSeen, lesson.facility])] : state.facilitiesSeen,
    skipped: skipped ? [...new Set([...state.skipped, lesson.id])] : state.skipped,
  };
}
function step(id: BasicCopyKey, target: TutorialTarget, actionCondition?: Partial<TutorialEvent>): TutorialStep {
  return { id, copy: 'basics', target, shape: target.type === 'cell' || target.type === 'instance' || id === 'undo' ? 'circle' : 'rounded-rect', arrow: true, placement: 'auto',
    advance: actionCondition ? 'action' : 'click', actionCondition, blockInteraction: !actionCondition, allowSkip: true };
}
type Context = { mode: GameMode; level: Level; placements: Placement[]; selected: Piece | null; won: boolean; practiceCell?: Cell };
export function resolveTutorial(state: TutorialState, context: Context): TutorialLesson | null {
  if (!state.enabled || context.mode === 'sandbox-editor') return null;
  const { mode, level, placements, selected, won, practiceCell } = context;
  const basic = (id: BasicLesson) => mode === 'adventure' && !state.basicComplete && !state.basicSeen.includes(id);
  const ui = (id: Extract<TutorialTarget, { type: 'ui' }>['id']): TutorialTarget => ({ type: 'ui', id });
  if (basic('orientation')) return { id: 'orientation', basic: 'orientation', steps: [step('board', ui('board')), step('clues', { type: 'clues' })] };
  const newKind = kinds.find(kind => level.pieces.some(p => p.kind === kind) && !state.facilitiesSeen.includes(kind));
  if (newKind) return { id: `facility:${newKind}`, facility: newKind, steps: [{ id: newKind, copy: 'facilities', target: { type: 'facility', kind: newKind }, shape: 'rounded-rect', arrow: true, placement: 'auto', advance: 'click', blockInteraction: true, allowSkip: true }] };
  if (basic('placing') && !won) return { id: 'placing', basic: 'placing', steps: [
    step('feedback', ui('feedback')), step('goal', ui('goal')),
    step('select', ui('facilities'), { type: 'select' }),
    step('place', practiceCell ? { type: 'cell', cell: practiceCell } : ui('board'), { type: 'place' }),
  ] };
  if (basic('rotation') && selected && selected.shape !== 'single') return { id: 'rotation', basic: 'rotation', steps: [step('rotate', { type: 'facility', kind: selected.kind, shape: selected.shape }, { type: 'rotate' })] };
  if (basic('adjusting') && level.id >= 2 && placements.length && !won) return { id: 'adjusting', basic: 'adjusting', steps: [
    step('pickup', { type: 'instance', pieceId: placements[placements.length - 1].id }, { type: 'pickup', pieceId: placements[placements.length - 1].id }),
    step('replace', ui('board'), { type: 'place' }), step('undo', ui('undo'), { type: 'undo' }),
  ] };
  if (basic('completion') && won) return { id: 'completion', basic: 'completion', steps: [{ ...step('complete', ui('win'), { type: 'closeHint' }), advance: 'click' }] };
  return null;
}
