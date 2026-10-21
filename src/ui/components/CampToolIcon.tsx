import { art } from '../../assets/art';

export type CampToolKind = 'undo' | 'blueprint' | 'restart' | 'hint' | 'save' | 'export' | 'abandon';

export function CampToolIcon({ kind }: { kind: CampToolKind }) {
  return <img className="camp-tool-art" src={art.toolIcon(kind)} alt="" draggable={false} aria-hidden="true"/>;
}
