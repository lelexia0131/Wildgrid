import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { ChapterArtwork } from '../components/ChapterArtwork';
import { JournalChapterBackground } from '../components/JournalChapterBackground';
import { MenuLandscapeBackground } from '../components/MenuLandscapeBackground';
import { JOURNAL_CHAPTERS, JOURNAL_LEVEL_COVERS, JOURNAL_PALETTES } from '../components/journalArt';
import { JournalLevelSceneArt } from '../components/JournalLevelSceneArt';
import { useI18n } from '../../localization/LanguageContext';
import { levels } from '../../engine';
import { levelUnlocked } from '../../game-modes/adventure/adventureProgress';
import { audio } from '../../platform/audio/WildernessAudio';
import chapterArrow from '../../assets/icons/tool-chapter-next.svg';
import { AdventureBadgeIcon, AdventureBadgeStats } from '../components/AdventureBadge';
import { ADVENTURE_BADGES } from '../../game-modes/adventure/adventureBadges';
import type { AdventureBadgeTier } from '../../game-modes/adventure/adventureBadges';

type Props = {
  completed: number[]; currentId: number; chapter: number | null;
  badges: Readonly<Record<number, AdventureBadgeTier>>;
  onChapter: (chapter: number | null) => void; onStart: (id: number) => void; onBack: () => void;
};

