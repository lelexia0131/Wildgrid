import { useEffect, useState } from 'react';
import { key, occupied } from '../../engine/boardGeometry';
import type { Cell, Level, Placement } from '../../engine/types';
import { FacilityArt, FootprintSurface } from './Art';

export function HintBoardOverlay({ level, region = [], placement }: { level: Level; region?: readonly Cell[]; placement?: Placement }) {
  const [previous, setPrevious] = useState(placement);
  useEffect(() => {
    if (placement) { setPrevious(placement); return; }
    const timer = setTimeout(() => setPrevious(undefined), 220);
    return () => clearTimeout(timer);
  }, [placement]);
  const shown = placement ?? previous;
  const piece = shown && level.pieces.find(p => p.id === shown.id);
  const cells = piece && shown ? occupied(piece, shown) : [];
  const row = Math.min(...cells.map(p => p.r)), col = Math.min(...cells.map(p => p.c));
  return <>
    <div className="facility-art-layer hint-region-layer" aria-hidden="true">{Array.from({ length: level.size * level.size }, (_, i) => {
      const cell = { r: Math.floor(i / level.size), c: i % level.size };
      return <span key={i} className={`hint-cell ${region.some(p => key(p) === key(cell)) ? 'visible' : ''}`} style={{ gridRow: cell.r + 1, gridColumn: cell.c + 1 }}/>;
    })}</div>
    <div className={`facility-art-layer hint-preview-layer ${placement ? 'visible' : ''}`} aria-hidden="true">{piece && shown && <div className="placed-facility-art hint-facility" data-kind={piece.kind} data-rotation={shown.rotation} style={{ gridRow: `${row + 1} / span ${Math.max(...cells.map(p => p.r)) - row + 1}`, gridColumn: `${col + 1} / span ${Math.max(...cells.map(p => p.c)) - col + 1}` }}><FootprintSurface shape={piece.shape} rotation={shown.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={shown.rotation}/></div>}</div>
  </>;
}
