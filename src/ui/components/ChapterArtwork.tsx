import {art} from '../../assets/art';

export function ChapterArtwork({chapter}:{chapter:number}) {
  return <div className="chapter-art" aria-hidden="true"><img className="model-chapter" src={art.modelScene('chapter-'+chapter)} alt="" draggable={false}/></div>;
}
