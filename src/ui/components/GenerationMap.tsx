import { useEffect, useState } from 'react';
import { Art, FacilityArt } from './Art';
import type { FacilityKind, TerrainKind } from '../../engine';

const kinds: Record<string, FacilityKind | TerrainKind | undefined> = { W: 'water', F: 'forest', M: 'mountain', C: 'camp', B: 'fire', P: 'picnic', E: 'powerTower', V: 'foodTruck', T: 'tower', S: 'pool' };
const layouts = [
  ['W.FMF', '.M...', '.WCB.', 'MF.M.', 'FWF.M'],
  ['F.M.F', 'M.WC.', 'F..B.', '.WM..', 'F...M'],
  ['MEFW.', '.M.M.', 'WCB..', '....F', 'MF.WM'],
  ['FMT.E', '.....', 'WCPp.', '..MF.', '.V..W'],
  ['F..MT', '.....', 'WCB..', 'S....', '.V..E'],
  ['MW.EF', '.CPp.', 'WS...', '...M.', 'F..T.'],
].map(rows => rows.join('').split('').map(cell => kinds[cell]));

export function GenerationMap() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(value => (value + 1) % layouts.length), 1600);
    return () => clearInterval(timer);
  }, []);
  return <div className="generation-map" aria-hidden="true">{layouts[frame].map((kind, i) => <span key={i} data-kind={kind} style={{ '--cell-delay': `${i * 22}ms` } as React.CSSProperties}>{kind === 'picnic' ? <div key={frame} className="generation-wide-art"><FacilityArt kind={kind} shape="domino"/></div> : kind && <Art key={frame} kind={kind}/>}</span>)}</div>;
}
