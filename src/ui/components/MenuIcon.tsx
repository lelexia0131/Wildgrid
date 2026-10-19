import { Art } from './Art';
import { art } from '../../assets/art';
import { facilityNames, terrainNames } from '../../engine';
import type { FacilityKind, TerrainKind } from '../../engine';
import type { MapIconId } from '../../game-modes/sandbox/mapIcons';

export function MenuIcon({ kind }: { kind: MapIconId | 'check' | 'share' | 'edit' | 'badge' | 'archive' | 'resume' | 'tools' | 'difficulty' | 'overview' | 'clues' | 'rotate' | 'settings' }) {
  if (kind in facilityNames || kind in terrainNames) return <Art kind={kind as FacilityKind | TerrainKind}/>;
  return <img className="art menu-icon" data-icon={kind} src={art.menuIcon(kind)} alt="" draggable={false} aria-hidden="true"/>;
}
