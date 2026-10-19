import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Check, Compass, Leaf, MousePointer2 } from 'lucide-react';
import { evaluate, facilityNames, terrainNames, key, occupied } from '../../engine';
import type { Cell, GameMode, Level, Placement, Status } from '../../engine';
import { useI18n } from '../../localization/LanguageContext';
import { Art, FacilityArt, FootprintSurface } from './Art';

const names = { ...facilityNames, ...terrainNames };
type Props = {
  boardRef: RefObject<HTMLElement | null>; mode: GameMode; level: Level;
  placements: readonly Placement[]; result: ReturnType<typeof evaluate>;
  celebration: 'board' | 'dialog' | null; showFacilityNames: boolean;
  hover: Cell | null; ghost: readonly Cell[]; ghostBlocked: boolean;
  ruleHints?: Record<string, Status>; setHover: (cell: Cell | null) => void;
  clickCell: (cell: Cell) => void; rotatePlaced: (at: Placement, pivot: Cell) => void;
};

function ClueCounter({ target, used, column = false }: { target: number; used: number; column?: boolean }) {
  const { t, localize } = useI18n();
  const left = Math.max(0, target - used), over = used > target;
  const clueRef = useRef<HTMLDivElement>(null), previous = useRef(used);
  useLayoutEffect(() => {
    clueRef.current?.getAnimations().forEach(animation => animation.cancel());
    if (previous.current !== target && used === target && !document.hidden) {
      clueRef.current?.animate([{ backgroundColor: '#efcf79', color: '#725629' }, { backgroundColor: 'transparent', color: '#a0b18b' }], { duration: 360 });
    }
    previous.current = used;
    return () => clueRef.current?.getAnimations().forEach(animation => animation.cancel());
  }, [target, used]);
  return <div ref={clueRef} className={`clue ${column ? 'column-clue' : ''} ${over ? 'over' : ''} ${used === target ? 'complete' : ''}`} aria-label={localize(t("需占 {0} 格，已占 {1} 格{2}", target, used, over ? '，超出提示' : ''))} title={localize(t("需要 {0} 格 · 已占 {1} 格", target, used))}>
    {over ? <span className="overflow-count">+{used - target}</span> : left === 0 ? <Check size={13} strokeWidth={2.5} /> : Array.from({ length: left }, (_, i) => <i key={i} />)}
  </div>;
}

