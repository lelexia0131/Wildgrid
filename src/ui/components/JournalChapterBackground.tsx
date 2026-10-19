import { art } from '../../assets/art';

export function JournalChapterBackground({ chapter }: { chapter: number }) {
  return <img className="journal-chapter-background" src={art.backgrounds.chapters[chapter]} alt="" draggable={false} aria-hidden="true"/>;
}
