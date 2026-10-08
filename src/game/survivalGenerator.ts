import data from '../data/levels.json';
import answers from '../data/solutions.json';
import { adjacent, evaluate, key, occupied, offsets } from './rules';
import { facilityLibrary, withEditorPlacements } from './sandbox';
import type { SandboxDraft } from './sandbox';
import { solveLevel } from './solver';
import { survivalDifficulties, survivalFingerprint } from './survival';
import type { SurvivalChallenge } from './survival';
import type { Cell, Level, Placement, TerrainKind } from './types';

export const survivalGenerationTimeout = 25000;
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, value | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}

// Existing legal layouts seed the search; terrain, facility footprints, positions
// and counts are then varied. A symmetry alone never qualifies as a new map.
export function generateSurvival(difficulty: number, seed: number, id: string, recent: string[] = []): SurvivalChallenge {
  const spec = survivalDifficulties[difficulty - 1];
  if (!spec) throw new Error('请选择 1难至10难');
  const random = seeded(seed), pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const deadline = Date.now() + survivalGenerationTimeout - 1000;
  const cells = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8 }));
  const target = spec.min + Math.floor(random() * (spec.max - spec.min + 1));
  let serial = 0;
  function rebuild(draft: SandboxDraft) { return withEditorPlacements(draft, draft.placements); }
  function legal(draft: SandboxDraft) { return evaluate(draft.level, draft.placements).won; }
  function unique(draft: SandboxDraft) { return solveLevel(draft.level, 2, { deadline: Math.min(deadline, Date.now() + 700), maxNodes: 18000 }); }
  function transform(base: Level): SandboxDraft {
    const shiftR = Math.floor(random() * (9 - base.size)), shiftC = Math.floor(random() * (9 - base.size));
    const turns = Math.floor(random() * 4), mirror = random() < .5;
    const point = (p: Cell) => {
      let r = p.r + shiftR, c = p.c + shiftC;
      if (mirror) c = 7 - c;
      for (let i = 0; i < turns; i++) [r, c] = [c, 7 - r];
      return { r, c };
    };
    const pieces = base.pieces.map((p, i) => ({ ...p, id: `wild-${i}` }));
    const placements = (answers as Record<string, Placement[]>)[base.id].map(at => {
      const i = base.pieces.findIndex(p => p.id === at.id), piece = pieces[i];
      const footprint = occupied(piece, at).map(point), r = Math.min(...footprint.map(p => p.r)), c = Math.min(...footprint.map(p => p.c));
      const rotation = [0, 1, 2, 3].find(turn => offsets(piece.shape, turn).every(p => footprint.some(q => q.r === p.r + r && q.c === p.c + c)))!;
      return { id: piece.id, r, c, rotation };
    });
    return rebuild({ level: { ...base, id: 0, name: `荒野求生 · ${difficulty}难`, chapter: '荒野求生', tip: '结合行列占格数、地形与设施规则，完成这片营地。', size: 8, terrain: base.terrain.map(t => ({ ...point(t), kind: t.kind })), pieces }, placements });
  }
  function change(draft: SandboxDraft, countOnly = false): SandboxDraft {
    const next = structuredClone(draft), count = next.level.pieces.length;
    const operation = countOnly ? count < target ? 0 : 1 : Math.floor(random() * 5);
    if (operation === 0 && count < spec.max) {
      const templates = facilityLibrary.filter(p => difficulty > 1 || p.shape === 'single');
      const piece = { ...pick(templates), id: `extra-${++serial}` };
      next.level.pieces.push(piece);
      next.placements.push({ ...pick(cells), id: piece.id, rotation: Math.floor(random() * 4) });
    } else if (operation === 1 && count > spec.min) {
      const piece = pick(next.level.pieces);
      next.level.pieces = next.level.pieces.filter(p => p.id !== piece.id);
      next.placements = next.placements.filter(p => p.id !== piece.id);
    } else if (operation === 2) {
      const at = pick(next.placements), piece = next.level.pieces.find(p => p.id === at.id)!;
      if (random() < .35 && piece.kind === 'camp' && difficulty > 1) piece.shape = pick(facilityLibrary.filter(p => p.kind === 'camp')).shape;
      Object.assign(at, pick(cells), { rotation: Math.floor(random() * 4) });
    } else {
      const cell = pick(cells), terrain = next.level.terrain.find(t => key(t) === key(cell));
      next.level.terrain = next.level.terrain.filter(t => key(t) !== key(cell));
      if (!terrain || random() < .55) next.level.terrain.push({ ...cell, kind: pick<TerrainKind>(['water', 'forest', 'mountain']) });
    }
    return rebuild(next);
  }
  const maxTerrain = difficulty === 1 ? 5 : 6 + difficulty * 2;
  for (let attempt = 0; attempt < 24 && Date.now() < deadline; attempt++) {
    let draft = transform((data as Level[])[pick(spec.bases) - 1]), changes = 0;
    // Counts are adjusted on a valid answer first, then the full puzzle is checked.
    for (let edit = 0; edit < 400 && draft.level.pieces.length !== target && Date.now() < deadline; edit++) {
      const next = change(draft, true);
      if (legal(next)) { draft = next; changes++; }
    }
    if (draft.level.pieces.length !== target) continue;
    for (let edit = 0; edit < 90 && Date.now() < deadline; edit++) {
      const next = change(draft);
      if (next.level.pieces.length !== target || next.level.terrain.length > maxTerrain || !legal(next)) continue;
      const solved = unique(next);
      if (solved.aborted || solved.count !== 1) continue;
      draft = next; changes++;
      if (changes >= 3) break;
    }
    // If adding facilities introduced ambiguity, remove alternative footprints
    // with legal terrain only. Never block the intended answer or accept a timeout.
    for (let repair = 0; repair < 8 && Date.now() < deadline; repair++) {
      const solved = unique(draft);
      if (solved.aborted || solved.count === 0) break;
      if (solved.count === 1) {
        const multi = draft.level.pieces.filter(p => p.shape !== 'single').length;
        const dependent = draft.level.pieces.filter(p => p.kind === 'fire' || p.kind === 'picnic').length;
        if (changes < 2 || draft.level.terrain.length > maxTerrain || multi < spec.multi || (difficulty >= 7 && (solved.candidates < target * 3 || solved.forced > target / 3 || dependent < 4))) break;
        const fingerprint = survivalFingerprint(draft);
        if (recent.includes(fingerprint)) break;
        return { id, difficulty, seed, draft, fingerprint };
      }
      const intended = new Set(draft.placements.flatMap(at => occupied(draft.level.pieces.find(p => p.id === at.id)!, at)).map(key));
      const alternative = solved.solutions.flatMap(solution => solution.flatMap(at => occupied(draft.level.pieces.find(p => p.id === at.id)!, at))).filter(p => !intended.has(key(p)) && !draft.level.terrain.some(t => key(t) === key(p)));
      if (!alternative.length || draft.level.terrain.length >= maxTerrain) break;
      const next = structuredClone(draft), cell = pick(alternative);
      // Forest/water affect facility relationships too; accept only a legal answer.
      const kinds: TerrainKind[] = ['forest', 'water', 'mountain'].filter(kind => kind !== 'forest' || !draft.placements.some(at => draft.level.pieces.find(p => p.id === at.id)!.kind === 'fire' && occupied(draft.level.pieces.find(p => p.id === at.id)!, at).some(p => adjacent(p, cell, true)))) as TerrainKind[];
      next.level.terrain.push({ ...cell, kind: pick(kinds) });
      if (legal(next)) { draft = next; changes++; }
    }
  }
  throw new Error('本次未能在时限内找到合适的唯一解地图，请重试。');
}
