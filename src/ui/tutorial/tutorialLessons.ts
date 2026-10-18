import type { BasicCopyKey } from '../../localization';
import type { Cell, FacilityKind, GameMode, Level, Piece, Placement, Shape } from '../../engine';
import { BASIC_LESSONS } from '../../save-system/tutorialStorage';
import type { BasicLesson, TutorialState } from '../../save-system/tutorialStorage';

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
export function matchesAction(condition: Partial<TutorialEvent>, event: TutorialEvent): boolean {
  return Object.entries(condition).every(([field, value]) => event[field as keyof TutorialEvent] === value);
}
export function finishLesson(state: TutorialState, lesson: TutorialLesson, skipped = false): TutorialState {
  const basicSeen = [...new Set([...state.basicSeen, ...lesson.basics || (lesson.basic ? [lesson.basic] : [])])];
  return { ...state, basicSeen, basicComplete: BASIC_LESSONS.every(id => basicSeen.includes(id)),
    facilitiesSeen: lesson.facility ? [...new Set([...state.facilitiesSeen, lesson.facility])] : state.facilitiesSeen,
    skipped: skipped ? [...new Set([...state.skipped, lesson.id])] : state.skipped,
    daysSeen: lesson.levelId ? [...new Set([...state.daysSeen, lesson.levelId])] : state.daysSeen, activeStep: undefined,
  };
}
function step(id: BasicCopyKey, target: TutorialTarget, actionCondition?: Partial<TutorialEvent>): TutorialStep {
  return { id, copy: 'basics', target, shape: target.type === 'cell' || target.type === 'instance' || id === 'undo' ? 'circle' : 'rounded-rect', arrow: true, placement: 'auto',
    advance: actionCondition ? 'action' : 'click', actionCondition, blockInteraction: true, allowSkip: true };
}
type Context = { mode: GameMode; level: Level; placements: readonly Placement[]; selected: Piece | null; won: boolean };
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
