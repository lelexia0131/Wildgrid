import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dictionaries } from '../i18n';
import type { Language } from '../i18n';
import type { TutorialLesson, TutorialStep, TutorialTarget } from '../game/tutorial';
import './tutorial.css';

type Rect = { x: number; y: number; width: number; height: number };
const uiSelectors = { board: '.board', facilities: '.facility-list', undo: '[data-tutorial="undo"]', feedback: '.rule-dock, .guide-strip', goal: '.board-with-clues', win: '.win-content, .board' };
function targetElements(target: TutorialTarget): Element[] {
  switch (target.type) {
    case 'ui': {
      const element = document.querySelector(target.id === 'win' ? '.win-content .primary' : uiSelectors[target.id]);
      return [element?.getBoundingClientRect().width ? element : document.querySelector('.board')].filter((el): el is Element => !!el);
    }
    case 'facility': return Array.from(document.querySelectorAll('[data-facility]')).filter(el => el.getAttribute('data-facility') === target.kind && (!target.shape || el.getAttribute('data-shape') === target.shape)).slice(0, 1);
    case 'cell': return [document.querySelector(`[data-cell="${target.cell.r},${target.cell.c}"]`)].filter((el): el is Element => !!el);
    case 'instance': return Array.from(document.querySelectorAll('.tile[data-piece-id]')).filter(el => el.getAttribute('data-piece-id') === target.pieceId);
    case 'clues': return ['.row-clues', '.column-clues'].flatMap(selector => {
      const clues = Array.from(document.querySelectorAll(`${selector} .clue`));
      return [clues.find(el => el.querySelector('i')) || clues[0]].filter((el): el is Element => !!el);
    });
  }
}
function bounds(rects: Rect[]): Rect {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return { x, y, width: Math.max(...rects.map(r => r.x + r.width)) - x, height: Math.max(...rects.map(r => r.y + r.height)) - y };
}
function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function placeNarration(targets: Rect[], width: number, height: number, viewport: Rect, placement: TutorialStep['placement']): Rect {
  const focus = bounds(targets), gap = 20, edge = 12;
  const clampX = (x: number) => Math.max(edge, Math.min(x, viewport.width - width - edge));
  const clampY = (y: number) => Math.max(edge, Math.min(y, viewport.height - height - edge));
  const centerX = clampX(focus.x + focus.width / 2 - width / 2), centerY = clampY(focus.y + focus.height / 2 - height / 2);
  const top = { x: centerX, y: focus.y - height - gap, width, height };
  const bottom = { x: centerX, y: focus.y + focus.height + gap, width, height };
  const candidates = [placement === 'top' ? top : bottom, placement === 'top' ? bottom : top,
    { x: focus.x + focus.width + gap, y: centerY, width, height }, { x: focus.x - width - gap, y: centerY, width, height }];
  const fit = candidates.find(r => r.x >= edge && r.y >= edge && r.x + width <= viewport.width - edge && r.y + height <= viewport.height - edge);
  if (fit) return fit;
  const corners = [{ x: edge, y: edge }, { x: viewport.width - width - edge, y: edge }, { x: edge, y: viewport.height - height - edge }, { x: viewport.width - width - edge, y: viewport.height - height - edge }]
    .map(r => ({ ...r, width, height }));
  const clear = corners.find(r => targets.every(t => !intersects(r, t)));
  if (clear) return clear;
  const overlap = (r: Rect) => targets.reduce((area, t) => area + Math.max(0, Math.min(r.x + r.width, t.x + t.width) - Math.max(r.x, t.x)) * Math.max(0, Math.min(r.y + r.height, t.y + t.height) - Math.max(r.y, t.y)), 0);
  return corners.sort((a, b) => overlap(a) - overlap(b))[0];
}
type Props = { lesson: TutorialLesson; step: TutorialStep; index: number; language: Language; onNext: () => void; onBack: () => void; onSkip: () => void; portal?: HTMLElement | null };
export function TutorialOverlay({ lesson, step, index, language, onNext, onBack, onSkip, portal }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerAdvance = useRef(0);
  const [layout, setLayout] = useState<{ targets: Rect[]; card: Rect; viewport: Rect } | null>(null);
  const maskId = useId().replace(/:/g, '');
  const dictionary = dictionaries[language];
  const copy = step.copy === 'basics' ? dictionary.basics[step.id as keyof typeof dictionary.basics] : dictionary.facilities[step.id as keyof typeof dictionary.facilities];
  useLayoutEffect(() => {
    let elements = targetElements(step.target);
    if (!elements.length) elements = Array.from(document.querySelectorAll('.board'));
    elements[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    let frame = 0;
    const measure = () => {
      const viewport = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      const measured = elements.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
      const targets = (step.target.type === 'instance' && measured.length ? [bounds(measured.map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height })))] : measured)
        .map(r => {
          const circle = step.shape === 'circle' || step.target.type === 'clues';
          const diameter = Math.min(Math.max(r.width, r.height) + 12, viewport.width - 8, viewport.height - 8);
          const width = circle ? diameter : Math.min(r.width + 12, viewport.width - 8);
          const height = circle ? diameter : Math.min(r.height + 12, viewport.height - 8);
          return { x: Math.max(4, Math.min(r.x + r.width / 2 - width / 2, viewport.width - width - 4)), y: Math.max(4, Math.min(r.y + r.height / 2 - height / 2, viewport.height - height - 4)), width, height };
        });
      if (targets.length && cardRef.current) {
        const card = cardRef.current.getBoundingClientRect();
        const next = { targets, viewport, card: placeNarration(targets, card.width, card.height, viewport, step.placement) };
        setLayout(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step.target.type, JSON.stringify(step.target), step.placement, language, index, lesson.id]);
  useLayoutEffect(() => {
    if (!step.blockInteraction && step.advance !== 'click') return;
    const allowed = (target: EventTarget | null) => target instanceof Element && !!target.closest('.tutorial-narration, [data-tutorial="settings"]');
    const inFocus = (event: MouseEvent) => layout?.targets.some(r => step.shape === 'circle' || step.target.type === 'clues'
      ? Math.hypot(event.clientX - r.x - r.width / 2, event.clientY - r.y - r.height / 2) <= r.width / 2
      : event.clientX >= r.x && event.clientX <= r.x + r.width && event.clientY >= r.y && event.clientY <= r.y + r.height);
    const block = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
    const blockPointer = (event: Event) => { if (step.blockInteraction && !allowed(event.target)) block(event); };
    const boardCompletion = (event: Event) => step.id === 'complete' && event.target instanceof Element && !!event.target.closest('.board');
    const click = (event: MouseEvent) => {
      if (allowed(event.target)) return;
      blockPointer(event);
      if (step.advance === 'click' && (inFocus(event) || targetElements(step.target).some(el => el.contains(event.target as Node)))) {
        if (boardCompletion(event)) block(event);
        if (performance.now() - pointerAdvance.current > 400) onNext();
      }
    };
    const pointerup = (event: PointerEvent) => {
      if (allowed(event.target)) return;
      blockPointer(event);
      if (step.advance === 'click' && inFocus(event)) {
        if (boardCompletion(event)) block(event);
        pointerAdvance.current = performance.now();
        requestAnimationFrame(onNext);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (!step.blockInteraction) return;
      if (event.key === 'Tab' || allowed(event.target) && !event.ctrlKey && !event.metaKey && event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape' && step.allowSkip) onSkip();
      else if (event.key === 'Enter' || event.key === ' ') onNext();
    };
    document.addEventListener('pointerdown', blockPointer, true);
    document.addEventListener('pointerup', pointerup, true);
    document.addEventListener('contextmenu', blockPointer, true);
    document.addEventListener('click', click, true);
    window.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('pointerdown', blockPointer, true); document.removeEventListener('pointerup', pointerup, true); document.removeEventListener('contextmenu', blockPointer, true);
      document.removeEventListener('click', click, true); window.removeEventListener('keydown', keydown, true);
    };
  }, [step, layout, onNext, onSkip]);
  const shape = (r: Rect, props: { fill: string; key: number; className?: string; stroke?: string; strokeWidth?: number }) => step.shape === 'circle' || step.target.type === 'clues'
    ? <circle cx={r.x + r.width / 2} cy={r.y + r.height / 2} r={Math.max(r.width, r.height) / 2} {...props}/>
    : <rect x={r.x} y={r.y} width={r.width} height={r.height} rx={18} {...props}/>;
  const focus = layout?.targets[0], card = layout?.card;
  const start = card && focus ? { x: Math.max(card.x, Math.min(focus.x + focus.width / 2, card.x + card.width)), y: Math.max(card.y, Math.min(focus.y + focus.height / 2, card.y + card.height)) } : null;
  const end = focus && start ? { x: Math.max(focus.x, Math.min(start.x, focus.x + focus.width)), y: Math.max(focus.y, Math.min(start.y, focus.y + focus.height)) } : null;
  const content = <div className="tutorial-overlay" data-lesson={lesson.id} data-step={step.id}>
    {layout && <svg className="tutorial-focus" width={layout.viewport.width} height={layout.viewport.height} aria-hidden="true">
      <defs><mask id={maskId}><rect width="100%" height="100%" fill="white"/>{layout.targets.map((r, i) => shape(r, { fill: 'black', key: i }))}</mask><marker id={`${maskId}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#fff5d8" strokeWidth="2" strokeLinejoin="round"/></marker></defs>
      <rect width="100%" height="100%" fill="#42573c" fillOpacity=".32" mask={`url(#${maskId})`}/>
      {layout.targets.map((r, i) => shape(r, { className: 'tutorial-ring', fill: 'none', stroke: '#fff5d8', strokeWidth: 3, key: i }))}
      {step.arrow && start && end && <path className="tutorial-arrow" d={`M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 + 10} ${(start.y + end.y) / 2 - 10} ${end.x} ${end.y}`} fill="none" stroke="#fff5d8" strokeWidth="3" strokeLinecap="round" markerEnd={`url(#${maskId}-arrow)`}/>}
    </svg>}
    <div ref={cardRef} className="tutorial-narration" role="region" aria-label={copy.title} lang={language === 'zh' ? 'zh-CN' : 'en'} style={{ left: card?.x ?? 12, top: card?.y ?? 12, visibility: layout ? 'visible' : 'hidden' }}>
      <span className="tutorial-progress">{dictionary.controls.progress} {index + 1}/{lesson.steps.length}</span>
      <p aria-live="polite">{copy.text}</p>
      <small>{dictionary.controls.continue}</small>
      <div className="tutorial-controls">{step.allowSkip && <button className="tutorial-skip" onClick={onSkip}>{dictionary.controls.skip}</button>}<button disabled={index === 0} onClick={onBack}>{dictionary.controls.back}</button><button className="tutorial-next" onClick={onNext}>{index + 1 === lesson.steps.length ? lesson.facility ? dictionary.controls.understood : dictionary.controls.finish : dictionary.controls.next}</button></div>
    </div>
  </div>;
  return createPortal(content, portal || document.body);
}