export function GameBoard({ boardRef, mode, level, placements, result, celebration, showFacilityNames, hover, ghost, ghostBlocked, ruleHints, setHover, clickCell, rotatePlaced }: Props) {
  const { t, localize } = useI18n();
  return <section ref={boardRef} className={`board-section ${celebration ? 'celebrating' : ''} ${mode === 'survival' ? 'reward-board' : ''}`} aria-label={t("营地棋盘")}><div className="board-topline"><span><Compass size={16}/>  {t("营地规划图")}</span></div>
        <div className="board-with-clues" key={`${mode}-${level.id}`} style={{ '--size': level.size } as React.CSSProperties}>
          <div className="clue-corner"><Leaf size={17}/></div><div className="column-clues">{level.cols.map((target, i) => <ClueCounter key={i} target={target} used={result.cols[i]} column/>)}</div>
          <div className="row-clues">{level.rows.map((target, i) => <ClueCounter key={i} target={target} used={result.rows[i]}/>)}</div>
          <div className="board" role="group" aria-label={t("{0} 行 {1} 列棋盘", level.size, level.size)} onPointerLeave={() => setHover(null)}>{Array.from({ length: level.size * level.size }, (_, index) => {
            const cell = { r: Math.floor(index / level.size), c: index % level.size };
            const terrain = level.terrain.find(t => key(t) === key(cell));
            const at = placements.find(p => occupied(level.pieces.find(item => item.id === p.id)!, p).some(q => key(q) === key(cell)));
            const piece = at ? level.pieces.find(p => p.id === at.id)! : undefined;
            const footprint = at && piece ? occupied(piece, at) : [];
            const anchor = footprint[0];
            const isAnchor = anchor && key(anchor) === key(cell);
            const issue = at ? result.issues[at.id] : undefined;
            const isGhost = ghost.some(p => key(p) === key(cell));
            const hasNeighbor = (dr: number, dc: number) => footprint.some(p => p.r === cell.r + dr && p.c === cell.c + dc);
            const label = terrain ? names[terrain.kind] : piece ? `${names[piece.kind]}${issue?.reasons.length ? `：${issue.reasons.join('；')}` : ''}` : '空地';
            return <button key={index} data-sound="handled" data-cell={`${cell.r},${cell.c}`} data-piece-id={at?.id} data-rule-hint={ruleHints?.[key(cell)]?.toLowerCase()} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind} ${piece.shape !== 'single' ? 'placed-multi' : ''}` : ''} ${issue?.status === 'INVALID' ? 'invalid' : ''} ${issue?.status === 'INCOMPLETE' ? 'pending' : ''} ${isGhost ? `ghost ${ghostBlocked ? 'blocked' : ''}` : ''} ${hasNeighbor(-1, 0) ? 'join-top' : ''} ${hasNeighbor(1, 0) ? 'join-bottom' : ''} ${hasNeighbor(0, -1) ? 'join-left' : ''} ${hasNeighbor(0, 1) ? 'join-right' : ''}`} aria-label={t("第 {0} 行第 {1} 列，{2}", cell.r + 1, cell.c + 1, label)} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(cell); }} onFocus={() => setHover(cell)} onClick={() => clickCell(cell)} onContextMenu={event => { if (at && piece && piece.shape !== 'single') { event.preventDefault(); rotatePlaced(at, cell); } }}>
              {terrain ? <><Art kind={terrain.kind}/><span className={`terrain-label label-${terrain.kind}`} role="tooltip"><Art kind={terrain.kind}/>{localize(names[terrain.kind])}</span></> : piece ? <>{piece.shape === 'single' && <span className="single-facility-art" data-art-id={at!.id} key={at!.id}><Art kind={piece.kind}/></span>} {showFacilityNames && <span className={`terrain-label label-${piece.kind}`} role="tooltip"><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at!.rotation}/>{localize(names[piece.kind])}</span>}</> : <span className={`grass grass-${index % 5}`}></span>}
              {issue?.status === 'INVALID' && isAnchor && <span className="error-mark">!</span>}
              {issue?.status === 'INCOMPLETE' && isAnchor && <span className="pending-mark">·</span>}
              {isGhost && !terrain && !piece && <span className="ghost-dot"/>}
              {ruleHints?.[key(cell)] && <span className="rule-tint" aria-hidden="true"/>}
            </button>;
          })}<div className="facility-art-layer">{placements.map(at => {
            const piece = level.pieces.find(p => p.id === at.id)!;
            if (piece.shape === 'single') return null;
            const cells = occupied(piece, at);
            const row = Math.min(...cells.map(p => p.r)), column = Math.min(...cells.map(p => p.c));
            const width = Math.max(...cells.map(p => p.c)) - column + 1, height = Math.max(...cells.map(p => p.r)) - row + 1;
            const issue = result.issues[at.id];
            return <div className={`placed-facility-art ${issue.status.toLowerCase()} ${hover && cells.some(p => key(p) === key(hover)) ? 'hovered' : ''}`} key={at.id} data-art-id={at.id} data-kind={piece.kind} data-rotation={at.rotation} style={{ gridRow: `${row + 1} / span ${height}`, gridColumn: `${column + 1} / span ${width}` }}><FootprintSurface shape={piece.shape} rotation={at.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at.rotation}/></div>;
          })}</div><div className="facility-art-layer departure-art-layer" aria-hidden="true"/>
          {celebration && <div className="board-celebration" aria-hidden="true"><div className="board-golden-ring"/>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--particle': i, left: `${12 + (i * 29) % 78}%`, top: `${18 + (i * 37) % 70}%` } as React.CSSProperties}>{i % 3 === 0 ? <Leaf size={13}/> : '✦'}</i>)}</div>}
          </div>
        </div>
        <div className="board-legend"><span><i className="yellow-dash"/> {localize(mode === 'sandbox-editor' ? t("自动生成行列目标") : t("待占格数"))}</span><span><span className="legend-dot"/> {localize(mode === 'sandbox-editor' ? t("地形画笔可修改") : t("固定地形不可移动"))}</span><span><MousePointer2 size={13}/>  {t("点击放置 / 拿起")}</span></div>
      </section>;
}
