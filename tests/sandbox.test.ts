import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/levels.json';
import { checkSandbox, createSandbox, decodeMap, encodeMap, facilityLibrary, withEditorPlacements } from '../src/game/sandbox';
import type { SandboxDraft } from '../src/game/sandbox';
import type { Level } from '../src/game/types';

function camps(): SandboxDraft {
  const draft = createSandbox(6);
  draft.level.terrain = [1, 2].flatMap(c => [0, 3].map(r => ({ kind: 'water' as const, r, c })));
  draft.level.pieces = ['a', 'b'].map(id => ({ id, kind: 'camp', shape: 'single' }));
  return withEditorPlacements(draft, [{ id: 'a', r: 1, c: 1, rotation: 0 }, { id: 'b', r: 1, c: 2, rotation: 0 }]);
}

test('sandbox library is derived from adventure definitions and map codes restore both sizes exactly', () => {
  assert.deepEqual(new Set(facilityLibrary.map(p => `${p.kind}_${p.shape}`)), new Set((data as Level[]).flatMap(l => l.pieces.map(p => `${p.kind}_${p.shape}`))));
  const eight = createSandbox(8);
  eight.level.terrain = [{ kind: 'water', r: 3, c: 1 }, { kind: 'forest', r: 7, c: 7 }, { kind: 'mountain', r: 0, c: 6 }];
  eight.level.pieces = [{ id: 'rotated-camp', kind: 'camp', shape: 'domino' }];
  const rotated = withEditorPlacements(eight, [{ id: 'rotated-camp', r: 3, c: 2, rotation: 1 }]);
  for (const draft of [camps(), rotated]) {
    const code = encodeMap(draft);
    assert.match(code, /^WG1:[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeMap(code), draft);
    assert.equal(checkSandbox(draft).status, 'unique');
  }
  assert.equal(withEditorPlacements(camps(), []).level.pieces.length, 0);
});

test('self-check distinguishes unique, multiple, no solution and specific illegal placements', () => {
  const unique = camps();
  assert.equal(checkSandbox(unique).status, 'unique');
  const multiple = withEditorPlacements(unique, [{ id: 'a', r: 1, c: 1, rotation: 0 }, { id: 'b', r: 2, c: 2, rotation: 0 }]);
  assert.equal(checkSandbox(multiple).status, 'multiple');
  const none = { ...unique, level: { ...unique.level, rows: [0, 1, 0, 0, 0, 1] } };
  assert.equal(checkSandbox(none).status, 'none');
  const overlap = withEditorPlacements(unique, unique.placements.map(at => ({ ...at, r: 1, c: 1 })));
  assert.equal(checkSandbox(overlap).status, 'invalid');
  assert.match(checkSandbox(overlap).message, /营地与营地发生重叠/);
  assert.equal(checkSandbox(createSandbox(6)).status, 'invalid');
});

test('map import rejects corrupt, unsupported and unsafe payload data', () => {
  const code = encodeMap(camps());
  const payload = JSON.parse(Buffer.from(code.slice(4), 'base64url').toString('utf8'));
  const pack = (value: unknown) => `WG1:${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
  assert.throws(() => decodeMap(code.replace('WG1:', 'WG2:')), /不支持.*版本/);
  assert.throws(() => decodeMap(pack({ ...payload, v: 2 })), /不支持.*版本/);
  for (const invalid of [
    'WG1:%%%=', 'WG1:a', `WG1:${'a'.repeat(32768)}`,
    pack({ ...payload, s: 7 }), pack({ ...payload, t: [['unknown', 0, 0]] }),
    pack({ ...payload, f: [['camp_single', 'a', 6, 1, 0]] }),
    pack({ ...payload, f: [['camp_single', 'a', 1, 1, 4]] }),
    pack({ ...payload, f: [['camp_single', 'constructor', 1, 1, 0]] }),
    pack({ ...payload, f: [['unknown_single', 'a', 1, 1, 0]] }),
    pack({ ...payload, t: [...payload.t, payload.t[0]] }),
    pack({ ...payload, f: [...payload.f, payload.f[0]] }),
    pack({ ...payload, html: '<script>alert(1)</script>' }),
  ]) assert.throws(() => decodeMap(invalid));
});
