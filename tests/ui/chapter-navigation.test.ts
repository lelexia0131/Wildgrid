import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CampDiary as CampDiaryComponent } from '../../src/ui/screens/CampDiary';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => server.close());
const { CampDiary } = await server.ssrLoadModule('/src/ui/screens/CampDiary.tsx') as { CampDiary: typeof CampDiaryComponent };
const { JOURNAL_CHAPTERS } = await server.ssrLoadModule('/src/ui/components/journalArt.ts');
const { LanguageContext } = await server.ssrLoadModule('/src/localization/LanguageContext.tsx');
const { levels } = await server.ssrLoadModule('/src/engine/levels.ts');
const completed = levels.map((level: { id: number }) => level.id);
const render = (chapter: number | null, progress = completed, language = 'zh', page = 0) => renderToStaticMarkup(
  createElement(LanguageContext.Provider, { value: language }, createElement(CampDiary, {
    chapter, page, onPage: () => {}, completed: progress, badges: {}, currentId: 1, onChapter: () => {}, onStart: () => {}, onBack: () => {},
  })),
);

test('chapter arrows follow the data order, with correct boundaries and real SVG URLs', () => {
  for (let chapter = 0; chapter < JOURNAL_CHAPTERS.length; chapter++) {
    const markup = render(chapter);
    assert.equal(markup.includes('journal-chapter-previous'), chapter > 0);
    assert.equal(markup.includes('journal-chapter-next'), chapter < JOURNAL_CHAPTERS.length - 1);
    const arrows = markup.match(/<button[^>]*journal-chapter-arrow[^>]*>.*?<\/button>/g) || [];
    for (const arrow of arrows) {
      assert.match(arrow, /src="[^"]*tool-chapter-next\.svg"/);
      assert.doesNotMatch(arrow, /disabled|undefined/);
      assert.match(arrow, /alt=""/);
    }
    assert.equal((markup.match(/data-level=/g) || []).length, 15);
  }
  assert.doesNotMatch(render(null), /journal-chapter-arrow/);
});

test('locked chapters retain a disabled arrow and existing level unlocks', () => {
  assert.match(render(0, []), /<button[^>]*journal-chapter-next[^>]*disabled/);
  assert.doesNotMatch(render(0, [15]), /<button[^>]*journal-chapter-next[^>]*disabled/);
  const markup = render(1, [15]);
  assert.doesNotMatch(markup, /<button[^>]*data-level="16"[^>]*disabled/);
  assert.match(markup, /<button[^>]*data-level="17"[^>]*disabled/);
});

test('arrow labels support both languages without adding visible text', () => {
  for (const [language, previous, next] of [['zh', '上一篇章', '下一篇章'], ['en', 'Previous chapter', 'Next chapter']]) {
    const markup = render(1, completed, language);
    assert.ok(markup.includes(`aria-label="${previous}"`));
    assert.ok(markup.includes(`aria-label="${next}"`));
    for (const arrow of markup.match(/<button[^>]*journal-chapter-arrow[^>]*>.*?<\/button>/g) || []) {
      assert.equal(arrow.replace(/<[^>]*>/g, ''), '');
    }
  }
  const svg = readFileSync('src/assets/icons/tool-chapter-next.svg', 'utf8');
  assert.doesNotMatch(svg, /<text|<script|<image|href=/);
});

test('overview pages contain only three themes and icon-only navigation above the badges', () => {
  for(const page of [0,1]) {
    const markup=render(null,completed,'zh',page);
    const nav=markup.match(/<nav class="chapter-pagination"[^>]*>[\s\S]*?<\/nav>/)![0];
    assert.match(nav,/tool-chapter-next\.svg/);
    assert.doesNotMatch(nav,/>上一页<|>下一页</);
    assert.ok(markup.indexOf('chapter-pagination')<markup.indexOf('首次通关徽章统计'));
    assert.equal((markup.match(/data-chapter="/g)||[]).length,page===0?3:1);
    if(page===1) assert.match(markup,/data-chapter="3"/);
  }
});

test('Cloudsea and Day 46 stay locked until Day 45 is completed', () => {
  const before45 = completed.filter((id: number) => id < 45);
  assert.match(render(null, before45, 'zh', 1), /<button[^>]*data-chapter="3"[^>]*disabled/);
  assert.match(render(2, before45), /<button[^>]*journal-chapter-next[^>]*disabled/);
  assert.match(render(3, before45), /<button[^>]*data-level="46"[^>]*disabled/);
  const after45 = [...before45, 45];
  assert.doesNotMatch(render(null, after45, 'zh', 1), /<button[^>]*data-chapter="3"[^>]*disabled/);
  assert.doesNotMatch(render(2, after45), /<button[^>]*journal-chapter-next[^>]*disabled/);
  assert.doesNotMatch(render(3, after45), /<button[^>]*data-level="46"[^>]*disabled/);
  assert.match(render(3, after45), /<button[^>]*data-level="47"[^>]*disabled/);
});
