import { countSolutions } from '../src/game/solver';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/levels.json';
import answers from '../src/data/solutions.json';
import { evaluate, occupied, offsets, placementBlock, rotateAround } from '../src/game/rules';
import type { Level, Placement } from '../src/game/types';
import { progressForPlay, readSave, writeSave } from '../src/game/storage';

const levels = data as Level[];
const solutions = answers as Record<string, Placement[]>;
test('reopening a solved level starts fresh while unfinished play resumes', () => {
  const save = { version: 1 as const, completed: [1, 2], current: 2, progress: { 1: solutions[1], 2: solutions[2].slice(0, 1) }, settings: { music: .35, effects: .65, muted: false, facilityTips: true } };
  assert.deepEqual(progressForPlay(save, levels[0]), []);
  assert.deepEqual(progressForPlay(save, levels[1]), solutions[2].slice(0, 1));
  assert.deepEqual(save.completed, [1, 2]);
  assert.deepEqual(save.progress[1], solutions[1]);
});
test('facility tip setting preserves disabled state and defaults on for old saves', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = JSON.stringify({ version: 1, completed: [1], current: 1, progress: {}, settings: { music: .35, effects: .65, muted: false } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  try {
    const save = readSave(levels);
    assert.equal(save.settings.facilityTips, true);
    save.settings.facilityTips = false;
    assert.equal(writeSave(save), true);
    assert.equal(readSave(levels).settings.facilityTips, false);
    assert.deepEqual(readSave(levels).completed, [1]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
test('all 30 authored levels have valid complete solutions and exact cell clues', () => {
  assert.equal(levels.length, 30);
  for (const level of levels) {
    const answer = solutions[level.id];
    const result = evaluate(level, answer);
    assert.equal(result.won, true, `Level ${level.id}: ${JSON.stringify(result.issues)}`);
    assert.equal(new Set(level.terrain.map(p => `${p.r},${p.c}`)).size, level.terrain.length);
    assert.equal(level.rows.reduce((a, b) => a + b, 0), level.pieces.reduce((sum, p) => sum + offsets(p.shape, 0).length, 0));
    for (const at of answer) assert.equal(placementBlock(level, answer, at), null);
    assert.equal(evaluate(level, []).status, 'INCOMPLETE');
    for (const at of answer) {
      const partial = evaluate(level, answer.filter(p => p.id !== at.id));
      assert.equal(partial.won, false);
      assert.equal(partial.status, 'INCOMPLETE', `Level ${level.id}, picking up ${at.id}`);
    }
  }
});
test('rotations preserve area, normalize footprints and return after four turns', () => {
  for (const shape of ['single', 'domino', 'long', 'el'] as const) {
    for (let r = 0; r < 4; r++) {
      const points = offsets(shape, r);
      assert.equal(points.length, offsets(shape, 0).length);
      assert.equal(Math.min(...points.map(p => p.r)), 0);
      assert.equal(Math.min(...points.map(p => p.c)), 0);
    }
    assert.deepEqual(offsets(shape, 0), offsets(shape, 4));
  }
});
test('placed camps rotate clockwise around every occupied mouse cell', () => {
  for (const shape of ['domino', 'long', 'el'] as const) for (let rotation = 0; rotation < 4; rotation++) {
    const piece = { id: 'camp', kind: 'camp' as const, shape };
    const at = { id: piece.id, r: 2, c: 2, rotation };
    for (const pivot of occupied(piece, at)) {
      const rotated = rotateAround(piece, at, pivot);
      const actual = occupied(piece, rotated).map(p => `${p.r},${p.c}`).sort();
      const expected = occupied(piece, at).map(p => `${pivot.r + p.c - pivot.c},${pivot.c - p.r + pivot.r}`).sort();
      assert.deepEqual(actual, expected);
      assert.ok(actual.includes(`${pivot.r},${pivot.c}`));
      let returned = at;
      for (let i = 0; i < 4; i++) returned = rotateAround(piece, returned, pivot);
      assert.deepEqual(returned, at);
    }
  }
});
test('rotation can detect terrain, another facility and board-edge collisions without moving the original', () => {
  const level = levels[9], piece = level.pieces[0];
  const at = { id: piece.id, r: 1, c: 1, rotation: 0 };
  const rotated = rotateAround(piece, at, { r: 1, c: 1 });
  assert.ok(placementBlock(level, [at], rotated)?.includes('地形'));
  const other = { id: 'other', kind: 'fire' as const, shape: 'single' as const };
  const crowded = { ...level, terrain: [], pieces: [...level.pieces, other] };
  assert.ok(placementBlock(crowded, [at, { id: 'other', r: 2, c: 1, rotation: 0 }], rotated)?.includes('重叠'));
  const edge = { ...at, r: 5 };
  assert.ok(placementBlock(crowded, [edge], rotateAround(piece, edge, { r: 5, c: 1 }))?.includes('放不下'));
  assert.deepEqual(at, { id: piece.id, r: 1, c: 1, rotation: 0 });
});
test('fire without a camp is pending, forest diagonals immediately invalidate it', () => {
  const level = levels[4];
  const fire = solutions[5].filter(p => p.id.startsWith('fire'));
  assert.equal(evaluate(level, fire).issues[fire[0].id].status, 'INCOMPLETE');
  const forestLevel = { ...level, terrain: [...level.terrain, { kind: 'forest' as const, r: 1, c: 4 }] };
  assert.equal(evaluate(forestLevel, fire).issues[fire[0].id].status, 'INVALID');
  const isolated = [{ ...fire[0], r: 5, c: 5 }];
  assert.equal(evaluate(level, isolated).issues[fire[0].id].status, 'INVALID');
});
test('terrain, overlap and board edges block placement; environmental mistakes remain editable data', () => {
  const level = levels[9], piece = level.pieces[0];
  assert.ok(placementBlock(level, [], { id: piece.id, r: 2, c: 1, rotation: 0 }));
  assert.ok(placementBlock(level, [], { id: piece.id, r: 5, c: 5, rotation: 0 }));
  const bad = [{ id: piece.id, r: 0, c: 0, rotation: 0 }];
  assert.equal(placementBlock(level, [], bad[0]), null);
  assert.equal(evaluate(level, bad).status, 'INVALID');
  assert.equal(evaluate(level, bad).won, false);
  assert.equal(evaluate(level, solutions[10]).won, true);
  const pair = levels[1];
  assert.ok(placementBlock(pair, [solutions[2][0]], { ...solutions[2][0], id: pair.pieces[1].id }));
});
test('multi-cell camp needs only one water neighbor; row/column counts measure cells', () => {
  const level = levels[9], at = solutions[10][0];
  assert.equal(occupied(level.pieces[0], at).length, 2);
  const result = evaluate(level, [at]);
  assert.equal(result.rows[2], 2);
  assert.equal(result.cols[2], 1);
  assert.equal(result.cols[3], 1);
  assert.equal(result.won, true);
  assert.equal(evaluate(level, []).rows[2], 0);
});
test('towers may not touch diagonally', () => {
  const level: Level = { id: 99, name: 'test', chapter: '', tip: '', size: 6, terrain: [{ kind: 'mountain', r: 2, c: 2 }], pieces: [{ id: 't1', kind: 'tower', shape: 'single' }, { id: 't2', kind: 'tower', shape: 'single' }], rows: [0,1,1,0,0,0], cols: [0,0,1,1,0,0] };
  const result = evaluate(level, [{ id: 't1', r: 1, c: 2, rotation: 0 }, { id: 't2', r: 2, c: 3, rotation: 0 }]);
  assert.equal(result.issues.t1.status, 'INVALID');
  assert.equal(result.issues.t2.status, 'INVALID');
  assert.ok(result.issues.t1.reasons.some(r => r.includes('瞭望塔之间')));
});

test('solver counts layouts, ignoring identical IDs and equivalent rotations', () => {
  const level: Level = { id: 99, name: '', chapter: '', tip: '', size: 4, terrain: [1,2].flatMap(c => [0,3].map(r => ({kind: 'water' as const,r,c}))), pieces: ['a','b'].map(id => ({id,kind:'camp',shape:'single'})), rows:[0,2,0,0], cols:[0,1,1,0] };
  assert.equal(countSolutions(level), 1);
  assert.equal(countSolutions({...level,rows:[0,1,1,0]}), 2);
  assert.equal(countSolutions({...level,terrain:[]}), 0);
  assert.equal(countSolutions({...level,pieces:[{id:'a',kind:'camp',shape:'domino'}]}), 1);
});
test('picnic and cabin enforce their new adjacency rules, including pending camps', () => {
  const level: Level = { id:99,name:'',chapter:'',tip:'',size:5,terrain:[{kind:'water',r:0,c:0},{kind:'forest',r:4,c:3}],pieces:[{id:'c',kind:'camp',shape:'single'},{id:'p',kind:'picnic',shape:'domino'},{id:'h',kind:'cabin',shape:'el'}],rows:[3,0,0,2,1],cols:[0,1,3,2,0] };
  const answer = [{id:'c',r:0,c:1,rotation:0},{id:'p',r:0,c:2,rotation:0},{id:'h',r:3,c:2,rotation:1}];
  assert.equal(evaluate(level,answer).won,true);
  assert.equal(evaluate(level,answer.slice(1)).issues.p.status,'INCOMPLETE');
  const fireLevel:Level={...level,pieces:[...level.pieces,{id:'f',kind:'fire',shape:'single'}]};
  const nearFire=evaluate(fireLevel,[...answer,{id:'f',r:1,c:4,rotation:0}]);
  assert.ok(nearFire.issues.p.reasons.some(r=>r.includes('篝火')));
  assert.equal(evaluate({...level,terrain:[...level.terrain,{kind:'water',r:3,c:1}]},answer).issues.h.status,'INVALID');
  assert.equal(evaluate({...level,terrain:level.terrain.filter(t=>t.kind!=='forest')},answer).issues.h.status,'INVALID');
});
