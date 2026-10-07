import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Flag, Grid2X2, Leaf, LockKeyhole, Map, MousePointer2, RotateCcw, Save, ScrollText, Settings2, Sparkles, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import { Art, FacilityArt, FootprintSurface, Landscape } from './components/Art';
import { version } from '../package.json';
import data from './data/levels.json';
import answers from './data/solutions.json';
import { Blueprint } from './components/Blueprint';
import { Manual } from './components/Manual';
import { SandboxMenu } from './components/SandboxMenu';
import { evaluate, key, occupied, placementBlock, rotateAround } from './game/rules';
import { progressForPlay, readSave, writeSave } from './game/storage';
import { audio } from './game/audio';
import { createSandbox, decodeMap, encodeMap, facilityLibrary, withEditorPlacements } from './game/sandbox';
import type { SandboxCheck, SandboxDraft } from './game/sandbox';
import { readLocalMaps, saveLocalMap } from './game/localMaps';
import type { LocalMap } from './game/localMaps';
import { writeClipboard } from './game/clipboard';
import type { Cell, FacilityKind, GameMode, Level, Piece, Placement, Shape, TerrainKind } from './game/types';

const levels = data as Level[];
const solutions = answers as Record<string, Placement[]>;
const advancedArt: (FacilityKind | TerrainKind)[] = ['tower', 'water', 'forest', 'picnic', 'picnic', 'camp', 'tower', 'picnic', 'cabin', 'picnic', 'cabin', 'fire', 'tower', 'cabin', 'cabin'];
const levelLabel = (id: number) => `day ${id}`;
const names: Record<FacilityKind | TerrainKind, string> = { camp: '营地', fire: '篝火', tower: '瞭望塔', picnic: '野餐桌', cabin: '林间木屋', water: '水源', forest: '森林', mountain: '山地' };
const shapeNames: Record<Shape, string> = { single: '单格', domino: '双格', long: '三格', el: 'L 形' };
const terrainKinds = [...new Set(levels.flatMap(l => l.terrain.map(t => t.kind)))];
const rules: Record<FacilityKind, [string, string]> = { camp: ['至少一格挨着水源（上下左右）', '覆盖地形、重叠设施'], fire: ['上下左右挨着营地', '邻森林（含斜角）'], tower: ['上下左右挨着山地', '邻其他塔（含斜角）'], picnic: ['至少一格挨着营地（上下左右）', '邻篝火（含斜角）'], cabin: ['至少一格挨着森林（上下左右）', '任意一格上下左右挨着水'] };
type Snapshot = { level: Level; placements: Placement[] };
type History = { past: Snapshot[]; present: Snapshot; future: Snapshot[] };
type Screen = 'menu' | 'adventure' | 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps' | 'levels' | 'game';

function Dashes({ target, used, column = false }: { target: number; used: number; column?: boolean }) {
  const left = Math.max(0, target - used), over = used > target;
  return <div className={`clue ${column ? 'column-clue' : ''} ${over ? 'over' : ''}`} aria-label={`需占 ${target} 格，已占 ${used} 格${over ? '，超出提示' : ''}`} title={`需要 ${target} 格 · 已占 ${used} 格`}>
    {over ? <span className="overflow-count">+{used - target}</span> : left === 0 ? <Check size={13} strokeWidth={2.5} /> : Array.from({ length: left }, (_, i) => <i key={i} />)}
  </div>;
}

