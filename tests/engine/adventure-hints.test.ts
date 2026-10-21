import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAdventureHint, hintDomains } from '../../src/engine/adventureHints';
import { levels, getSolution } from '../../src/engine/levels';
import { occupied, key } from '../../src/engine/boardGeometry';
import { evaluate } from '../../src/engine/placementRules';
import { solveLevel } from '../../src/engine/solver';
import type { Level, Placement } from '../../src/engine/types';
import { createTranslator } from '../../src/localization/LanguageContext';
import { HINT_ENGLISH } from '../../src/localization/hints';
import { withEditorPlacements } from '../../src/engine/mapBlueprint';

function verify(level: Level, placements: readonly Placement[]) {
  const hint = analyzeAdventureHint({ level, placements });
  assert.equal(hint.status, 'ready', `day ${level.id}, placed ${placements.length}: ${hint.status}`);
  if (hint.status !== 'ready') return;
  assert.ok(!placements.some(at => at.id === hint.placement.id));
  assert.ok(hint.candidates > 0);
  const extended = [...placements, hint.placement];
  const completion = solveLevel(level, 1, {}, hintDomains(level, extended));
  assert.equal(completion.count, 1, `day ${level.id}: suggestion must extend to a legal solution`);
  assert.ok(evaluate(level, completion.solutions[0]).won);
  for (const at of extended) {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const actual = completion.solutions[0].find(p => p.id === at.id)!;
    assert.deepEqual(occupied(piece, at).map(key).sort(), occupied(piece, actual).map(key).sort());
  }
  if (hint.forced) {
    const piece = level.pieces.find(p => p.id === hint.placement.id)!;
    const mask = hint.cells.map(key).sort().join(';');
    const excluded = hintDomains(level, placements).map(g => g.ids.some(id => !placements.some(at => at.id === id)) && g.piece.kind === piece.kind && g.piece.shape === piece.shape
      ? { ...g, domain: g.domain.filter(p => p.cells.map(key).sort().join(';') !== mask) } : g);
    assert.equal(solveLevel(level, 1, {}, excluded).count, 0);
  }
}

test('all Adventure levels give legal, verified hints on empty and partial boards', () => {
  for (const level of levels) {
    verify(level, []);
    const answer = getSolution(level.id)!;
    verify(level, answer.slice(0, Math.floor(answer.length / 2)));
    verify(level, answer.slice(0, -1));
  }
});

const ambiguous: Level = { id: 999, name: '', chapter: '', tip: '', size: 3, terrain: [], pieces: [{ id: 'a', kind: 'powerTower', shape: 'single' }, { id: 'b', kind: 'powerTower', shape: 'single' }], rows: [1, 1, 0], cols: [1, 1, 0] };
test('Day 28 reuses a validated completion without claiming necessity when proof budget is exhausted', () => {
  const hint=analyzeAdventureHint({level:levels.find(level=>level.id===28)!,placements:[]},0);
  assert.equal(hint.status,'ready');
  if(hint.status==='ready') assert.equal(hint.forced,false);
});
test('multiple solutions are labeled possible; interchangeable IDs never invent necessity', () => {
  const hint = analyzeAdventureHint({ level: ambiguous, placements: [] });
  assert.equal(hint.status, 'ready');
  if (hint.status === 'ready') assert.equal(hint.forced, false);
  verify(ambiguous, [{ id: 'b', r: 0, c: 0, rotation: 3 }]);
});

test('rule-driven hints support truck gaps, pools, power towers and rotated multi-cell camps', () => {
  const pieces: Level['pieces'] = [{ id: 'c', kind: 'camp', shape: 'el' }, { id: 'v', kind: 'foodTruck', shape: 'single' }, { id: 's', kind: 'pool', shape: 'single' }, { id: 'e', kind: 'powerTower', shape: 'single' }];
  const answer = [{ id: 'c', r: 2, c: 2, rotation: 0 }, { id: 'v', r: 3, c: 5, rotation: 0 }, { id: 's', r: 1, c: 1, rotation: 0 }, { id: 'e', r: 5, c: 2, rotation: 0 }];
  const level = withEditorPlacements({ level: { ...ambiguous, size: 6, pieces, terrain: [{ kind: 'water', r: 2, c: 1 }] }, placements: [] }, answer).level;
  assert.equal(evaluate(level, answer).won, true);
  verify(level, []);
  for (let i = 0; i < pieces.length; i++) verify(level, answer.filter((_, index) => index !== i));
  const blocked = analyzeAdventureHint({ level, placements: [answer[0], { ...answer[1], c: 4 }] });
  assert.equal(blocked.status, 'conflict');
});

test('confirmed violations, joint contradictions, completion and search exhaustion stay distinct', () => {
  const conflict = analyzeAdventureHint({ level: ambiguous, placements: [{ id: 'a', r: 2, c: 0, rotation: 0 }] });
  assert.equal(conflict.status, 'conflict');
  if (conflict.status === 'conflict') assert.ok(conflict.reasons.some(reason => reason.includes('超出')));
  const impossible = { ...ambiguous, rows: [2, 0, 0], cols: [0, 0, 2] };
  const joint = analyzeAdventureHint({ level: impossible, placements: [] });
  assert.deepEqual(joint, { status: 'conflict', cells: [], reasons: [] });
  const partial = [{ id: 'a', r: 0, c: 0, rotation: 0 }];
  const blocked: Level = { ...ambiguous, terrain: [{ kind: 'mountain', r: 1, c: 1 }] };
  assert.notEqual(evaluate(blocked, partial).status, 'INVALID');
  assert.deepEqual(analyzeAdventureHint({ level: blocked, placements: partial }), { status: 'conflict', cells: [{ r: 0, c: 0 }], reasons: [] });
  assert.equal(analyzeAdventureHint({ level: levels[0], placements: getSolution(1)! }).status, 'complete');
  assert.equal(analyzeAdventureHint({ level: ambiguous, placements: [] }, 0).status, 'unknown');
});

test('hint and manual translations resolve through the existing localization mechanism', () => {
  const { localize, t } = createTranslator('en');
  for (const chinese of Object.keys(HINT_ENGLISH)) assert.doesNotMatch(localize(chinese), /[\u3400-\u9fff]/u);
  assert.equal(t('第 {0} 行第 {1} 列', 2, 3), 'row 2, column 3');
});
