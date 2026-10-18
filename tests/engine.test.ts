import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, createSession, dispatch, getAvailableActions, getLevelById, getSolution, getState } from '../src/engine';
import type { GameSession, Piece } from '../src/engine';

test('sessions retain editable rule mistakes, reject geometry, and use the level inventory', () => {
  const level = getLevelById(10)!, piece = level.pieces[0];
  const initial = createSession({ mode: 'adventure', present: { level, placements: [] } });
  assert.equal(dispatch(initial, { type: 'place', piece, cell: { r: NaN, c: 0 }, rotation: 0 }).error?.code, 'coordinates');
  assert.equal(dispatch(initial, { type: 'place', piece, cell: { r: 0, c: 0 }, rotation: 4 }).error?.code, 'rotation');
  const mistake = dispatch(initial, { type: 'place', piece: { ...piece, shape: 'single' }, cell: { r: 0, c: 0 }, rotation: 0 });
  assert.equal(mistake.error, null);
  assert.equal(getState(mistake.session).result.issues[piece.id].status, 'INVALID');
  assert.equal(getState(mistake.session).result.rows[0], 2, 'The authored domino remains authoritative');
  assert.equal(mistake.session.present.level, level);
  assert.deepEqual(initial.present.placements, []);
  assert.deepEqual(getAvailableActions(initial).pieces, [piece]);
  assert.deepEqual(getAvailableActions(mistake.session).pieces, []);
  assert.equal(dispatch(mistake.session, { type: 'place', piece, cell: { r: 1, c: 1 }, rotation: 0 }).session, mistake.session);
  assert.equal(dispatch(initial, { type: 'place', piece: { ...piece, id: 'invented' }, cell: { r: 0, c: 0 }, rotation: 0 }).error?.code, 'unknown');
  const blocked = dispatch(initial, { type: 'place', piece, cell: { r: 2, c: 1 }, rotation: 0 });
  assert.equal(blocked.error?.message, '固定地形上不能放置设施');
  assert.equal(blocked.session, initial);
  assert.deepEqual(blocked.cells, [{ r: 2, c: 1 }, { r: 2, c: 2 }]);
  assert.deepEqual(blocked.events, []);
  const answer = getSolution(10)![0];
  const complete = dispatch(initial, { type: 'place', piece, cell: answer, rotation: answer.rotation });
  assert.equal(getState(complete.session).result.won, true);
  assert.deepEqual(complete.events, [{ type: 'place', pieceId: piece.id, kind: piece.kind, r: answer.r, c: answer.c, rotation: answer.rotation }]);
  const removed = dispatch(complete.session, { type: 'remove', id: piece.id });
  assert.deepEqual(removed.session.present.placements, []);
  assert.equal(removed.session.present.level, level);
});

test('editor terrain, clues, facility removal and clear restore through the same history', () => {
  let session = createSession({ mode: 'sandbox-editor', present: createSandbox(6) });
  assert.equal(dispatch(session, { type: 'place', piece: { id: 'invalid', kind: 'fire', shape: 'domino' }, cell: { r: 0, c: 0 }, rotation: 0 }).error?.code, 'unknown');
  const piece: Piece = { id: 'custom-1', kind: 'camp', shape: 'domino' };
  session = dispatch(session, { type: 'terrain', cell: { r: 0, c: 1 }, kind: 'water' }).session;
  session = dispatch(session, { type: 'place', piece, cell: { r: 1, c: 1 }, rotation: 0 }).session;
  const placed = session;
  assert.equal(getState(session).result.won, true);
  assert.deepEqual(session.present.level.rows, [0, 2, 0, 0, 0, 0]);
  assert.deepEqual(session.present.level.cols, [0, 1, 1, 0, 0, 0]);
  assert.deepEqual(session.present.level.pieces, [piece]);
  const occupied = dispatch(session, { type: 'terrain', cell: { r: 1, c: 2 }, kind: 'forest' });
  assert.equal(occupied.session, session);
  assert.equal(occupied.error?.message, '先拿起这里的设施，再修改地形');
  session = dispatch(session, { type: 'remove', id: piece.id }).session;
  assert.deepEqual(session.present.level.pieces, []);
  assert.deepEqual(session.present.level.rows, Array(6).fill(0));
  session = dispatch(session, { type: 'undo' }).session;
  assert.equal(session.present, placed.present);
  session = dispatch(session, { type: 'redo' }).session;
  assert.deepEqual(session.present.level.pieces, []);
  session = dispatch(placed, { type: 'clear' }).session;
  assert.deepEqual(session.present.level.pieces, []);
  assert.deepEqual(session.present.level.terrain, placed.present.level.terrain);
  session = dispatch(session, { type: 'terrain', cell: { r: 0, c: 1 }, kind: 'water' }).session;
  assert.deepEqual(session.present.level.terrain, []);
  session = dispatch(session, { type: 'terrain', cell: { r: 2, c: 2 }, kind: 'forest' }).session;
  session = dispatch(session, { type: 'terrain', cell: { r: 2, c: 2 } }).session;
  assert.deepEqual(session.present.level.terrain, []);
  assert.equal(dispatch(createSession({ ...session, mode: 'survival' }), { type: 'terrain', cell: { r: 0, c: 0 }, kind: 'water' }).error?.code, 'mode');
});

