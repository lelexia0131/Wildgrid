import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, dispatch, evaluate, getLevelById, getSolution, getState, key, occupied, placementHints, placementOrigin, solveLevel } from '../src/engine';
import type { Level, Piece } from '../src/engine';

test('L anchors keep the pointer occupied in all rotations, including board edges and history', () => {
  for (const kind of ['camp', 'cabin'] as const) for (let rotation = 0; rotation < 4; rotation++) {
    const piece: Piece = { id: kind, kind, shape: 'el' };
    const level: Level = { id: 0, name: '', chapter: '', tip: '', size: 6, terrain: [], pieces: [piece], rows: Array(6).fill(6), cols: Array(6).fill(6) };
    for (const [r, c] of [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]]) {
      const pointer = { r, c: c + (rotation === 3 ? 1 : 0) };
      const origin = placementOrigin(piece.shape, rotation, pointer);
      assert.deepEqual(origin, { r, c });
      const preview = occupied(piece, { ...origin, id: piece.id, rotation });
      assert.ok(preview.some(p => key(p) === key(pointer)));
      const initial = createSession({ mode: 'sandbox-play', present: { level, placements: [] } });
      const placed = dispatch(initial, { type: 'place', piece, cell: origin, rotation });
      assert.equal(placed.error, null);
      assert.deepEqual(occupied(piece, placed.session.present.placements[0]), preview);
      const removed = dispatch(placed.session, { type: 'remove', id: piece.id });
      assert.equal(dispatch(removed.session, { type: 'undo' }).session.present, placed.session.present);
      const replaced = dispatch(removed.session, { type: 'place', piece, cell: placementOrigin(piece.shape, rotation, pointer), rotation });
      assert.equal(replaced.error, null);
      assert.deepEqual(replaced.session.present.placements, placed.session.present.placements);
      const turned = dispatch(placed.session, { type: 'rotate', id: piece.id, pivot: pointer });
      if (turned.error) assert.equal(turned.session, placed.session);
      else {
        assert.ok(occupied(piece, turned.session.present.placements[0]).some(p => key(p) === key(pointer)));
        assert.equal(dispatch(turned.session, { type: 'undo' }).session.present, placed.session.present);
      }
    }
    const initial = createSession({ mode: 'sandbox-play', present: { level, placements: [] } });
    const pointer = rotation === 3 ? { r: 0, c: 0 } : { r: 0, c: 5 };
    assert.equal(dispatch(initial, { type: 'place', piece, cell: placementOrigin('el', rotation, pointer), rotation }).error?.code, 'blocked');
  }
  for (const shape of ['single', 'domino', 'long'] as const) for (let rotation = 0; rotation < 4; rotation++) {
    assert.deepEqual(placementOrigin(shape, rotation, { r: 2, c: 3 }), { r: 2, c: 3 });
  }
});

test('L rule hints evaluate the same occupied pointer cell as placement and preview', () => {
  const piece: Piece = { id: 'camp', kind: 'camp', shape: 'el' };
  // The bounding-box corner may contain terrain: it is not part of the L.
  const level: Level = { id: 0, name: '', chapter: '', tip: '', size: 6, terrain: [{ kind: 'water', r: 2, c: 2 }], pieces: [piece], rows: Array(6).fill(6), cols: Array(6).fill(6) };
  const hints = placementHints(level, [], piece, 3, {});
  assert.equal(hints['2,3'], 'VALID');
  assert.equal(hints['2,0'], 'INVALID');
  assert.equal(hints['2,2'], undefined);
  const origin = placementOrigin('el', 3, { r: 2, c: 3 });
  assert.equal(evaluate(level, [{ ...origin, id: piece.id, rotation: 3 }]).issues[piece.id].status, 'VALID');
});

test('diary levels 12, 14 and 15 have exactly one complete layout that wins through gameplay', () => {
  for (const id of [12, 14, 15]) {
    const level = getLevelById(id)!;
    const solved = solveLevel(level, Infinity);
    assert.equal(solved.aborted, false);
    assert.equal(solved.count, 1, `Level ${id}`);
    assert.equal(evaluate(level, getSolution(id)!).won, true);
    let session = createSession({ mode: 'adventure', present: { level, placements: [] } });
    for (const at of solved.solutions[0]) {
      const placed = dispatch(session, { type: 'place', piece: level.pieces.find(piece => piece.id === at.id)!, cell: at, rotation: at.rotation });
      assert.equal(placed.error, null);
      session = placed.session;
    }
    assert.equal(getState(session).result.won, true, `Level ${id}`);
  }
});
