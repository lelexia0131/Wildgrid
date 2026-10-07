import { Art, FacilityArt, FootprintSurface } from './Art';
import { key, occupied } from '../game/rules';
import type { Level, Placement } from '../game/types';

export function Blueprint({ level, placements }: { level: Level; placements: Placement[] }) {
  const facilities = placements.map(at => {
    const piece = level.pieces.find(p => p.id === at.id)!;
    return { at, piece, cells: occupied(piece, at) };
  });
  return <section className="blueprint-content">
    <h2>day {level.id} · 图纸</h2>
    <div className="blueprint-sheet" role="img" aria-label={`day ${level.id} 的完整营地答案，全部 ${level.pieces.length} 个设施已放置`} style={{ '--size': level.size } as React.CSSProperties}>
      <div className="blueprint-corner"/>
      <div className="blueprint-columns">{level.cols.map((count, i) => <span key={i}>{count}</span>)}</div>
      <div className="blueprint-rows">{level.rows.map((count, i) => <span key={i}>{count}</span>)}</div>
      <div className="board blueprint-board">
        {Array.from({ length: level.size * level.size }, (_, index) => {
          const cell = { r: Math.floor(index / level.size), c: index % level.size };
          const terrain = level.terrain.find(t => key(t) === key(cell));
          const facility = facilities.find(f => f.cells.some(p => key(p) === key(cell)));
          const piece = facility?.piece;
          return <div key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind} ${piece.shape !== 'single' ? 'placed-multi' : ''}` : ''}`}>
            {terrain ? <Art kind={terrain.kind}/> : piece ? piece.shape === 'single' ? <Art kind={piece.kind}/> : null : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
          </div>;
        })}
        <div className="facility-art-layer">{facilities.filter(f => f.piece.shape !== 'single').map(({ at, piece, cells }) => {
          const row = Math.min(...cells.map(p => p.r)), column = Math.min(...cells.map(p => p.c));
          const width = Math.max(...cells.map(p => p.c)) - column + 1, height = Math.max(...cells.map(p => p.r)) - row + 1;
          return <div className="placed-facility-art valid" key={at.id} data-piece-id={at.id} data-kind={piece.kind} data-rotation={at.rotation} style={{ gridRow: `${row + 1} / span ${height}`, gridColumn: `${column + 1} / span ${width}` }}><FootprintSurface shape={piece.shape} rotation={at.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at.rotation}/></div>;
        })}</div>
      </div>
    </div>
  </section>;
}