test('placed rotation preserves pivot behavior and blocked rotations keep their snapshot', () => {
  const level = getLevelById(10)!, piece = level.pieces[0];
  const initial = createSession({ mode: 'sandbox-play', present: { level, placements: [{ id: piece.id, r: 1, c: 1, rotation: 0 }] } });
  assert.equal(dispatch(initial, { type: 'rotate', id: piece.id, pivot: { r: NaN, c: 1 } }).error?.code, 'coordinates');
  const blocked = dispatch(initial, { type: 'rotate', id: piece.id, pivot: { r: 1, c: 1 } });
  assert.equal(blocked.session, initial);
  assert.equal(blocked.error?.message, '固定地形上不能放置设施');
  assert.deepEqual(blocked.cells, [{ r: 1, c: 1 }, { r: 2, c: 1 }, { r: 1, c: 1 }]);
  const free = createSession({ ...initial, present: { level: { ...level, terrain: [] }, placements: initial.present.placements } });
  const rotated = dispatch(free, { type: 'rotate', id: piece.id, pivot: { r: 1, c: 2 } });
  assert.equal(rotated.error, null);
  assert.deepEqual(rotated.session.present.placements, [{ id: piece.id, r: 0, c: 2, rotation: 1 }]);
  assert.equal(dispatch(rotated.session, { type: 'undo' }).session.present, free.present);
});

test('session history caps at 80, keeps restored snapshots and discards redo after a branch', () => {
  const present = { level: getLevelById(1)!, placements: [] };
  let session: GameSession = createSession({ mode: 'survival', present });
  assert.equal(dispatch(session, { type: 'undo' }).session, session);
  assert.deepEqual(getAvailableActions(session), { undo: false, redo: false, pieces: present.level.pieces });
  for (let i = 0; i < 100; i++) session = dispatch(session, { type: 'clear' }).session;
  assert.equal(session.past.length, 80);
  const latest = session.present;
  session = dispatch(session, { type: 'undo' }).session;
  assert.equal(getAvailableActions(session).redo, true);
  assert.equal(dispatch(session, { type: 'redo' }).session.present, latest);
  session = dispatch(session, { type: 'clear' }).session;
  assert.deepEqual(session.future, []);
  const restored = createSession({ ...session, past: Array(90).fill(present), future: Array(90).fill(present) });
  assert.equal(restored.past.length, 80);
  assert.equal(restored.future.length, 80);
  assert.equal(restored.present, session.present);
  // Compile-time contract checks; these mutations must never type-check.
  if (false) {
    const state = getState(session);
    // @ts-expect-error Session history is owned by the Engine.
    session.past.push(present);
    // @ts-expect-error Snapshot placements are read-only.
    state.placements.push({ id: 'a', r: 0, c: 0, rotation: 0 });
    // @ts-expect-error Nested level data is read-only too.
    state.level.terrain[0].r = 1;
    // @ts-expect-error Placement records cannot be changed in place.
    state.placements[0].rotation = 1;
  }
});