export function CampDiary({ completed, badges, currentId, chapter, onChapter, onStart, onBack }: Props) {
  const { t, language } = useI18n();
  const [direction, setDirection] = useState<'previous' | 'next'>('next');
  const [transition, setTransition] = useState<number | null>(null);
  const navigationChapter = transition ?? chapter ?? 0;
  const turningTo = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  useLayoutEffect(() => {
    const page = pageRef.current, spread = spreadRef.current, controls = controlsRef.current;
    if (!page || !spread || !controls) return;
    // Keep the arrows anchored to the grid without moving them with the page.
    const positionControls = () => {
      const p = page.getBoundingClientRect(), s = spread.getBoundingClientRect();
      Object.assign(controls.style, { left: `${s.left - p.left}px`, top: `${s.top - p.top}px`, width: `${s.width}px`, height: `${s.height}px` });
      page.parentElement!.style.setProperty('--journal-slide-distance', `${s.width + 24}px`);
      page.parentElement!.style.setProperty('--journal-clip-inline', `${Math.max(0, (p.width - s.width) / 2 - 12)}px`);
    };
    positionControls();
    const observer = new ResizeObserver(positionControls);
    observer.observe(page); observer.observe(spread);
    return () => observer.disconnect();
  }, [chapter, language]);
  function finishTurn() {
    const next = turningTo.current;
    if (next === null) return;
    turningTo.current = null;
    setTransition(null);
    onChapter(next);
  }
  useEffect(() => {
    if (transition === null) return;
    // WebViews can skip animation events when the app goes into the background.
    const timeout = window.setTimeout(finishTurn, 500);
    return () => window.clearTimeout(timeout);
  }, [transition, onChapter]);
  const recommended = levels.find(l => l.id === currentId && !completed.includes(l.id) && levelUnlocked(l.id, completed))
    || levels.find(l => !completed.includes(l.id) && levelUnlocked(l.id, completed));
  function turnChapter(next: number | null) {
    if (turningTo.current !== null && next !== null) return;
    if (next === chapter) return;
    if (next !== null && (!JOURNAL_CHAPTERS[next] || !levelUnlocked(levels[next * 15]?.id, completed))) return;
    audio.feedback('page');
    if (chapter !== null && next !== null) {
      setDirection(next < chapter ? 'previous' : 'next');
      turningTo.current = next;
      setTransition(next);
    } else {
      turningTo.current = null;
      setTransition(null);
      onChapter(next);
    }
  }
  function finishSwipe(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || chapter === null) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    suppressClickUntil.current = performance.now() + 400;
    turnChapter(chapter + (dx < 0 ? 1 : -1));
  }
  return <>{chapter === null ? <MenuLandscapeBackground scene="diary"/> : <><JournalChapterBackground chapter={chapter}/>{transition !== null && <div className="journal-chapter-background-incoming"><JournalChapterBackground chapter={transition}/></div>}</>}<main className={`levels-page camp-diary ${chapter === null ? 'chapter-selection' : `chapter-levels diary-${JOURNAL_CHAPTERS[transition ?? chapter].theme}`}`}>
    <button className="back-link" data-sound={chapter === null ? 'close' : 'handled'} onClick={() => chapter === null ? onBack() : turnChapter(null)}><ArrowLeft size={18}/>{chapter === null ? t('返回营地') : t('返回板块选择')}</button>
    {chapter === null ? <><div className="page-heading"><h1>{t('营地日记')}</h1></div><AdventureBadgeStats badges={badges}/><div className="chapter-grid">{JOURNAL_CHAPTERS.map(({ name }, index) => {
      const start = index * 15 + 1, locked = !levelUnlocked(start, completed);
      const count = completed.filter(id => id >= start && id < start + 15).length;
      return <button key={name} data-chapter={index} data-sound="handled" className={`chapter-card chapter-${index} ${locked ? 'locked' : ''} ${recommended && Math.floor((recommended.id - 1) / 15) === index ? 'recommended' : ''}`} disabled={locked} onClick={() => turnChapter(index)}>
        <ChapterArtwork chapter={index}/><span className="chapter-state">{locked ? <LockKeyhole size={23}/> : count === 15 ? <Check size={23}/> : <ArrowRight size={23}/>}</span>
        <span className="chapter-caption"><strong>{t(name)}</strong><span>{count}/15</span></span>
      </button>;
    })}</div></> : <div className="journal-level-navigation" data-direction={direction} aria-busy={transition !== null} onTouchStart={event => {
      const touch = event.touches[0];
      touchStart.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      suppressClickUntil.current = 0;
    }} onTouchEnd={finishSwipe} onTouchCancel={() => { touchStart.current = null; }} onClickCapture={event => {
      if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    }}>
      <div className="journal-chapter-viewport">{(transition === null ? [chapter] : [chapter, transition]).map(page => <div key={page} ref={page === chapter ? pageRef : undefined} className={`journal-chapter-page${transition === null ? '' : page === chapter ? ' chapter-exiting' : ' chapter-entering'}`} inert={transition !== null} aria-hidden={transition !== null && page === chapter} onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === 'journal-chapter-in') finishTurn();
      }}>
      <div className="page-heading"><h1>{t(JOURNAL_CHAPTERS[page].name)}</h1></div>
      <div className="journal-level-stage"><div ref={page === chapter ? spreadRef : undefined} className="journal-level-spread">
      <div className="level-grid">{levels.slice(page * 15, page * 15 + 15).map(l => {
      const locked = !levelUnlocked(l.id, completed), complete = completed.includes(l.id), badge = complete ? badges[l.id] : undefined;
      const colors = JOURNAL_PALETTES[JOURNAL_LEVEL_COVERS[l.id - 1].palette];
      const style = { '--cover-paper': colors.paper, '--cover-edge': colors.shade, '--cover-ink': colors.deep } as CSSProperties;
      return <button key={l.id} data-level={l.id} data-sound="handled" style={style} className={`level-card ${complete ? 'completed' : ''} ${locked ? 'locked' : 'playable'} ${recommended?.id === l.id ? 'recommended' : ''}`} disabled={locked} aria-label={`${l.id} · ${locked ? t('未解锁') : complete ? t('已完成') : t('开始游玩')}${badge ? ` · ${t(ADVENTURE_BADGES[badge].name)}` : ''}`} onClick={() => { if (turningTo.current === null) onStart(l.id); }}>
        <div className="level-card-top"><span>{l.id}</span>{badge ? <AdventureBadgeIcon tier={badge}/> : locked ? <LockKeyhole size={20}/> : complete ? <Check size={22}/> : <ArrowRight size={22}/>}</div>
        <JournalLevelSceneArt id={l.id}/>
      </button>;
    })}</div>
      </div></div>
      </div>)}</div>
      <div ref={controlsRef} className="journal-level-controls">
      {navigationChapter > 0 && <button type="button" className="journal-chapter-arrow journal-chapter-previous" data-sound="handled" aria-label={t('上一篇章')} disabled={!levelUnlocked(levels[(navigationChapter - 1) * 15]?.id, completed)} onClick={() => turnChapter(navigationChapter - 1)}><img src={chapterArrow} alt="" draggable={false}/></button>}
      {navigationChapter < JOURNAL_CHAPTERS.length - 1 && <button type="button" className="journal-chapter-arrow journal-chapter-next" data-sound="handled" aria-label={t('下一篇章')} disabled={!levelUnlocked(levels[(navigationChapter + 1) * 15]?.id, completed)} onClick={() => turnChapter(navigationChapter + 1)}><img src={chapterArrow} alt="" draggable={false}/></button>}
      </div>
    </div>}
  </main></>;
}
