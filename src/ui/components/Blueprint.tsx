import { useState } from 'react';
import { CloudSun, Sprout } from 'lucide-react';
import { useI18n } from '../../localization/LanguageContext';
import { Art, FacilityArt, FootprintSurface } from './Art';
import { key, occupied, facilityLayer, layerClues } from '../../engine';
import type { BoardLayer, Level, Placement } from '../../engine';

export function Blueprint({ level, placements, name = `day ${level.id}` }: { level: Level; placements: readonly Placement[]; name?: string }) {
  const { localize, t } = useI18n();
  const [layer, setLayer] = useState<BoardLayer>('ground');
  const clues = layerClues(level, layer);
  const facilities = placements.filter(at => facilityLayer(level.pieces.find(p => p.id === at.id)!.kind) === layer).map(at => {
    const piece = level.pieces.find(p => p.id === at.id)!;
    return { at, piece, cells: occupied(piece, at) };
  });
  return <section className={`blueprint-content ${level.sky ? 'layered-blueprint' : ''}`} data-layer={layer}><div className="blueprint-folio">
    {level.sky && <div className="blueprint-tabs" role="tablist" aria-label={t('切换棋盘')} onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); const next = layer === 'ground' ? 'sky' : 'ground'; setLayer(next);
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-blueprint-layer="${next}"]`)?.focus();
    }}>{(['ground', 'sky'] as const).map(view => <button key={view} id={`blueprint-tab-${view}`} role="tab" type="button" aria-selected={layer === view} aria-controls="blueprint-sheet" tabIndex={layer === view ? 0 : -1} data-blueprint-layer={view} className={layer === view ? 'active' : ''} onClick={() => setLayer(view)}>{view === 'ground' ? <Sprout size={17}/> : <CloudSun size={17}/>}<span>{t(view === 'ground' ? '地面' : '天空')}</span></button>)}</div>}
    <div id="blueprint-sheet" className="blueprint-sheet" role={level.sky ? 'tabpanel' : 'img'} aria-labelledby={level.sky ? `blueprint-tab-${layer}` : undefined} aria-label={localize(t("{0} 的完整营地答案，全部 {1} 个设施已放置", name, level.pieces.length))} style={{ '--size': level.size } as React.CSSProperties}>
      <div className="blueprint-corner"/>
      <div className="blueprint-columns">{clues.cols.map((count, i) => <span key={i}>{count}</span>)}</div>
      <div className="blueprint-rows">{clues.rows.map((count, i) => <span key={i}>{count}</span>)}</div>
      <div className="board blueprint-board" data-layer={layer}>
        {Array.from({ length: level.size * level.size }, (_, index) => {
          const cell = { r: Math.floor(index / level.size), c: index % level.size };
          const fixed = (layer === 'sky' ? level.sky?.clouds : level.sky?.anchors)?.find(t => key(t) === key(cell));
          const terrain = fixed ? { ...fixed, kind: layer === 'sky' ? 'cloud' as const : 'anchor' as const } : layer === 'ground' ? level.terrain.find(t => key(t) === key(cell)) : undefined;
          const facility = facilities.find(f => f.cells.some(p => key(p) === key(cell)));
          const piece = facility?.piece;
          return <div key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind} ${piece.shape !== 'single' ? 'placed-multi' : ''}` : ''}`}>
            {terrain ? <Art kind={terrain.kind}/> : piece ? piece.shape === 'single' ? <Art kind={piece.kind}/> : null : <span className={layer === 'sky' ? `sky-wisp sky-wisp-${index % 5}` : `grass grass-${index % 5}`} aria-hidden="true"/>}
          </div>;
        })}
        <div className="facility-art-layer">{facilities.filter(f => f.piece.shape !== 'single').map(({ at, piece, cells }) => {
          const row = Math.min(...cells.map(p => p.r)), column = Math.min(...cells.map(p => p.c));
          const width = Math.max(...cells.map(p => p.c)) - column + 1, height = Math.max(...cells.map(p => p.r)) - row + 1;
          return <div className="placed-facility-art valid" key={at.id} data-piece-id={at.id} data-kind={piece.kind} data-rotation={at.rotation} style={{ gridRow: `${row + 1} / span ${height}`, gridColumn: `${column + 1} / span ${width}` }}><FootprintSurface shape={piece.shape} rotation={at.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at.rotation}/></div>;
        })}</div>
      </div>
    </div></div>
  </section>;
}
