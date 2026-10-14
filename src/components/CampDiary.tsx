import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ChapterArtwork } from './ChapterArtwork';
import { JournalChapterBackground } from './JournalChapterBackground';
import { journalChapters, journalLevelCovers, journalPalettes } from './journalArt';
import { LevelArtwork } from './LevelArtwork';
import { useI18n } from '../i18n/context';
import { levels } from '../game/levels';
import { levelUnlocked } from '../game/storage';
import { audio } from '../game/audio';

type Props = {
  completed: number[]; currentId: number; chapter: number | null;
  onChapter: (chapter: number | null) => void; onStart: (id: number) => void; onBack: () => void;
};

export function CampDiary({ completed, currentId, chapter, onChapter, onStart, onBack }: Props) {
  const { t } = useI18n();
  const recommended = levels.find(l => l.id === currentId && !completed.includes(l.id) && levelUnlocked(l.id, completed))
    || levels.find(l => !completed.includes(l.id) && levelUnlocked(l.id, completed));
  function turnChapter(next: number | null) {
    if (next === chapter) return;
    audio.feedback('page'); onChapter(next);
  }
  return <main className={`levels-page camp-diary ${chapter === null ? 'chapter-selection' : `chapter-levels diary-${journalChapters[chapter].theme}`}`}>
    {chapter !== null && <JournalChapterBackground chapter={chapter}/>}
    <button className="back-link" data-sound={chapter === null ? 'close' : 'handled'} onClick={() => chapter === null ? onBack() : turnChapter(null)}><ArrowLeft size={18}/>{chapter === null ? t('返回营地') : t('返回板块选择')}</button>
    <div className="page-heading"><h1>{chapter === null ? t('营地日记') : t(journalChapters[chapter].name)}</h1></div>
    {chapter === null ? <div className="chapter-grid">{journalChapters.map(({ name }, index) => {
      const start = index * 15 + 1, locked = !levelUnlocked(start, completed);
      const count = completed.filter(id => id >= start && id < start + 15).length;
      return <button key={name} data-chapter={index} data-sound="handled" className={`chapter-card chapter-${index} ${locked ? 'locked' : ''} ${recommended && Math.floor((recommended.id - 1) / 15) === index ? 'recommended' : ''}`} disabled={locked} onClick={() => turnChapter(index)}>
        <ChapterArtwork chapter={index}/><span className="chapter-state">{locked ? <LockKeyhole size={23}/> : count === 15 ? <Check size={23}/> : <ArrowRight size={23}/>}</span>
        <span className="chapter-caption"><strong>{t(name)}</strong><span>{count}/15</span></span>
      </button>;
    })}</div> : <div className="journal-level-stage"><div className="level-grid">{levels.slice(chapter * 15, chapter * 15 + 15).map(l => {
      const locked = !levelUnlocked(l.id, completed), complete = completed.includes(l.id);
      const colors = journalPalettes[journalLevelCovers[l.id - 1].palette];
      const style = { '--cover-paper': colors.paper, '--cover-edge': colors.shade, '--cover-ink': colors.deep } as CSSProperties;
      return <button key={l.id} data-level={l.id} data-sound="handled" style={style} className={`level-card ${complete ? 'completed' : ''} ${locked ? 'locked' : 'playable'} ${recommended?.id === l.id ? 'recommended' : ''}`} disabled={locked} aria-label={`${l.id} · ${locked ? t('未解锁') : complete ? t('已完成') : t('开始游玩')}`} onClick={() => onStart(l.id)}>
        <div className="level-card-top"><span>{l.id}</span>{locked ? <LockKeyhole size={20}/> : complete ? <Check size={22}/> : <ArrowRight size={22}/>}</div>
        <LevelArtwork id={l.id}/>
      </button>;
    })}</div></div>}
  </main>;
}
