import { art } from '../../assets/art';

export function ChapterArtwork({ chapter }: { chapter: number }) {
  const layers = art.chapters[chapter];
  return <div className="chapter-art" aria-hidden="true">
    <img src={layers.base} alt="" draggable={false}/>
    <img className="chapter-cloud" src={layers.cloud} alt="" draggable={false}/>
    <img className="chapter-ripples" src={layers.ripples} alt="" draggable={false}/>
  </div>;
}
