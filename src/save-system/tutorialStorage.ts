import type { Language } from '../localization';
import type { FacilityKind } from '../engine';
import { getLevelById } from '../engine';

export const TUTORIAL_STORAGE_KEY = 'wildgrid-tutorial-v1';
export const BASIC_LESSONS = ['orientation', 'placing', 'adjusting', 'rotation', 'completion'] as const;
export const TUTORIAL_DAYS = [1, 2, 5, 8, 10, 11, 13, 19, 24, 31, 34, 38] as const;
export type BasicLesson = typeof BASIC_LESSONS[number];
export type TutorialState = {
  version: 1; enabled: boolean; language: Language; basicComplete: boolean;
  basicSeen: BasicLesson[]; facilitiesSeen: FacilityKind[]; skipped: string[];
  daysSeen: number[]; activeStep?: { day: number; index: number };
};
const FACILITY_KINDS: FacilityKind[] = ['camp', 'fire', 'tower', 'picnic', 'cabin', 'foodTruck', 'powerTower', 'pool'];
let readFailed = false;
export function freshTutorial(experienced = false, language: Language = 'zh'): TutorialState {
  return { version: 1, enabled: true, language, basicComplete: experienced, basicSeen: experienced ? [...BASIC_LESSONS] : [], facilitiesSeen: [], skipped: [], daysSeen: [] };
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
      fallback.daysSeen = TUTORIAL_DAYS.filter(day => Array.isArray(legacy?.completed) && legacy.completed.includes(day));
    } catch { /* A damaged legacy save must not prevent tutorial preferences from loading. */ }
  }
  try {
    const raw = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) || 'null');
    readFailed = false;
    if (raw?.version !== 1) return fallback;
    const basicSeen = BASIC_LESSONS.filter(id => Array.isArray(raw.basicSeen) && raw.basicSeen.includes(id));
    return { version: 1, enabled: raw.enabled !== false, language: raw.language === 'en' ? 'en' : 'zh',
      basicComplete: raw.basicComplete === true || basicSeen.length === BASIC_LESSONS.length,
      basicSeen, facilitiesSeen: FACILITY_KINDS.filter(kind => Array.isArray(raw.facilitiesSeen) && raw.facilitiesSeen.includes(kind)),
      skipped: Array.isArray(raw.skipped) ? raw.skipped.filter((id: unknown): id is string => typeof id === 'string') : [],
      daysSeen: Array.isArray(raw.daysSeen) ? TUTORIAL_DAYS.filter(day => raw.daysSeen.includes(day)) : fallback.daysSeen,
      activeStep: raw.activeStep && TUTORIAL_DAYS.some(day => day === raw.activeStep.day) && Number.isInteger(raw.activeStep.index) && raw.activeStep.index >= 0 ? raw.activeStep : undefined,
    };
  } catch { readFailed = true; return fallback; }
}
function canOverwriteTutorial(stored: string | null): boolean {
  if (stored === null) return true;
  const raw = JSON.parse(stored);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) return false;
  // Older v1 saves may omit fields. Present fields must still be readable v1 data.
  if (Object.keys(raw).some(key => !['version', 'enabled', 'language', 'basicComplete', 'basicSeen', 'facilitiesSeen', 'skipped', 'daysSeen', 'activeStep'].includes(key))) return false;
  if (['enabled', 'basicComplete'].some(key => key in raw && typeof raw[key] !== 'boolean')) return false;
  if ('language' in raw && raw.language !== 'zh' && raw.language !== 'en') return false;
  if (['basicSeen', 'facilitiesSeen', 'skipped'].some(key => key in raw && (!Array.isArray(raw[key]) || raw[key].some((value: unknown) => typeof value !== 'string')))) return false;
  if (raw.basicSeen?.some((id: string) => !BASIC_LESSONS.includes(id as BasicLesson)) || raw.facilitiesSeen?.some((kind: string) => !FACILITY_KINDS.includes(kind as FacilityKind))) return false;
  if ('daysSeen' in raw && (!Array.isArray(raw.daysSeen) || raw.daysSeen.some((day: number) => !TUTORIAL_DAYS.some(known => known === day)))) return false;
  if ('activeStep' in raw && (!raw.activeStep || typeof raw.activeStep !== 'object' || !TUTORIAL_DAYS.some(day => day === raw.activeStep.day) || !Number.isInteger(raw.activeStep.index) || raw.activeStep.index < 0)) return false;
  return true;
}
export function writeTutorial(state: TutorialState): boolean {
  if (readFailed) return false;
  try {
    if (!canOverwriteTutorial(localStorage.getItem(TUTORIAL_STORAGE_KEY))) return false;
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state)); return true;
  } catch { return false; }
}
