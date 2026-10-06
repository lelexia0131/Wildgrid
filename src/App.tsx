import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Flag, Grid2X2, Leaf, LockKeyhole, Map, MousePointer2, Redo2, RotateCcw, Settings2, Sparkles, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import { Art, CampArt, Landscape } from './components/Art';
import data from './data/levels.json';
import { Manual } from './components/Manual';
import { evaluate, key, occupied, offsets, placementBlock, rotateAround } from './game/rules';
import { progressForPlay, readSave, writeSave } from './game/storage';
import { audio } from './game/audio';
import type { Cell, FacilityKind, Level, Placement, Shape, TerrainKind } from './game/types';

const levels = data as Level[];
const advancedArt: (FacilityKind | TerrainKind)[] = ['tower', 'water', 'forest', 'picnic', 'picnic', 'camp', 'tower', 'picnic', 'cabin', 'picnic', 'cabin', 'fire', 'tower', 'cabin', 'cabin'];
const levelLabel = (id: number) => `第 ${id} 关`;
const names: Record<FacilityKind | TerrainKind, string> = { camp: '营地', fire: '篝火', tower: '瞭望塔', picnic: '野餐桌', cabin: '林间木屋', water: '水源', forest: '森林', mountain: '山地' };
const shapeNames: Record<Shape, string> = { single: '单格', domino: '双格', long: '三格', el: 'L 形' };
const rules: Record<FacilityKind, [string, string]> = { camp: ['至少一格挨着水源（上下左右）', '覆盖地形、重叠设施'], fire: ['上下左右挨着营地', '邻森林（含斜角）'], tower: ['上下左右挨着山地', '邻其他塔（含斜角）'], picnic: ['至少一格挨着营地（上下左右）', '邻篝火（含斜角）'], cabin: ['至少一格挨着森林（上下左右）', '任意一格上下左右挨着水'] };
type History = { past: Placement[][]; present: Placement[]; future: Placement[][] };

function Dashes({ target, used, column = false }: { target: number; used: number; column?: boolean }) {
  const left = Math.max(0, target - used), over = used > target;
  return <div className={`clue ${column ? 'column-clue' : ''} ${over ? 'over' : ''}`} aria-label={`需占 ${target} 格，已占 ${used} 格${over ? '，超出提示' : ''}`} title={`需要 ${target} 格 · 已占 ${used} 格`}>
    {over ? <span className="overflow-count">+{used - target}</span> : left === 0 ? <Check size={13} strokeWidth={2.5} /> : Array.from({ length: left }, (_, i) => <i key={i} />)}
  </div>;
}

