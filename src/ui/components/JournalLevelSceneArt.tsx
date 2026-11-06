import { art } from '../../assets/art';
import { JOURNAL_LEVEL_COVERS } from './journalArt';
import { Cloudscape } from './ChapterArtwork';

export function JournalLevelSceneArt({ id }: { id: number }) {
  if (id >= 46) return <div className="level-cover-art journal-scene-art" data-cover-level={id} aria-hidden="true"><Cloudscape variant={id - 46}/></div>;
  const cover = JOURNAL_LEVEL_COVERS[id - 1];
  return <img className="level-cover-art journal-scene-art" src={art.journal[id - 1]} alt="" draggable={false} aria-hidden="true" data-cover-main={cover.main} data-cover-layout={cover.composition} data-cover-level={id}/>;
}
