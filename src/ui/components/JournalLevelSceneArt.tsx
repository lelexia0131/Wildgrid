import {art} from '../../assets/art';
import {JOURNAL_LEVEL_COVERS} from './journalArt';

export function JournalLevelSceneArt({id}:{id:number}){
  const cover=JOURNAL_LEVEL_COVERS[id-1];
  return <img className="level-cover-art journal-scene-art model-cover" src={art.modelScene('day-'+id)} data-cover-level={id}
    data-cover-main={cover.main} data-cover-layout={cover.composition} alt="" aria-hidden="true" draggable={false}/>;
}
