import type { BasicCopyKey, Language } from '../i18n';
import type { Cell, FacilityKind, GameMode, Level, Piece, Placement, Shape } from '../engine';
import { getLevelById } from '../engine';

export const tutorialStorageKey = 'wildgrid-tutorial-v1';
export const basicLessons = ['orientation', 'placing', 'adjusting', 'rotation', 'completion'] as const;
export const tutorialDays = [1, 2, 5, 8, 10, 11, 13, 19, 24, 31, 34, 38] as const;
type BasicLesson = typeof basicLessons[number];
export type TutorialState = {
  version: 1; enabled: boolean; language: Language; basicComplete: boolean;
  basicSeen: BasicLesson[]; facilitiesSeen: FacilityKind[]; skipped: string[];
  daysSeen: number[]; activeStep?: { day: number; index: number };
};
export type TutorialEvent = {
  type: 'pageOpened' | 'modeEntered' | 'select' | 'place' | 'rotate' | 'undo' | 'redo' | 'pickup' | 'closeHint' | 'complete';
  kind?: FacilityKind; pieceId?: string; value?: string;
  r?: number; c?: number; rotation?: number;
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
  example?: 'wrong' | 'right';
};
export type TutorialLesson = { id: string; levelId?: number; basic?: BasicLesson; basics?: BasicLesson[]; facility?: FacilityKind; steps: TutorialStep[] };
const kinds: FacilityKind[] = ['camp', 'fire', 'tower', 'picnic', 'cabin', 'foodTruck', 'powerTower', 'pool'];
export function freshTutorial(experienced = false, language: Language = 'zh'): TutorialState {
  return { version: 1, enabled: true, language, basicComplete: experienced, basicSeen: experienced ? [...basicLessons] : [], facilitiesSeen: [], skipped: [], daysSeen: [] };
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
      fallback.daysSeen = tutorialDays.filter(day => Array.isArray(legacy?.completed) && legacy.completed.includes(day));
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
      daysSeen: Array.isArray(raw.daysSeen) ? tutorialDays.filter(day => raw.daysSeen.includes(day)) : fallback.daysSeen,
      activeStep: raw.activeStep && tutorialDays.some(day => day === raw.activeStep.day) && Number.isInteger(raw.activeStep.index) && raw.activeStep.index >= 0 ? raw.activeStep : undefined,
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
  const basicSeen = [...new Set([...state.basicSeen, ...lesson.basics || (lesson.basic ? [lesson.basic] : [])])];
  return { ...state, basicSeen, basicComplete: basicLessons.every(id => basicSeen.includes(id)),
    facilitiesSeen: lesson.facility ? [...new Set([...state.facilitiesSeen, lesson.facility])] : state.facilitiesSeen,
    skipped: skipped ? [...new Set([...state.skipped, lesson.id])] : state.skipped,
    daysSeen: lesson.levelId ? [...new Set([...state.daysSeen, lesson.levelId])] : state.daysSeen, activeStep: undefined,
  };
}
function step(id: BasicCopyKey, target: TutorialTarget, actionCondition?: Partial<TutorialEvent>): TutorialStep {
  return { id, copy: 'basics', target, shape: target.type === 'cell' || target.type === 'instance' || id === 'undo' ? 'circle' : 'rounded-rect', arrow: true, placement: 'auto',
    advance: actionCondition ? 'action' : 'click', actionCondition, blockInteraction: true, allowSkip: true };
}
type Context = { mode: GameMode; level: Level; placements: Placement[]; selected: Piece | null; won: boolean };
export function resolveTutorial(state: TutorialState, context: Context): TutorialLesson | null {
  if (!state.enabled || context.mode !== 'adventure' || state.daysSeen.includes(context.level.id)) return null;
  const { level, placements } = context;
  if ([1, 2, 11].includes(level.id) && placements.length && state.activeStep?.day !== level.id) return null;
  const ui = (id: Extract<TutorialTarget, { type: 'ui' }>['id']): TutorialTarget => ({ type: 'ui', id });
  const facility = (kind: FacilityKind): TutorialStep => ({ id: kind, copy: 'facilities', target: { type: 'facility', kind }, shape: 'rounded-rect', arrow: true, placement: 'auto', advance: 'click', blockInteraction: true, allowSkip: true });
  const camp: TutorialTarget = { type: 'facility', kind: 'camp', shape: level.id === 11 ? 'domino' : 'single' };
  const lesson = (steps: TutorialStep[], basics?: BasicLesson[], kind?: FacilityKind): TutorialLesson => ({ id: `day:${level.id}`, levelId: level.id, steps, basics, facility: kind });
  if (level.id === 1) return lesson([
    step('welcome', ui('board')),
    step('board', ui('board')), step('clues', { type: 'clues' }), facility('camp'),
    { ...step('wrong', ui('board')), example: 'wrong' }, { ...step('right', ui('board')), example: 'right' },
    step('select', camp, { type: 'select', pieceId: 'camp-1' }),
    step('place', { type: 'cell', cell: { r: 2, c: 3 } }, { type: 'place', pieceId: 'camp-1', r: 2, c: 3, rotation: 0 }),
    { ...step('complete', ui('win'), { type: 'closeHint' }), advance: 'click' },
  ], ['orientation', 'placing', 'completion'], 'camp');
  if (level.id === 2) return lesson([
    step('goal', ui('goal')), step('select', camp, { type: 'select', pieceId: 'camp-1' }),
    step('place', { type: 'cell', cell: { r: 1, c: 2 } }, { type: 'place', pieceId: 'camp-1', r: 1, c: 2, rotation: 0 }),
    step('pickup', { type: 'instance', pieceId: 'camp-1' }, { type: 'pickup', pieceId: 'camp-1' }),
    step('undo', ui('undo'), { type: 'undo' }), step('feedback', ui('feedback')),
  ], ['adjusting']);
  if (level.id === 10) return lesson([step('multi', { type: 'facility', kind: 'camp', shape: 'domino' }), step('clues', { type: 'clues' })]);
  if (level.id === 11) return lesson([
    step('select', camp, { type: 'select', pieceId: 'camp-1' }),
    step('rotate', camp, { type: 'rotate', pieceId: 'camp-1', rotation: 1 }),
    step('place', { type: 'cell', cell: { r: 1, c: 2 } }, { type: 'place', pieceId: 'camp-1', r: 1, c: 2, rotation: 1 }),
    step('feedback', ui('feedback')),
  ], ['rotation']);
  if (level.id === 13) return lesson([step('el', { type: 'facility', kind: 'camp', shape: 'el' }), step('multi', { type: 'clues' })]);
  const introduction: Partial<Record<number, FacilityKind>> = { 5: 'fire', 8: 'tower', 19: 'picnic', 24: 'cabin', 31: 'foodTruck', 34: 'powerTower', 38: 'pool' };
  const kind = introduction[level.id];
  if (kind && !state.facilitiesSeen.includes(kind)) return lesson([facility(kind)], undefined, kind);
  return null;
}
