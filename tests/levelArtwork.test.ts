import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JournalLevelSceneArt } from '../src/ui/components/JournalLevelSceneArt';
import { levels } from '../src/engine';
import { JOURNAL_LEVEL_COVERS, JOURNAL_PALETTES } from '../src/ui/components/journalArt';

test('all 45 cover briefs use facilities and terrain available in their level', () => {
  assert.equal(JOURNAL_LEVEL_COVERS.length, levels.length);
  for (const level of levels) {
    const cover = JOURNAL_LEVEL_COVERS[level.id - 1];
    const counts = new Map<string, number>();
    for (const kind of cover.subjects) {
      const count = (counts.get(kind) || 0) + 1;
      counts.set(kind, count);
      assert.ok(count <= level.pieces.filter(piece => piece.kind === kind).length, `Level ${level.id}: ${kind}`);
    }
    for (const kind of cover.environment) assert.ok(level.terrain.some(t => t.kind === kind), `Level ${level.id}: ${kind}`);
    assert.ok([...cover.subjects, ...cover.environment].includes(cover.main));
    const markup = renderToStaticMarkup(createElement(JournalLevelSceneArt, { id: level.id }));
    assert.ok(markup.includes('viewBox="0 0 320 220"'));
    assert.ok(markup.includes('preserveAspectRatio="xMidYMid meet"'));
  }
  for (let chapter = 0; chapter < 3; chapter++) {
    const covers = JOURNAL_LEVEL_COVERS.slice(chapter * 15, chapter * 15 + 15);
    assert.equal(new Set(covers.map(c => c.composition)).size, 15);
    assert.ok(new Set(covers.map(c => JOURNAL_PALETTES[c.palette].paper)).size >= 3);
  }
});
