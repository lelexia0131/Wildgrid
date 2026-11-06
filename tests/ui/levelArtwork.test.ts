import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { JournalLevelSceneArt as SceneComponent } from '../../src/ui/components/JournalLevelSceneArt';
import { levels, evaluate, placementHints } from '../../src/engine';
import { JOURNAL_LEVEL_COVERS, JOURNAL_PALETTES } from '../../src/ui/components/journalArt';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => server.close());
const { JournalLevelSceneArt } = await server.ssrLoadModule('/src/ui/components/JournalLevelSceneArt.tsx') as { JournalLevelSceneArt: typeof SceneComponent };
const { GameBoard } = await server.ssrLoadModule('/src/ui/components/GameBoard.tsx');
const { SkyArt } = await server.ssrLoadModule('/src/ui/components/Art.tsx');

test('all 60 cover briefs use facilities and terrain available in their level', () => {
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
    if (level.id <= 45) assert.match(markup, new RegExp(`src="[^"]*journal-${String(level.id).padStart(2, '0')}\\.svg"`));
    if (level.id <= 45) assert.match(markup, /alt=""/);
    else assert.match(markup, /cloudscape/);
    assert.match(markup, /aria-hidden="true"/);
    assert.ok(markup.includes(`data-cover-level="${level.id}"`));
    assert.doesNotMatch(markup, /src="undefined"/);
  }
  for (let chapter = 0; chapter < 4; chapter++) {
    const covers = JOURNAL_LEVEL_COVERS.slice(chapter * 15, chapter * 15 + 15);
    assert.equal(new Set(covers.map(c => c.composition)).size, 15);
    assert.ok(new Set(covers.map(c => JOURNAL_PALETTES[c.palette].paper)).size >= 3);
  }
});

test('sky projections and placement colours coexist, with compact controls and the original board title', () => {
  const level=levels.find(l=>l.id===46)!, selected=level.pieces.find(p=>p.kind==='balloon')!;
  const result=evaluate(level,[]), ruleHints=placementHints(level,[],selected,0,result.issues);
  const markup=renderToStaticMarkup(createElement(GameBoard,{boardRef:{current:null},mode:'adventure',level,placements:[],result,celebration:null,showFacilityNames:false,hover:null,ghost:[],ghostBlocked:false,ruleHints,layer:'sky',onLayer:()=>{},setHover:()=>{},clickCell:()=>{},rotatePlaced:()=>{}}));
  const lake=markup.match(/<button[^>]*data-cell="2,2"[^>]*>[\s\S]*?<\/button>/)![0];
  assert.match(lake,/data-rule-hint="invalid"/);
  assert.match(lake,/class="rule-tint"/);
  assert.match(lake,/data-projection="water"/);
  assert.match(markup,/营地规划图/);
  assert.match(markup,/class="projection-toggle"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(markup,/>投影<|class="grass/);
});

test('aircraft artwork rotates into its full footprint and keeps every SVG paint reference local', () => {
  const markup=renderToStaticMarkup(createElement('div',null,['balloon','airship','kite','anchor','cloud'].flatMap(kind=>[0,1].map(rotation=>createElement(SkyArt,{key:`${kind}-${rotation}`,kind,rotation})))));
  const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'artwork in one view must not share paint IDs');
  for(const match of markup.matchAll(/url\(#([^\)]+)\)/g)) assert.ok(ids.includes(match[1]),match[1]);
  for(const box of ['0 0 200 100','0 0 100 200','0 0 300 100','0 0 100 300']) assert.ok(markup.includes(`viewBox="${box}"`));
});