export default function App() {
  const [save, setSave] = useState(() => readSave(levels));
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('adventure');
  const [localMaps, setLocalMaps] = useState(readLocalMaps);
  const [localMapId, setLocalMapId] = useState<number>();
  const [sandboxDraft, setSandboxDraft] = useState<SandboxDraft | null>(null);
  const [levelId, setLevelId] = useState(save.current);
  const [history, setHistory] = useState<History>({ past: [], present: { level: levels[save.current - 1], placements: progressForPlay(save, levels[save.current - 1]) }, future: [] });
  const [selected, setSelected] = useState<Piece | null>(null);
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
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mapCode, setMapCode] = useState('');
  const [check, setCheck] = useState<SandboxCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [terrainBrush, setTerrainBrush] = useState<TerrainKind | null>(null);
  const nextPieceId = useRef(0);
  const checkerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);
  const [saved, setSaved] = useState(true);
  const wonRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const level = history.present.level;
  const sandboxName = localMaps.find(map => map.id === localMapId)?.name || '自定义地图';
  const blueprintUnlocked = mode === 'adventure' ? save.completed.includes(levelId) : mode === 'sandbox-play' && localMapId !== undefined;
  const placements = history.present.placements;
  const result = useMemo(() => evaluate(level, placements), [level, placements]);
  const selectedPiece = selected;
  const rotation = selectedPiece ? rotations[selectedPiece.shape] || 0 : 0;
  const unlocked = Math.min(levels.length, Math.max(1, ...save.completed.map(id => id + 1)));
  const groups = mode === 'sandbox-editor' ? facilityLibrary : level.pieces.filter((p, i, all) => all.findIndex(other => other.kind === p.kind && other.shape === p.shape) === i);
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
  const showFacilityTips = save.settings.facilityTips;

  useLayoutEffect(() => { setSaved(writeSave(save)); }, [save]);
  useEffect(() => { audio.setSettings(save.settings); }, [save.settings]);
  useEffect(() => { audio.setScene(screen === 'game' ? 'game' : 'menu'); }, [screen]);
  useLayoutEffect(() => {
    if (screen === 'game' && mode === 'adventure') setSave(s => ({ ...s, current: levelId, progress: { ...s.progress, [levelId]: placements } }));
  }, [levelId, placements, screen, mode]);
  useEffect(() => {
    if (screen === 'game' && mode !== 'sandbox-editor' && result.won && !wonRef.current) {
      wonRef.current = true; setSelected(null); audio.play('win');
      if (mode === 'sandbox-play') setWinOpen(true);
      else if (!save.completed.includes(levelId)) {
        setWinOpen(true);
        setSave(s => ({ ...s, completed: [...new Set([...s.completed, levelId])] }));
      }
    } else if (!result.won) wonRef.current = false;
  }, [result.won, levelId, screen, save.completed, mode]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (settingsOpen || winOpen || manualOpen || blueprintOpen || leaveOpen || mapCode) { if (!dialog?.open) dialog?.showModal(); closeRef.current?.focus(); }
    else dialog?.close();
  }, [settingsOpen, winOpen, manualOpen, blueprintOpen, leaveOpen, mapCode]);

  const sound = (name: Parameters<typeof audio.play>[0] = 'click') => { void audio.start().then(() => audio.play(name)); };
  const invalidateCheck = useCallback(() => {
    revisionRef.current++; checkerRef.current?.terminate(); checkerRef.current = null;
    setChecking(false); setCheck(null);
  }, []);
  useEffect(() => () => checkerRef.current?.terminate(), []);
  const commit = useCallback((next: Placement[], nextLevel = level) => {
    if (mode !== 'adventure') invalidateCheck();
    if (mode === 'sandbox-editor') setEditorDirty(true);
    const present = mode === 'sandbox-editor' ? withEditorPlacements({ level: nextLevel, placements }, next) : { level: nextLevel, placements: next };
    setHistory(h => ({ past: [...h.past.slice(-79), h.present], present, future: [] }));
  }, [level, mode, placements, invalidateCheck]);
  const rotate = useCallback(() => {
    if (!selectedPiece || selectedPiece.shape === 'single') return;
    setRotations(s => ({ ...s, [selectedPiece.shape]: ((s[selectedPiece.shape] || 0) + 1) % 4 })); audio.play('rotate');
  }, [selectedPiece]);
  const undo = useCallback(() => {
    if (mode !== 'adventure' && history.past.length) invalidateCheck();
    if (mode === 'sandbox-editor' && history.past.length) setEditorDirty(true);
    setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
    setSelected(null); setNotice(''); audio.play('click');
  }, [mode, history.past.length, invalidateCheck]);
  const redo = useCallback(() => {
    if (mode !== 'adventure' && history.future.length) invalidateCheck();
    if (mode === 'sandbox-editor' && history.future.length) setEditorDirty(true);
    setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
    setSelected(null); setNotice(''); audio.play('click');
  }, [mode, history.future.length, invalidateCheck]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (screen !== 'game' || settingsOpen || winOpen || manualOpen || blueprintOpen || leaveOpen || mapCode || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
      if (event.key === 'Escape') { setSelected(null); setNotice(''); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [screen, settingsOpen, winOpen, manualOpen, blueprintOpen, leaveOpen, mapCode, undo, redo]);

  function start(id: number, reset = false) {
    sound(); setSelected(null); setRotations({}); setHover(null); setNotice(''); setWinOpen(false);
    wonRef.current = false;
    setMode('adventure'); setTerrainBrush(null); setTipGroup(null);
    setLevelId(id); setHistory({ past: [], present: { level: levels[id - 1], placements: reset ? [] : progressForPlay(save, levels[id - 1]) }, future: [] }); setScreen('game');
  }
  function restart() { sound(); commit([]); setSelected(null); setRotations({}); setNotice(''); setWinOpen(false); }
  function choose(kind: FacilityKind, shape: Shape) {
    setTerrainBrush(null);
    if (selectedPiece?.kind === kind && selectedPiece.shape === shape) { if (shape !== 'single') rotate(); else setSelected(null); return; }
    const piece = mode === 'sandbox-editor' ? { id: `custom-${++nextPieceId.current}`, kind, shape } : level.pieces.find(p => p.kind === kind && p.shape === shape && !placements.some(at => at.id === p.id));
    if (piece) { setSelected(piece); setNotice(''); sound('select'); }
  }
  function rotatePlaced(at: Placement, pivot: Cell) {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const next = rotateAround(piece, at, pivot);
    const block = placementBlock(level, placements, next);
    if (block) { setNotice(block.includes('地形') || block.includes('重叠') ? '已经被占用' : block); sound('error'); return; }
    commit(placements.map(p => p.id === at.id ? next : p)); setNotice(''); sound('rotate');
  }
  function clickCell(cell: Cell) {
    if (mode === 'sandbox-editor' && terrainBrush) {
      if (placements.some(at => occupied(level.pieces.find(p => p.id === at.id)!, at).some(p => key(p) === key(cell)))) { setNotice('先拿起这里的设施，再修改地形'); sound('error'); return; }
      const current = level.terrain.find(t => key(t) === key(cell));
      const terrain = level.terrain.filter(t => key(t) !== key(cell));
      if (current?.kind !== terrainBrush) terrain.push({ ...cell, kind: terrainBrush });
      commit(placements, { ...level, terrain }); setNotice(''); sound('place'); return;
    }
    const placed = placements.find(at => occupied(level.pieces.find(p => p.id === at.id)!, at).some(p => key(p) === key(cell)));
    if (placed) {
      const issue = result.issues[placed.id];
      const piece = level.pieces.find(p => p.id === placed.id)!;
      commit(placements.filter(at => at.id !== placed.id)); setSelected(piece); setRotations(s => ({ ...s, [piece.shape]: placed.rotation }));
      setNotice(mode === 'sandbox-editor' ? '已拿起设施，点击空地移动；切换地形画笔可收回。' : issue.status === 'INVALID' ? '' : '已拿起设施，点击空地重新放置。');
      sound('pickup'); return;
    }
    const terrain = level.terrain.find(t => key(t) === key(cell));
    if (mode === 'sandbox-editor' && terrain && !selectedPiece) {
      commit(placements, { ...level, terrain: level.terrain.filter(t => key(t) !== key(cell)) });
      setNotice(''); sound('pickup'); return;
    }
    if (!selectedPiece) { setNotice(terrain ? names[terrain.kind] : '先从右侧选择一个设施'); return; }
    const candidate = { ...cell, id: selectedPiece.id, rotation };
    const placementLevel = mode === 'sandbox-editor' ? { ...level, pieces: [...level.pieces, selectedPiece] } : level;
    const block = placementBlock(placementLevel, placements, candidate);
    if (block) { setNotice(block); sound('error'); return; }
    const next = [...placements, candidate];
    commit(next, placementLevel);
    const issue = evaluate(mode === 'sandbox-editor' ? withEditorPlacements({ level: placementLevel, placements }, next).level : level, next).issues[candidate.id];
    sound(issue.status === 'INVALID' ? 'error' : 'place');
    setNotice(''); setSelected(mode === 'sandbox-editor' ? { ...selectedPiece, id: `custom-${++nextPieceId.current}` } : null); setHover(null);
  }
  const ghost = selectedPiece && hover ? occupied(selectedPiece, { ...hover, id: selectedPiece.id, rotation }) : [];
  const ghostBlocked = selectedPiece && hover ? Boolean(placementBlock(mode === 'sandbox-editor' ? { ...level, pieces: [...level.pieces, selectedPiece] } : level, placements, { ...hover, id: selectedPiece.id, rotation })) : false;

  function openSandbox(size: 6 | 8) {
    sound(); invalidateCheck(); setLocalMapId(undefined); setSandboxDraft(null);
    setMode('sandbox-editor'); setHistory({ past: [], present: createSandbox(size), future: [] });
    setSelected(null); setRotations({}); setTerrainBrush(null); setHover(null); setTipGroup(null); setNotice('');
    setCheck(null); setChecking(false); setEditorDirty(false); setScreen('game'); wonRef.current = false;
  }
  function importSandbox(code: string) {
    const draft = decodeMap(code);
    openSandboxPlay(draft);
  }
  function openLocalMap(map: LocalMap) {
    openSandboxPlay(map.draft, map.progress, map.id);
  }
  function openSandboxPlay(draft: SandboxDraft, progress: Placement[] = [], id?: number) {
    sound(); invalidateCheck(); setSandboxDraft(draft); setLocalMapId(id);
    setMode('sandbox-play'); setHistory({ past: [], present: { level: draft.level, placements: progress }, future: [] });
    setSelected(null); setRotations({}); setTerrainBrush(null); setHover(null); setTipGroup(null); setNotice('');
    setWinOpen(false); wonRef.current = false; setScreen('game');
  }
  function leaveGame() {
    sound();
    if (mode === 'sandbox-editor' && editorDirty) { setLeaveOpen(true); return; }
    returnToMenu();
  }
  function returnToMenu() {
    checkerRef.current?.terminate(); checkerRef.current = null; revisionRef.current++;
    setChecking(false); setLeaveOpen(false); setWinOpen(false); setSelected(null); setTerrainBrush(null); setNotice('');
    setScreen(mode === 'adventure' ? 'levels' : localMapId && mode === 'sandbox-play' ? 'local-maps' : 'sandbox');
  }
  function runSandboxAction(action: 'save' | 'export') {
    if (checking || checkerRef.current) return;
    const draft = mode === 'sandbox-editor' ? history.present : sandboxDraft;
    if (!draft) return;
    sound();
    const revision = revisionRef.current;
    setChecking(true); setCheck(null); setNotice('正在进行营地质检…');
    try {
      const worker = new Worker(new URL('./game/sandbox.worker.ts', import.meta.url), { type: 'module' });
      checkerRef.current = worker;
      worker.onmessage = (event: MessageEvent<SandboxCheck>) => {
        worker.terminate();
        if (revision !== revisionRef.current || checkerRef.current !== worker) return;
        checkerRef.current = null; setCheck(event.data); setNotice(event.data.message);
        if (event.data.status !== 'unique') { setChecking(false); sound('error'); return; }
        if (action === 'export') { void exportSandbox(draft, revision); return; }
        setChecking(false);
        try {
          const map = saveLocalMap(draft, mode === 'sandbox-editor' ? [] : placements, localMapId);
          setLocalMaps(readLocalMaps()); setLocalMapId(map.id); setEditorDirty(false);
          setNotice(`已保存到${map.name}`); sound('place');
        } catch (error) { setNotice(error instanceof Error ? error.message : '本地地图保存失败，请重试'); sound('error'); }
      };
      worker.onerror = () => {
        worker.terminate();
        if (revision !== revisionRef.current || checkerRef.current !== worker) return;
        checkerRef.current = null; setChecking(false); setCheck(null); setNotice('营地质检未能完成，请重试');
      };
      worker.postMessage(draft);
    } catch { checkerRef.current?.terminate(); checkerRef.current = null; setChecking(false); setNotice('营地质检未能启动，请重试'); }
  }
  async function exportSandbox(draft: SandboxDraft, revision: number) {
    try {
      const code = encodeMap(draft);
      await writeClipboard(code);
      if (revision !== revisionRef.current) return;
      sound('place'); setMapCode(code); setNotice('地图代码已复制到剪贴板');
    } catch (error) {
      if (revision !== revisionRef.current) return;
      setNotice(error instanceof Error ? error.message : '暂时无法复制地图代码，请重试'); sound('error');
    } finally { if (revision === revisionRef.current) setChecking(false); }
  }
  function closeDialog() {
    setSettingsOpen(false); setWinOpen(false); setManualOpen(false); setBlueprintOpen(false); setLeaveOpen(false); setMapCode('');
  }

  return <div className={`app screen-${screen}`} onPointerDown={() => { void audio.start(); }}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="header">
      <div className="header-actions"><button className="icon-button sound-toggle" aria-label={save.settings.muted ? '开启声音' : '静音'} onClick={() => { setSave(s => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } })); }}>{save.settings.muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button><button className="icon-button" aria-label="设置" onClick={() => { sound(); setSettingsOpen(true); }}><Settings2 size={20}/></button></div>
    </header>

    {screen === 'menu' && <main className="menu-page">
      <div className="menu-art"><Landscape/></div>
      <div className="menu-copy"><div className="menu-buttons"><button className="primary" onClick={() => { sound(); setScreen('adventure'); }}>开始冒险<ArrowRight size={19}/></button><button className="secondary" onClick={() => { sound(); setScreen('levels'); }}><Map size={18}/> 营地日记</button><button className="secondary" onClick={() => { sound(); setManualOpen(true); }}><BookOpen size={18}/> 野外手册</button></div><div className="menu-progress"><span className="progress-dots">{Array.from({ length: levels.length }, (_, i) => <i key={i} className={save.completed.includes(i + 1) ? 'complete' : ''}/>)}</span><span>已完成 {save.completed.length} / {levels.length}</span></div></div>
    </main>}

    {(screen === 'adventure' || screen === 'sandbox' || screen === 'sandbox-size' || screen === 'sandbox-import' || screen === 'local-maps') && <SandboxMenu screen={screen} localMaps={localMaps} onOpenLocalMap={openLocalMap} onBack={() => { sound(); setScreen(screen === 'adventure' ? 'menu' : screen === 'sandbox' || screen === 'local-maps' ? 'adventure' : 'sandbox'); }} onContinue={() => start(Math.min(save.current, unlocked))} onNavigate={setScreen} onCreate={openSandbox} onImport={importSandbox} onSound={() => sound()}/>}

    {screen === 'levels' && <main className="levels-page"><button className="back-link" onClick={() => { sound(); setScreen('menu'); }}><ArrowLeft size={16}/> 返回营地</button><div className="page-heading"><div><h1>营地日记</h1></div><div className="completion-count"><Flag size={21}/><strong>{save.completed.length}</strong><span>/ {levels.length} 已完成</span></div></div><div className="level-grid">{levels.map(l => {
      const locked = l.id > unlocked, complete = save.completed.includes(l.id);
      return <button key={l.id} className={`level-card ${complete ? 'completed' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => start(l.id)}><div className="level-card-top"><span>{String(l.id).padStart(2, '0')}</span>{locked ? <LockKeyhole size={16}/> : complete ? <Check size={18}/> : <ArrowRight size={18}/>}</div>{l.id === 30 ? <div className="level-art-cluster"><Art kind="camp"/><Art kind="cabin"/><Art kind="picnic"/></div> : <Art kind={advancedArt[l.id - 16] || (l.id < 5 ? 'water' : l.id < 8 ? 'fire' : l.id < 10 ? 'tower' : 'camp')}/>}<h2>{levelLabel(l.id)}</h2><span className="level-chapter">{locked ? `完成 ${levelLabel(l.id - 1)} 解锁` : `${l.size} × ${l.size}`}</span></button>;
    })}</div></main>}

    {screen === 'game' && <main className="game-page">
      <div className="game-heading"><div className="game-title"><button className="icon-button" aria-label={mode === 'adventure' ? '返回营地日记' : localMapId && mode === 'sandbox-play' ? '返回本地地图' : '返回沙盒模式'} onClick={leaveGame}><ArrowLeft size={20}/></button><div><h1>{mode === 'sandbox-editor' ? '创造地图' : mode === 'sandbox-play' ? sandboxName : levelLabel(level.id)}</h1></div></div>{mode === 'sandbox-editor' ? <div className="status-pill"><Leaf size={14}/>{level.size} × {level.size}</div> : result.won && <div className="status-pill finished"><span/>规划完成</div>}</div>
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
            return <button key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind} ${piece.shape !== 'single' ? 'placed-multi' : ''}` : ''} ${issue?.status === 'INVALID' ? 'invalid' : ''} ${issue?.status === 'INCOMPLETE' ? 'pending' : ''} ${isGhost ? `ghost ${ghostBlocked ? 'blocked' : ''}` : ''} ${hasNeighbor(-1, 0) ? 'join-top' : ''} ${hasNeighbor(1, 0) ? 'join-bottom' : ''} ${hasNeighbor(0, -1) ? 'join-left' : ''} ${hasNeighbor(0, 1) ? 'join-right' : ''}`} aria-label={`第 ${cell.r + 1} 行第 ${cell.c + 1} 列，${label}`} title={terrain ? undefined : label} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(cell); }} onFocus={() => setHover(cell)} onClick={() => clickCell(cell)} onContextMenu={event => { if (at && piece && piece.shape !== 'single') { event.preventDefault(); rotatePlaced(at, cell); } }}>
              {terrain ? <><Art kind={terrain.kind}/><span className={`terrain-label label-${terrain.kind}`} role="tooltip"><Art kind={terrain.kind}/>{names[terrain.kind]}</span></> : piece ? piece.shape === 'single' ? <Art kind={piece.kind}/> : null : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
              {issue?.status === 'INVALID' && isAnchor && <span className="error-mark">!</span>}
              {issue?.status === 'INCOMPLETE' && isAnchor && <span className="pending-mark">·</span>}
              {isGhost && !terrain && !piece && <span className="ghost-dot"/>}
            </button>;
          })}<div className="facility-art-layer">{placements.map(at => {
            const piece = level.pieces.find(p => p.id === at.id)!;
            if (piece.shape === 'single') return null;
            const cells = occupied(piece, at);
            const row = Math.min(...cells.map(p => p.r)), column = Math.min(...cells.map(p => p.c));
            const width = Math.max(...cells.map(p => p.c)) - column + 1, height = Math.max(...cells.map(p => p.r)) - row + 1;
            const issue = result.issues[at.id];
            return <div className={`placed-facility-art ${issue.status.toLowerCase()} ${hover && cells.some(p => key(p) === key(hover)) ? 'hovered' : ''}`} key={at.id} data-kind={piece.kind} data-rotation={at.rotation} style={{ gridRow: `${row + 1} / span ${height}`, gridColumn: `${column + 1} / span ${width}` }}><FootprintSurface shape={piece.shape} rotation={at.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at.rotation}/></div>;
          })}</div></div>
        </div>
        <div className="board-legend"><span><i className="yellow-dash"/> {mode === 'sandbox-editor' ? '自动生成行列目标' : '待占格数'}</span><span><span className="legend-dot"/> {mode === 'sandbox-editor' ? '地形画笔可修改' : '固定地形不可移动'}</span><span><MousePointer2 size={13}/> 点击放置 / 拿起</span></div>
      </section>
      <aside ref={toolsRef} className={`tools-panel ${mode === 'sandbox-editor' ? 'sandbox-editor-tools' : ''}`}><section className={`facility-panel ${showFacilityTips ? '' : 'tips-hidden'}`}><div className="panel-heading"><h2>{mode === 'sandbox-editor' ? '设施库' : '待放设施'}</h2>{mode !== 'sandbox-editor' && <span>{level.pieces.length - placements.length} <small>/ {level.pieces.length}</small></span>}</div>
      {mode === 'sandbox-editor' && <div className="terrain-tools" aria-label="地形画笔">{terrainKinds.map(kind => <button key={kind} className={terrainBrush === kind ? 'active' : ''} aria-pressed={terrainBrush === kind} onClick={() => { setTerrainBrush(terrainBrush === kind ? null : kind); setSelected(null); setHover(null); setNotice(`点击空地放置${names[kind]}，再次点击移除`); sound('select'); }}><Art kind={kind}/><span>{names[kind]}</span></button>)}</div>}
      <div className="facility-list">{groups.map(group => {
        const total = level.pieces.filter(p => p.kind === group.kind && p.shape === group.shape);
        const remaining = mode === 'sandbox-editor' ? Infinity : total.filter(p => !placements.some(at => at.id === p.id)).length;
        const active = selectedPiece?.kind === group.kind && selectedPiece.shape === group.shape;
        return <div className="facility-wrapper" key={`${group.kind}-${group.shape}`} onPointerEnter={() => { setTipGroup(group.kind); setTipShape(group.shape); }} onFocus={() => { setTipGroup(group.kind); setTipShape(group.shape); }}>
          <button className={`facility-card ${active ? 'active' : ''} ${remaining === 0 ? 'empty' : ''}`} aria-label={`选择${shapeNames[group.shape]}${names[group.kind]}${mode === 'sandbox-editor' ? '，不限数量' : `，剩余 ${remaining}`}`} aria-pressed={active} disabled={!remaining} onClick={() => choose(group.kind, group.shape)}>
            <div className="facility-art"><FacilityArt kind={group.kind} shape={group.shape} rotation={rotations[group.shape] || 0}/></div>
            <div className="facility-info"><strong>{names[group.kind]}</strong></div>
            {mode !== 'sandbox-editor' && <span className="quantity">{remaining === 0 ? <Check size={14}/> : `×${remaining}`}</span>}
          </button>
        </div>;
      })}</div>
      {showFacilityTips && <div className="rule-dock" aria-live="polite">{shownKind ? <><strong>{names[shownKind]}</strong><span><b>要求</b>{rules[shownKind][0]}</span><span><b>禁止</b>{rules[shownKind][1]}</span>{shownShape !== 'single' && <span><b>提示</b>点击旋转</span>}</> : <p>选择或悬停设施，查看要求与禁止事项。</p>}</div>}
      </section>
      <section className="operations"><h2>营地工具</h2><button className="wide-operation" disabled={!selectedPiece || selectedPiece.shape === 'single'} onClick={rotate}><RotateCcw size={17}/><span>旋转</span></button>{mode === 'sandbox-editor' ? <><button className="wide-operation" disabled={!history.past.length} onClick={undo}><Undo2 size={18}/><span>撤销</span></button><button className="wide-operation sandbox-save" disabled={checking} onClick={() => runSandboxAction('save')}><Save size={18}/><span>{checking ? '正在质检…' : '保存'}</span></button><button className="wide-operation sandbox-export" disabled={checking} onClick={() => runSandboxAction('export')}><ScrollText size={17}/><span>导出地图</span></button></> : <><div className="history-buttons"><button disabled={!history.past.length} onClick={undo}><Undo2 size={18}/><span>撤销</span></button>{(mode === 'adventure' || blueprintUnlocked) && <button className="blueprint-button" disabled={!blueprintUnlocked} title={blueprintUnlocked ? '查看图纸' : '通关后解锁'} onClick={() => { sound(); setBlueprintOpen(true); }}><ScrollText size={18}/><span>图纸</span></button>}</div><button className="wide-operation" onClick={restart}><RotateCcw size={17}/><span>重新游玩</span></button>{mode === 'sandbox-play' ? <button className="wide-operation sandbox-save" disabled={checking} onClick={() => runSandboxAction('save')}><Save size={17}/><span>{checking ? '正在质检…' : '保存'}</span></button> : <button className="wide-operation" onClick={returnToMenu}><Grid2X2 size={17}/><span>营地日记</span><ChevronRight size={15}/></button>}</>}</section>
      </aside></div>
      <div className={`guide-strip ${invalidCount || (mode !== 'adventure' && check && check.status !== 'unique') ? 'warning' : ''}`} role="status" aria-live="polite"><span className="guide-icon">{invalidCount ? '!' : <Sparkles size={18}/>}</span><div><p>{notice === '已经被占用' || mode !== 'adventure' ? notice || check?.message || errors.join('；') || level.tip : errors.join('；') || notice || level.tip}</p></div>{invalidCount > 0 && <span className="issue-count">{invalidCount} 处待调整</span>}</div>
      {!saved && <div className="save-error" role="status">浏览器存储不可用，进度暂未保存</div>}
    </main>}

    <dialog ref={dialogRef} className={`modal ${blueprintOpen ? 'blueprint-modal' : manualOpen ? 'manual-modal' : ''}`} onCancel={closeDialog} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } }}>
      <button ref={closeRef} className="modal-close icon-button" aria-label="关闭" onClick={closeDialog}><X size={19}/></button>
      {leaveOpen ? <><h2>返回沙盒模式？</h2><p className="sandbox-check-result">尚未保存的地图将丢失，确定返回吗？</p><div className="sandbox-modal-actions"><button className="secondary" onClick={() => setLeaveOpen(false)}>继续创造</button><button className="primary" onClick={returnToMenu}>确定返回<ArrowRight size={16}/></button></div></> : mapCode ? <div className="map-code"><h2>把营地分享出去</h2><p role="status">{notice || '地图代码已复制到剪贴板'}</p><textarea aria-label="导出的地图代码" readOnly value={mapCode} spellCheck={false}/><div className="sandbox-modal-actions"><button className="primary" onClick={() => { void writeClipboard(mapCode).then(() => setNotice('地图代码已复制到剪贴板')).catch(() => setNotice('暂时无法复制，请重试')); }}><ScrollText size={16}/>再次复制</button><button className="secondary" onClick={() => setMapCode('')}>继续创造</button></div></div> : blueprintOpen ? <Blueprint level={level} placements={mode === 'sandbox-play' ? sandboxDraft!.placements : solutions[levelId]} name={mode === 'sandbox-play' ? sandboxName : undefined}/> : manualOpen ? <Manual/> : settingsOpen ? <><h2>设置</h2><div className="volume-control"><label htmlFor="music-volume"><span>背景音乐</span><output>{Math.round(save.settings.music * 100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value={Math.round(save.settings.music * 100)} onChange={e => setSave(s => ({ ...s, settings: { ...s.settings, music: Number(e.target.value) / 100 } }))}/></div><div className="volume-control"><label htmlFor="effects-volume"><span>交互音效</span><output>{Math.round(save.settings.effects * 100)}%</output></label><input id="effects-volume" type="range" min="0" max="100" value={Math.round(save.settings.effects * 100)} onChange={e => setSave(s => ({ ...s, settings: { ...s.settings, effects: Number(e.target.value) / 100 } }))} onPointerUp={() => sound('place')}/></div><button className={`mute-setting ${save.settings.muted ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.muted} onClick={() => setSave(s => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }))}><span>{save.settings.muted ? <VolumeX size={18}/> : <Volume2 size={18}/>} 静音模式</span><i/></button><button className={`mute-setting ${save.settings.facilityTips ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.facilityTips} onClick={() => setSave(s => ({ ...s, settings: { ...s.settings, facilityTips: !s.settings.facilityTips } }))}><span><MousePointer2 size={18}/> 设施提示</span><i/></button><p className="settings-note">v{version}</p></> : <div className="win-content"><div className="win-emblem"><Art kind="camp"/><span><Check size={18}/></span></div><h2>规划完成</h2><div className="win-level">{mode === 'sandbox-play' ? sandboxName : levelLabel(levelId)}</div><button className="primary" onClick={() => mode === 'sandbox-play' ? returnToMenu() : levelId < levels.length ? start(levelId + 1) : (setWinOpen(false), setScreen('levels'))}>{mode === 'sandbox-play' ? localMapId ? '返回本地地图' : '返回沙盒模式' : levelId < levels.length ? '下一关' : '回看旅程'}<ArrowRight size={18}/></button><button className="text-button" onClick={restart}><RotateCcw size={15}/> 重新游玩</button></div>}
    </dialog>
  </div>;
}
