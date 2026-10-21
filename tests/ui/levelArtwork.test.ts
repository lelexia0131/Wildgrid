import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { JournalLevelSceneArt as SceneComponent } from '../../src/ui/components/JournalLevelSceneArt';
import { levels } from '../../src/engine';
import { JOURNAL_LEVEL_COVERS, JOURNAL_PALETTES } from '../../src/ui/components/journalArt';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => server.close());
const { JournalLevelSceneArt } = await server.ssrLoadModule('/src/ui/components/JournalLevelSceneArt.tsx') as { JournalLevelSceneArt: typeof SceneComponent };

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
    assert.match(markup, new RegExp(`src="[^"]*journal-${String(level.id).padStart(2, '0')}\\.svg"`));
    assert.match(markup, /alt=""/);
    assert.match(markup, /aria-hidden="true"/);
    assert.ok(markup.includes(`data-cover-level="${level.id}"`));
    assert.doesNotMatch(markup, /src="undefined"/);
  }
  for (let chapter = 0; chapter < 3; chapter++) {
    const covers = JOURNAL_LEVEL_COVERS.slice(chapter * 15, chapter * 15 + 15);
    assert.equal(new Set(covers.map(c => c.composition)).size, 15);
    assert.ok(new Set(covers.map(c => JOURNAL_PALETTES[c.palette].paper)).size >= 3);
  }
});