export default function App() {
  const [save, setSave] = useState(() => readSave(levels));
  const [screen, setScreen] = useState<'menu' | 'levels' | 'game'>('menu');
  const [levelId, setLevelId] = useState(save.current);
  const [history, setHistory] = useState<History>({ past: [], present: progressForPlay(save, levels[save.current - 1]), future: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [rotations, setRotations] = useState<Partial<Record<Shape, number>>>({});
  const [hover, setHover] = useState<Cell | null>(null);
  const [notice, setNotice] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [tipGroup, setTipGroup] = useState<FacilityKind | null>(null);
  const [tipShape, setTipShape] = useState<Shape>('single');
  const boardRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const wonRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const level = levels[levelId - 1];
  const placements = history.present;
  const result = useMemo(() => evaluate(level, placements), [level, placements]);
  const selectedPiece = level.pieces.find(p => p.id === selected);
  const rotation = selectedPiece ? rotations[selectedPiece.shape] || 0 : 0;
  const unlocked = Math.min(levels.length, Math.max(1, ...save.completed.map(id => id + 1)));
  const groups = level.pieces.filter((p, i, all) => all.findIndex(other => other.kind === p.kind && other.shape === p.shape) === i);
  const invalidCount = Object.values(result.issues).filter(i => i.status === 'INVALID').length;
  const errors = [...new Set(Object.values(result.issues).filter(i => i.status === 'INVALID').flatMap(i => i.reasons))];

  useLayoutEffect(() => {
    if (!boardRef.current || !toolsRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (toolsRef.current) toolsRef.current.style.height = entry.target.getBoundingClientRect().height + 'px';
    });
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, [screen]);
  const shownKind = selectedPiece?.kind || tipGroup;
  const shownShape = selectedPiece?.shape || tipShape;

  useLayoutEffect(() => { setSaved(writeSave(save)); }, [save]);
  useEffect(() => { audio.setSettings(save.settings); }, [save.settings]);
  useEffect(() => { audio.setScene(screen === 'game' ? 'game' : 'menu'); }, [screen]);
  useLayoutEffect(() => {
    if (screen === 'game') setSave(s => ({ ...s, current: levelId, progress: { ...s.progress, [levelId]: placements } }));
  }, [levelId, placements, screen]);
  useEffect(() => {
    if (screen === 'game' && result.won && !wonRef.current) {
      wonRef.current = true; setWinOpen(true); setSelected(null); audio.play('win');
      setSave(s => ({ ...s, completed: [...new Set([...s.completed, levelId])] }));
    } else if (!result.won) wonRef.current = false;
  }, [result.won, levelId, screen]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (settingsOpen || winOpen || manualOpen) { dialog?.showModal(); closeRef.current?.focus(); }
    else dialog?.close();
  }, [settingsOpen, winOpen, manualOpen]);

  const sound = (name: Parameters<typeof audio.play>[0] = 'click') => { void audio.start().then(() => audio.play(name)); };
  const commit = useCallback((next: Placement[]) => { setHistory(h => ({ past: [...h.past.slice(-79), h.present], present: next, future: [] })); }, []);
  const rotate = useCallback(() => {
    if (!selectedPiece || selectedPiece.shape === 'single') return;
    setRotations(s => ({ ...s, [selectedPiece.shape]: ((s[selectedPiece.shape] || 0) + 1) % 4 })); audio.play('rotate');
  }, [selectedPiece]);
  const undo = useCallback(() => {
    setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
    setSelected(null); setNotice(''); audio.play('click');
  }, []);
  const redo = useCallback(() => {
    setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
    setSelected(null); setNotice(''); audio.play('click');
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (screen !== 'game' || settingsOpen || winOpen || manualOpen || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); rotate(); }
      if (event.key === 'Escape') { setSelected(null); setNotice(''); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [screen, settingsOpen, winOpen, manualOpen, rotate, undo, redo]);

  function start(id: number, reset = false) {
    sound(); setSelected(null); setRotations({}); setHover(null); setNotice(''); setWinOpen(false);
    wonRef.current = false;
    setLevelId(id); setHistory({ past: [], present: reset ? [] : progressForPlay(save, levels[id - 1]), future: [] }); setScreen('game');
  }
  function restart() { sound(); commit([]); setSelected(null); setRotations({}); setNotice(''); setWinOpen(false); }
  function choose(kind: FacilityKind, shape: Shape) {
    if (selectedPiece?.kind === kind && selectedPiece.shape === shape) { if (shape !== 'single') rotate(); else setSelected(null); return; }
    const piece = level.pieces.find(p => p.kind === kind && p.shape === shape && !placements.some(at => at.id === p.id));
    if (piece) { setSelected(piece.id); setNotice(''); sound('select'); }
  }
  function rotatePlaced(at: Placement, pivot: Cell) {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const next = rotateAround(piece, at, pivot);
    const block = placementBlock(level, placements, next);
    if (block) { setNotice(block.includes('地形') || block.includes('重叠') ? '已经被占用' : block); sound('error'); return; }
    commit(placements.map(p => p.id === at.id ? next : p)); setNotice(''); sound('rotate');
  }
  function clickCell(cell: Cell) {
    const placed = placements.find(at => occupied(level.pieces.find(p => p.id === at.id)!, at).some(p => key(p) === key(cell)));
    if (placed) {
      const issue = result.issues[placed.id];
      const piece = level.pieces.find(p => p.id === placed.id)!;
      commit(placements.filter(at => at.id !== placed.id)); setSelected(placed.id); setRotations(s => ({ ...s, [piece.shape]: placed.rotation }));
      setNotice(issue.status === 'INVALID' ? '' : '已拿起设施，点击空地重新放置。');
      sound('pickup'); return;
    }
    const terrain = level.terrain.find(t => key(t) === key(cell));
    if (!selectedPiece) { setNotice(terrain ? names[terrain.kind] : '先从右侧选择一个设施'); return; }
    const candidate = { ...cell, id: selectedPiece.id, rotation };
    const block = placementBlock(level, placements, candidate);
    if (block) { setNotice(block); sound('error'); return; }
    const next = [...placements, candidate];
    commit(next);
    const issue = evaluate(level, next).issues[candidate.id];
    sound(issue.status === 'INVALID' ? 'error' : 'place');
    setNotice(''); setSelected(null); setHover(null);
  }
  const ghost = selectedPiece && hover ? occupied(selectedPiece, { ...hover, id: selectedPiece.id, rotation }) : [];
  const ghostBlocked = selectedPiece && hover ? Boolean(placementBlock(level, placements, { ...hover, id: selectedPiece.id, rotation })) : false;

  return <div className={`app screen-${screen}`} onPointerDown={() => { void audio.start(); }}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="header">
      <div className="header-actions"><button className="icon-button sound-toggle" aria-label={save.settings.muted ? '开启声音' : '静音'} onClick={() => { setSave(s => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } })); }}>{save.settings.muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button><button className="icon-button" aria-label="设置" onClick={() => { sound(); setSettingsOpen(true); }}><Settings2 size={20}/></button></div>
    </header>

    {screen === 'menu' && <main className="menu-page">
      <div className="menu-art"><Landscape/></div>
      <div className="menu-copy"><div className="menu-buttons"><button className="primary" onClick={() => start(Math.min(save.current, unlocked))}>{save.progress[save.current]?.length ? '继续旅程' : '开始游戏'}<ArrowRight size={19}/></button><button className="secondary" onClick={() => { sound(); setScreen('levels'); }}><Map size={18}/> 选择关卡</button><button className="secondary" onClick={() => { sound(); setManualOpen(true); }}><BookOpen size={18}/> 说明书</button></div><div className="menu-progress"><span className="progress-dots">{Array.from({ length: levels.length }, (_, i) => <i key={i} className={save.completed.includes(i + 1) ? 'complete' : ''}/>)}</span><span>已完成 {save.completed.length} / {levels.length}</span></div></div>
    </main>}

    {screen === 'levels' && <main className="levels-page"><button className="back-link" onClick={() => { sound(); setScreen('menu'); }}><ArrowLeft size={16}/> 返回营地</button><div className="page-heading"><div><h1>选择关卡</h1></div><div className="completion-count"><Flag size={21}/><strong>{save.completed.length}</strong><span>/ {levels.length} 已完成</span></div></div><div className="level-grid">{levels.map(l => {
      const locked = l.id > unlocked, complete = save.completed.includes(l.id);
      return <button key={l.id} className={`level-card ${complete ? 'completed' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => start(l.id)}><div className="level-card-top"><span>{String(l.id).padStart(2, '0')}</span>{locked ? <LockKeyhole size={16}/> : complete ? <Check size={18}/> : <ArrowRight size={18}/>}</div>{l.id === 30 ? <div className="level-art-cluster"><Art kind="camp"/><Art kind="cabin"/><Art kind="picnic"/></div> : <Art kind={advancedArt[l.id - 16] || (l.id < 5 ? 'water' : l.id < 8 ? 'fire' : l.id < 10 ? 'tower' : 'camp')}/>}<h2>{levelLabel(l.id)}</h2><span className="level-chapter">{locked ? `完成第 ${l.id - 1} 关解锁` : `${l.size} × ${l.size}`}</span></button>;
    })}</div></main>}

    {screen === 'game' && <main className="game-page">
      <div className="game-heading"><div className="game-title"><button className="icon-button" aria-label="返回关卡选择" onClick={() => { sound(); setScreen('levels'); }}><ArrowLeft size={20}/></button><div><h1>{levelLabel(level.id)}</h1></div></div>{result.won && <div className="status-pill finished"><span/>规划完成</div>}</div>
      <div className="play-layout"><section ref={boardRef} className="board-section" aria-label="营地棋盘"><div className="board-topline"><span><Compass size={16}/> 营地规划图</span></div>
        <div className="board-with-clues" style={{ '--size': level.size } as React.CSSProperties}>
          <div className="clue-corner"><Leaf size={17}/></div><div className="column-clues">{level.cols.map((target, i) => <Dashes key={i} target={target} used={result.cols[i]} column/>)}</div>
          <div className="row-clues">{level.rows.map((target, i) => <Dashes key={i} target={target} used={result.rows[i]}/>)}</div>
          <div className="board" role="group" aria-label={`${level.size} 行 ${level.size} 列棋盘`} onPointerLeave={() => setHover(null)}>{Array.from({ length: level.size * level.size }, (_, index) => {
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
            const label = terrain ? names[terrain.kind] : piece ? `${names[piece.kind]}${issue?.reasons.length ? `：${issue.reasons.join('；')}` : '，点击拿起'}` : '空地';
            return <button key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind}` : ''} ${issue?.status === 'INVALID' ? 'invalid' : ''} ${issue?.status === 'INCOMPLETE' ? 'pending' : ''} ${isGhost ? `ghost ${ghostBlocked ? 'blocked' : ''}` : ''} ${hasNeighbor(-1, 0) ? 'join-top' : ''} ${hasNeighbor(1, 0) ? 'join-bottom' : ''} ${hasNeighbor(0, -1) ? 'join-left' : ''} ${hasNeighbor(0, 1) ? 'join-right' : ''}`} aria-label={`第 ${cell.r + 1} 行第 ${cell.c + 1} 列，${label}`} title={terrain ? undefined : label} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(cell); }} onFocus={() => setHover(cell)} onClick={() => clickCell(cell)} onContextMenu={event => { if (at && piece && piece.shape !== 'single') { event.preventDefault(); rotatePlaced(at, cell); } }}>
              {terrain ? <><Art kind={terrain.kind}/><span className={`terrain-label label-${terrain.kind}`} role="tooltip"><Art kind={terrain.kind}/>{names[terrain.kind]}</span></> : piece ? piece.shape === 'single' || piece.kind !== 'camp' && isAnchor ? <Art kind={piece.kind}/> : null : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
              {issue?.status === 'INVALID' && isAnchor && <span className="error-mark">!</span>}
              {issue?.status === 'INCOMPLETE' && isAnchor && <span className="pending-mark">·</span>}
              {isGhost && !terrain && !piece && <span className="ghost-dot"/>}
            </button>;
          })}<div className="camp-art-layer">{placements.map(at => {
            const piece = level.pieces.find(p => p.id === at.id)!;
            if (piece.kind !== 'camp' || piece.shape === 'single') return null;
            const cells = offsets(piece.shape, at.rotation);
            const width = Math.max(...cells.map(p => p.c)) + 1, height = Math.max(...cells.map(p => p.r)) + 1;
            return <div className="placed-camp-art" key={at.id} style={{ gridRow: `${at.r + 1} / span ${height}`, gridColumn: `${at.c + 1} / span ${width}` }}><CampArt shape={piece.shape} rotation={at.rotation}/></div>;
          })}</div></div>
        </div>
        <div className="board-legend"><span><i className="yellow-dash"/> 待占格数</span><span><span className="legend-dot"/> 固定地形不可移动</span><span><MousePointer2 size={13}/> 点击放置 / 拿起</span></div>
      </section>
      <aside ref={toolsRef} className="tools-panel"><section className="facility-panel"><div className="panel-heading"><h2>待放设施</h2><span>{level.pieces.length - placements.length} <small>/ {level.pieces.length}</small></span></div><div className="facility-list">{groups.map(group => {
        const total = level.pieces.filter(p => p.kind === group.kind && p.shape === group.shape);
        const remaining = total.filter(p => !placements.some(at => at.id === p.id)).length;
        const active = selectedPiece?.kind === group.kind && selectedPiece.shape === group.shape;
        return <div className="facility-wrapper" key={`${group.kind}-${group.shape}`} onPointerEnter={() => { setTipGroup(group.kind); setTipShape(group.shape); }} onFocus={() => { setTipGroup(group.kind); setTipShape(group.shape); }}>
          <button className={`facility-card ${active ? 'active' : ''} ${remaining === 0 ? 'empty' : ''}`} aria-label={`选择${shapeNames[group.shape]}${names[group.kind]}，剩余 ${remaining}`} aria-pressed={active} disabled={!remaining} onClick={() => choose(group.kind, group.shape)}>
            <div className="facility-art">{group.kind === 'camp' ? <CampArt shape={group.shape} rotation={rotations[group.shape] || 0}/> : <Art kind={group.kind}/>}</div>
            <div className="facility-info"><strong>{names[group.kind]}</strong></div>
            <span className="quantity">{remaining === 0 ? <Check size={14}/> : `×${remaining}`}</span>
          </button>
        </div>;
      })}</div>
      <div className="rule-dock" aria-live="polite">{save.settings.facilityTips && shownKind ? <><strong>{names[shownKind]}</strong><span><b>要求</b>{rules[shownKind][0]}</span><span><b>禁止</b>{rules[shownKind][1]}</span>{shownShape !== 'single' && <span><b>提示</b>点击旋转</span>}</> : <p>{save.settings.facilityTips ? '选择或悬停设施，查看要求与禁止事项。' : '设施提示已关闭'}</p>}</div>
      </section>
      <section className="operations"><h2>营地工具</h2><button className="wide-operation" disabled={!selectedPiece || selectedPiece.shape === 'single'} onClick={rotate}><RotateCcw size={17}/><span>旋转</span></button><div className="history-buttons"><button disabled={!history.past.length} onClick={undo}><Undo2 size={18}/><span>撤销</span></button><button disabled={!history.future.length} onClick={redo}><Redo2 size={18}/><span>重做</span></button></div><button className="wide-operation" onClick={restart}><RotateCcw size={17}/><span>重新游玩</span></button><button className="wide-operation" onClick={() => { sound(); setScreen('levels'); }}><Grid2X2 size={17}/><span>选择关卡</span><ChevronRight size={15}/></button></section>
      </aside></div>
      <div className={`guide-strip ${invalidCount ? 'warning' : ''}`} role="status" aria-live="polite"><span className="guide-icon">{invalidCount ? '!' : <Sparkles size={18}/>}</span><div><p>{notice === '已经被占用' ? notice : errors.join('；') || notice || level.tip}</p></div>{invalidCount > 0 && <span className="issue-count">{invalidCount} 处待调整</span>}</div>
      {!saved && <div className="save-error" role="status">浏览器存储不可用，进度暂未保存</div>}
    </main>}

    <dialog ref={dialogRef} className={`modal ${manualOpen ? 'manual-modal' : ''}`} onCancel={() => { setSettingsOpen(false); setWinOpen(false); setManualOpen(false); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { setSettingsOpen(false); setWinOpen(false); setManualOpen(false); } } }}>
      <button ref={closeRef} className="modal-close icon-button" aria-label="关闭" onClick={() => { setSettingsOpen(false); setWinOpen(false); setManualOpen(false); }}><X size={19}/></button>
      {manualOpen ? <Manual/> : settingsOpen ? <><h2>设置</h2><div className="volume-control"><label htmlFor="music-volume"><span>背景音乐</span><output>{Math.round(save.settings.music * 100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value={Math.round(save.settings.music * 100)} onChange={e => setSave(s => ({ ...s, settings: { ...s.settings, music: Number(e.target.value) / 100 } }))}/></div><div className="volume-control"><label htmlFor="effects-volume"><span>交互音效</span><output>{Math.round(save.settings.effects * 100)}%</output></label><input id="effects-volume" type="range" min="0" max="100" value={Math.round(save.settings.effects * 100)} onChange={e => setSave(s => ({ ...s, settings: { ...s.settings, effects: Number(e.target.value) / 100 } }))} onPointerUp={() => sound('place')}/></div><button className={`mute-setting ${save.settings.muted ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.muted} onClick={() => setSave(s => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }))}><span>{save.settings.muted ? <VolumeX size={18}/> : <Volume2 size={18}/>} 静音模式</span><i/></button><button className={`mute-setting ${save.settings.facilityTips ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.facilityTips} onClick={() => setSave(s => ({ ...s, settings: { ...s.settings, facilityTips: !s.settings.facilityTips } }))}><span><MousePointer2 size={18}/> 设施提示</span><i/></button></> : <div className="win-content"><div className="win-emblem"><Art kind="camp"/><span><Check size={18}/></span></div><h2>规划完成</h2><div className="win-level">{levelLabel(levelId)}</div><button className="primary" onClick={() => levelId < levels.length ? start(levelId + 1) : (setWinOpen(false), setScreen('levels'))}>{levelId < levels.length ? '下一关' : '回看旅程'}<ArrowRight size={18}/></button><button className="text-button" onClick={restart}><RotateCcw size={15}/> 重新游玩</button></div>}
    </dialog>
  </div>;
}
