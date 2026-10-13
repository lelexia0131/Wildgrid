import { createTranslator, LanguageContext, useI18n } from './i18n/context';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Flag, Grid2X2, Leaf, LockKeyhole, Map, Megaphone, MousePointer2, RotateCcw, Save, ScrollText, Settings2, Tags, Volume2, VolumeX, X } from 'lucide-react';
import { CampToolIcon } from './components/CampToolIcon';
import { Art, FacilityArt, FootprintSurface } from './components/Art';
import { GameTitle } from './components/GameTitle';
import { HeroArt } from './components/HeroArt';
import { version } from '../package.json';
import { Blueprint } from './components/Blueprint';
import { Manual } from './components/Manual';
import { SandboxMenu } from './components/SandboxMenu';
import { SurvivalMenu } from './components/SurvivalMenu';
import { SurvivalBadge } from './components/SurvivalBadge';
import { survivalRanks } from './game/survival';
import type { SurvivalChallenge, SurvivalProgress, SurvivalRecord } from './game/survival';
import { key, occupied } from './game/rules';
import { levelUnlocked } from './game/storage';
import { levels, getLevelById, getSolution } from './game/levels';
import { facilityLibrary, facilityNames, facilityTips, shapeNames, terrainNames } from './game/facilityRegistry';
import { audio } from './game/audio';
import { decodeMap, withEditorPlacements } from './game/sandbox';
import type { SandboxDraft } from './game/sandbox';
import { resolvePlayerId } from './game/playerId';
import type { FacilityKind, Placement, Shape, TerrainKind } from './game/types';
import { useAdventureProgress } from './hooks/useAdventureProgress';
import { useGameHistory } from './hooks/useGameHistory';
import { useGameNavigation } from './hooks/useGameNavigation';
import { useHomeEntrance } from './hooks/useHomeEntrance';
import { useGamePlacement } from './hooks/useGamePlacement';
import { useBoardFeedback } from './hooks/useBoardFeedback';
import { useSandboxEditor } from './hooks/useSandboxEditor';
import { useSurvivalChallenge } from './hooks/useSurvivalChallenge';
import { useTutorial } from './hooks/useTutorial';
import type { TutorialEvent } from './game/tutorial';
import { TutorialOverlay } from './components/TutorialOverlay';
import { TutorialSettings } from './components/TutorialSettings';

const advancedArt: (FacilityKind | TerrainKind)[] = ['tower', 'water', 'forest', 'picnic', 'picnic', 'camp', 'tower', 'picnic', 'cabin', 'picnic', 'cabin', 'fire', 'tower', 'cabin', 'cabin', 'foodTruck', 'foodTruck', 'foodTruck', 'powerTower', 'powerTower', 'powerTower', 'foodTruck', 'pool', 'pool', 'pool', 'foodTruck', 'foodTruck', 'pool', 'powerTower', 'camp'];
const levelLabel = (id: number) => `day ${id}`;
const names = { ...facilityNames, ...terrainNames };
const terrainKinds = [...new Set(levels.flatMap(l => l.terrain.map(t => t.kind)))];

function Dashes({ target, used, column = false }: { target: number; used: number; column?: boolean }) {
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

export default function App() {
  const adventure = useAdventureProgress();
  const { save, saved, updateSettings } = adventure;
  const navigation = useGameNavigation(save.current);
  const { screen, setScreen, mode, levelId } = navigation;
  const homeEntering = useHomeEntrance(screen === 'menu');
  const [notice, setNotice] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [tipGroup, setTipGroup] = useState<FacilityKind | null>(null);
  const [tipShape, setTipShape] = useState<Shape>('single');
  const boardRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerIdLoading, setPlayerIdLoading] = useState(true);
  const playerIdStarted = useRef(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [celebration, setCelebration] = useState<'board' | 'dialog' | null>(null);
  const celebrationContext = useRef<{ level: typeof level; placements: Placement[]; mode: typeof mode } | null>(null);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [replay, setReplay] = useState<SurvivalRecord | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const wonRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tutorialHandler = useRef<(event: TutorialEvent) => void>(() => {});
  const onTutorialAction = useCallback((event: TutorialEvent) => tutorialHandler.current(event), []);
  const onHistoryChange = useCallback(() => {
    if (mode !== 'adventure') sandbox.invalidateCheck();
    if (mode === 'sandbox-editor') sandbox.markEditorDirty();
  }, [mode]);
  const onHistoryRestore = useCallback(() => {
    feedback.restoring.current = true;
    gamePlacement.setSelected(null); setNotice(''); audio.play('pickup');
  }, []);
  const historyController = useGameHistory(() => adventure.getStartSnapshot(save.current), onHistoryChange, onHistoryRestore, type => onTutorialAction({ type }));
  const { history, undo, redo } = historyController;
  const { level, placements } = history.present;
  const feedback = useBoardFeedback(boardRef, level, placements, screen === 'game');
  const sandbox = useSandboxEditor({ mode, present: history.present, placements, enterGame: enterSandbox, resetPieceIds: draft => gamePlacement.resetPieceIds(draft), setNotice, sound });
  const { localMaps, localMapId, sandboxDraft, mapCode, check, checking, editorDirty, terrainBrush, setTerrainBrush, openSandbox, importSandbox, openLocalMap, editLocalMap, runSandboxAction } = sandbox;
  const gamePlacement = useGamePlacement({ mode, level, placements, continuousPlacement: save.settings.continuousPlacement, terrainBrush, clearTerrainBrush: () => setTerrainBrush(null), commit, setNotice, sound, onAction: onTutorialAction, onReject: feedback.reject });
  const { selected, setSelected, rotations, setRotations, hover, setHover, result, choose, rotatePlaced, clickCell, ghost, ghostBlocked } = gamePlacement;
  const survivalController = useSurvivalChallenge({
    active: screen === 'game' && mode === 'survival', history, rotations, selected,
    enterGame: enterSurvival, openMenu: () => setScreen('survival'), returnToMenu,
    onSettled: () => { wonRef.current = true; beginCelebration(); },
    invalidateCheck: sandbox.invalidateCheck, resetSandboxContext: sandbox.resetSandboxContext, refreshLocalMaps: sandbox.refreshLocalMaps, setNotice, sound,
  });
  const { survival, challenge, survivalReward, survivalError, generating, replaceChallenge, abandonOpen, openSurvivalMenu, continueSurvival, cancelGeneration, requestSurvival, abandonSurvival, collectSurvival, settleSurvival } = survivalController;
  const sandboxName = replay ? `${replay.difficulty}难 · 复盘` : localMaps.find(map => map.id === localMapId)?.name || '自定义地图';
  const blueprintUnlocked = mode === 'adventure' ? save.completed.includes(levelId) : mode === 'sandbox-play' && (!!replay || localMapId !== undefined && localMaps.some(map => map.id === localMapId && (!map.survival || map.survival.blueprintUnlocked)));
  const selectedPiece = selected;
  const continueId = levelUnlocked(save.current, save.completed) ? save.current : 1;
  const nextDay = !!getLevelById(levelId + 1) && levelUnlocked(levelId + 1, save.completed);
  const groups = facilityLibrary.filter(group => mode === 'sandbox-editor' || level.pieces.some(p => p.kind === group.kind && p.shape === group.shape));
  const invalidCount = Object.values(result.issues).filter(i => i.status === 'INVALID').length;
  const errors = [...new Set(Object.values(result.issues).filter(i => i.status === 'INVALID').flatMap(i => i.reasons))];
  const tutorial = useTutorial({ screen, mode, level, placements, selected, rotations, undoAvailable: !!history.past.length, won: result.won, winOpen, paused: settingsOpen || manualOpen || blueprintOpen || leaveOpen || !!mapCode || replaceChallenge !== null || abandonOpen });
  const { t, localize } = createTranslator(tutorial.state.language);
  tutorialHandler.current = tutorial.onAction;

  useLayoutEffect(() => {
    if (!boardRef.current || !toolsRef.current) return;
    const board = boardRef.current, tools = toolsRef.current;
    const syncHeight = () => {
      if (!board.isConnected || board !== boardRef.current || tools !== toolsRef.current) return;
      const height = board.getBoundingClientRect().height;
      if (height > 0) tools.style.height = height + 'px';
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(board);
    return () => observer.disconnect();
  }, [screen, mode, level.size, tutorial.state.language]);
  const shownKind = selectedPiece?.kind || tipGroup;
  const shownShape = selectedPiece?.shape || tipShape;
  const showFacilityTips = save.settings.facilityTips;

  useEffect(() => { audio.setSettings(save.settings); }, [save.settings]);
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-page-hidden', document.hidden);
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); document.documentElement.removeAttribute('data-page-hidden'); };
  }, []);
  useEffect(() => { audio.setScene(screen === 'game' ? 'game' : 'menu'); }, [screen]);
  useEffect(() => {
    if (playerId || (playerIdStarted.current && !settingsOpen)) return;
    playerIdStarted.current = true;
    setPlayerIdLoading(true);
    void resolvePlayerId().then(id => { setPlayerId(id); setPlayerIdLoading(false); });
  }, [settingsOpen, playerId]);
  useLayoutEffect(() => {
    if (screen === 'game' && mode === 'adventure') adventure.recordProgress(levelId, placements);
  }, [levelId, placements, screen, mode, adventure.recordProgress]);
  function beginCelebration() {
    setSelected(null); setHover(null); audio.play('win');
    celebrationContext.current = { level, placements, mode };
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { setWinOpen(true); return; }
    setCelebration('board');
  }
  function skipCelebration() { setCelebration(null); setWinOpen(true); }
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => {
      if (celebration === 'board') { setWinOpen(true); setCelebration('dialog'); }
      else setCelebration(null);
    }, celebration === 'board' ? 600 : 700);
    const finish = () => { setCelebration(null); setWinOpen(true); };
    const hide = () => { if (document.hidden) finish(); };
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', hide); preference.addEventListener('change', finish);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); preference.removeEventListener('change', finish); };
  }, [celebration]);
  useLayoutEffect(() => {
    const context = celebrationContext.current;
    if (context && (screen !== 'game' || context.level !== level || context.placements !== placements || context.mode !== mode || settingsOpen || manualOpen || blueprintOpen || leaveOpen)) {
      celebrationContext.current = null; setCelebration(null); setWinOpen(false);
    }
  }, [screen, level, placements, mode, settingsOpen, manualOpen, blueprintOpen, leaveOpen]);
  useEffect(() => {
    if (screen === 'game' && mode !== 'sandbox-editor' && !replay && result.won && !wonRef.current) {
      if (mode === 'survival' && challenge) { settleSurvival(challenge); return; }
      wonRef.current = true;
      beginCelebration();
      if (mode === 'adventure' && !save.completed.includes(levelId)) adventure.completeLevel(levelId);
    }
  }, [result.won, levelId, screen, save.completed, mode, challenge, replay]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (settingsOpen || winOpen || manualOpen || blueprintOpen || leaveOpen || mapCode || replaceChallenge !== null || abandonOpen) { if (!dialog?.open) dialog?.showModal(); closeRef.current?.focus(); }
    else dialog?.close();
  }, [settingsOpen, winOpen, manualOpen, blueprintOpen, leaveOpen, mapCode, replaceChallenge, abandonOpen]);

  function sound(name: Parameters<typeof audio.play>[0] = 'click') { void audio.start().then(() => audio.play(name)); }
  function commit(next: Placement[], nextLevel = level) {
    const present = mode === 'sandbox-editor' ? withEditorPlacements({ level: nextLevel, placements }, next) : { level: nextLevel, placements: next };
    historyController.commit(present);
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (screen !== 'game' || settingsOpen || winOpen || manualOpen || blueprintOpen || leaveOpen || mapCode || abandonOpen || replaceChallenge !== null || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
      if (event.key === 'Escape') { setSelected(null); setNotice(''); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [screen, settingsOpen, winOpen, manualOpen, blueprintOpen, leaveOpen, mapCode, abandonOpen, replaceChallenge, undo, redo]);

  function start(id: number, reset = false) {
    setReplay(null);
    if (winOpen) onTutorialAction({ type: 'closeHint' });
    sound(); setSelected(null); setRotations({}); setHover(null); setNotice(''); setWinOpen(false);
    wonRef.current = false; setTerrainBrush(null); setTipGroup(null);
    historyController.restore({ past: [], present: adventure.getStartSnapshot(id, reset), future: [] });
    navigation.enterGame('adventure', id);
  }
  function restart() {
    if (mode === 'survival' && !survivalController.prepareRestart()) return;
    if (winOpen) onTutorialAction({ type: 'closeHint' });
    wonRef.current = false;
    sound(); commit([]); setSelected(null); setRotations({}); setNotice(''); setWinOpen(false); survivalController.resetReward();
  }
  function enterSandbox(mode: 'sandbox-editor' | 'sandbox-play', present: SandboxDraft) {
    setReplay(null); setBlueprintOpen(false);
    historyController.restore({ past: [], present, future: [] });
    setSelected(null); setRotations({}); setHover(null); setTipGroup(null); setNotice('');
    setWinOpen(false); wonRef.current = false; navigation.enterGame(mode);
  }
  function enterSurvival(current: SurvivalChallenge, progress: SurvivalProgress | null) {
    setReplay(null);
    historyController.restore({ past: progress?.past.map(placements => ({ level: current.draft.level, placements })) || [], present: { level: current.draft.level, placements: progress?.placements || [] }, future: progress?.future.map(placements => ({ level: current.draft.level, placements })) || [] });
    setSelected(current.draft.level.pieces.find(piece => piece.id === progress?.selectedId && !progress.placements.some(at => at.id === piece.id)) || null);
    setRotations(progress?.rotations || {}); setHover(null); setTipGroup(null); setNotice('');
    setWinOpen(false); setBlueprintOpen(false); wonRef.current = false; navigation.enterGame('survival');
  }
  function leaveGame() {
    sound();
    if (mode === 'sandbox-editor' && editorDirty) { setLeaveOpen(true); return; }
    returnToMenu();
  }
  function returnToMenu() {
    if (winOpen) onTutorialAction({ type: 'closeHint' });
    sandbox.cancelCheck();
    setLeaveOpen(false); setWinOpen(false); setSelected(null); setTerrainBrush(null); setNotice('');
    if (replay) { setScreen('survival'); setReplay(null); }
    else navigation.returnToMenu(localMapId);
  }
  function reviewSurvival(record: SurvivalRecord) {
    const collected = localMaps.find(map => map.survival?.challengeId === record.id);
    const draft = record.code ? decodeMap(record.code) : collected?.draft;
    if (!draft) return;
    sandbox.openSandboxPlay(draft, record.code ? record.placements : record.finishedAt === undefined ? collected?.progress || [] : draft.placements);
    setReplay(record);
  }
  function closeDialog() {
    if (aboutOpen) { setAboutOpen(false); return; }
    onTutorialAction({ type: 'closeHint' });
    setCelebration(null); setSettingsOpen(false); setWinOpen(false); setManualOpen(false); setBlueprintOpen(false); setLeaveOpen(false); sandbox.closeMapCode(); survivalController.closeSurvivalDialogs();
  }

  return <LanguageContext.Provider value={tutorial.state.language}><div lang={tutorial.state.language === 'zh' ? 'zh-CN' : 'en'} className={`app screen-${screen} ${homeEntering ? 'home-entering' : ''} ${screen === 'game' && mode === 'survival' ? 'survival-game' : ''}`} onPointerDown={() => { void audio.start(); }} onClickCapture={event => {
    if (celebration !== 'board') return;
    if ((event.target as Element).closest('.board-with-clues')) { event.preventDefault(); event.stopPropagation(); skipCelebration(); }
    else setCelebration(null);
  }}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="header">
      <div className="header-actions"><button className="icon-button sound-toggle" aria-label={localize(save.settings.muted ? t("开启声音") : t("静音"))} onClick={() => { updateSettings(s => ({ ...s, muted: !s.muted })); }}>{save.settings.muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button><button className="icon-button" data-tutorial="settings" aria-label={t("设置")} onClick={() => { sound(); setSettingsOpen(true); }}><Settings2 size={20}/></button></div>
    </header>

    {screen === 'menu' && <main className="menu-page">
      <div className="menu-art"><GameTitle entering={homeEntering}/><HeroArt entering={homeEntering}/></div>
      <div className="menu-copy"><div className="menu-buttons"><button className="primary menu-adventure" onClick={() => { sound(); setScreen('adventure'); }}>{t("开始冒险")}<ArrowRight size={23}/></button><button className="secondary menu-journal" onClick={() => { sound(); setScreen('levels'); }}><Map size={21}/>  {t("营地日记")}</button><button className="secondary menu-guide" onClick={() => { sound(); setManualOpen(true); }}><BookOpen size={21}/>  {t("野外手册")}</button></div></div>
    </main>}

    {(screen === 'adventure' || screen === 'sandbox' || screen === 'sandbox-size' || screen === 'sandbox-import' || screen === 'local-maps') && <SandboxMenu key={screen} screen={screen} localMaps={localMaps} onOpenLocalMap={openLocalMap} onEditLocalMap={editLocalMap} onSurvival={openSurvivalMenu} onLocalMapsChange={sandbox.refreshLocalMaps} onBack={() => { sound(); setScreen(screen === 'adventure' ? 'menu' : screen === 'sandbox' || screen === 'local-maps' ? 'adventure' : 'sandbox'); }} onContinue={() => start(continueId)} onNavigate={setScreen} onCreate={openSandbox} onImport={importSandbox} onSound={() => sound()}/>}

    {screen === 'survival' && <SurvivalMenu save={survival} generating={generating} error={survivalError} onStart={requestSurvival} onContinue={continueSurvival} onCancel={cancelGeneration} onBack={() => { sound(); setScreen('adventure'); }} onReview={reviewSurvival} canReview={record => !!record.code || localMaps.some(map => map.survival?.challengeId === record.id)}/> }


    {screen === 'levels' && <main className="levels-page"><button className="back-link" onClick={() => { sound(); setScreen('menu'); }}><ArrowLeft size={16}/>  {t("返回营地")}</button><div className="page-heading"><div><h1>{t("营地日记")}</h1></div><div className="completion-count"><Flag size={21}/><strong>{save.completed.length}</strong><span>/ {levels.length}  {t("已完成")}</span></div></div><div className="level-grid">{levels.map(l => {
      const locked = !levelUnlocked(l.id, save.completed), complete = save.completed.includes(l.id);
      return <button key={l.id} className={`level-card ${complete ? 'completed' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => start(l.id)}><div className="level-card-top"><span>{localize(String(l.id).padStart(2, '0'))}</span>{locked ? <LockKeyhole size={16}/> : complete ? <Check size={18}/> : <ArrowRight size={18}/>}</div>{l.id === 30 ? <div className="level-art-cluster"><Art kind="camp"/><Art kind="cabin"/><Art kind="picnic"/></div> : l.id === 41 || l.id === 44 ? <div className="level-art-cluster"><Art kind="foodTruck"/><Art kind="powerTower"/><Art kind="pool"/></div> : l.id === 43 ? <div className="level-art-cluster"><Art kind="powerTower"/><Art kind="camp"/><Art kind="pool"/></div> : l.id === 45 ? <FacilityArt kind="camp" shape="el"/> : <Art kind={advancedArt[l.id - 16] || (l.id < 5 ? 'water' : l.id < 8 ? 'fire' : l.id < 10 ? 'tower' : 'camp')}/>}<h2>{localize(levelLabel(l.id))}</h2><span className="level-chapter">{localize(locked ? t("完成 {0} 解锁", levelLabel(l.id === 31 ? 15 : l.id - 1)) : `${l.size} × ${l.size}`)}</span></button>;
    })}</div></main>}

    {screen === 'game' && <main className="game-page">
      <div className="game-heading"><div className="game-title"><button className="icon-button" aria-label={localize(mode === 'survival' ? t("返回荒野求生") : mode === 'adventure' ? t("返回营地日记") : localMapId !== undefined ? t("返回本地地图") : t("返回沙盒模式"))} onClick={leaveGame}><ArrowLeft size={20}/></button><div><h1>{localize(mode === 'sandbox-editor' ? t("创造地图") : mode === 'survival' ? t("荒野求生 · {0}难", challenge?.difficulty) : mode === 'sandbox-play' ? sandboxName : levelLabel(level.id))}</h1></div></div>{mode === 'sandbox-editor' ? <div className="status-pill"><Leaf size={14}/>{level.size} × {level.size}</div> : result.won && <div className="status-pill finished"><span/>{t("规划完成")}</div>}</div>
      <div className="play-layout"><section ref={boardRef} className={`board-section ${celebration ? 'celebrating' : ''} ${mode === 'survival' ? 'reward-board' : ''}`} aria-label={t("营地棋盘")}><div className="board-topline"><span><Compass size={16}/>  {t("营地规划图")}</span></div>
        <div className="board-with-clues" key={`${mode}-${level.id}`} style={{ '--size': level.size } as React.CSSProperties}>
          <div className="clue-corner"><Leaf size={17}/></div><div className="column-clues">{level.cols.map((target, i) => <Dashes key={i} target={target} used={result.cols[i]} column/>)}</div>
          <div className="row-clues">{level.rows.map((target, i) => <Dashes key={i} target={target} used={result.rows[i]}/>)}</div>
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
            return <button key={index} data-cell={`${cell.r},${cell.c}`} data-piece-id={at?.id} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''} ${piece ? `placed placed-${piece.kind} ${piece.shape !== 'single' ? 'placed-multi' : ''}` : ''} ${issue?.status === 'INVALID' ? 'invalid' : ''} ${issue?.status === 'INCOMPLETE' ? 'pending' : ''} ${isGhost ? `ghost ${ghostBlocked ? 'blocked' : ''}` : ''} ${hasNeighbor(-1, 0) ? 'join-top' : ''} ${hasNeighbor(1, 0) ? 'join-bottom' : ''} ${hasNeighbor(0, -1) ? 'join-left' : ''} ${hasNeighbor(0, 1) ? 'join-right' : ''}`} aria-label={t("第 {0} 行第 {1} 列，{2}", cell.r + 1, cell.c + 1, label)} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(cell); }} onFocus={() => setHover(cell)} onClick={() => clickCell(cell)} onContextMenu={event => { if (at && piece && piece.shape !== 'single') { event.preventDefault(); rotatePlaced(at, cell); } }}>
              {terrain ? <><Art kind={terrain.kind}/><span className={`terrain-label label-${terrain.kind}`} role="tooltip"><Art kind={terrain.kind}/>{localize(names[terrain.kind])}</span></> : piece ? <>{piece.shape === 'single' && <span className="single-facility-art" data-art-id={at!.id} key={at!.id}><Art kind={piece.kind}/></span>} {save.settings.facilityNames && <span className={`terrain-label label-${piece.kind}`} role="tooltip"><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at!.rotation}/>{localize(names[piece.kind])}</span>}</> : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
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
            return <div className={`placed-facility-art ${issue.status.toLowerCase()} ${hover && cells.some(p => key(p) === key(hover)) ? 'hovered' : ''}`} key={at.id} data-art-id={at.id} data-kind={piece.kind} data-rotation={at.rotation} style={{ gridRow: `${row + 1} / span ${height}`, gridColumn: `${column + 1} / span ${width}` }}><FootprintSurface shape={piece.shape} rotation={at.rotation}/><FacilityArt kind={piece.kind} shape={piece.shape} rotation={at.rotation}/></div>;
          })}</div><div className="facility-art-layer departure-art-layer" aria-hidden="true"/>
          {celebration && <div className="board-celebration" aria-hidden="true"><div className="board-golden-ring"/>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--particle': i, left: `${12 + (i * 29) % 78}%`, top: `${18 + (i * 37) % 70}%` } as React.CSSProperties}>{i % 3 === 0 ? <Leaf size={13}/> : '✦'}</i>)}</div>}
          </div>
        </div>
        <div className="board-legend"><span><i className="yellow-dash"/> {localize(mode === 'sandbox-editor' ? t("自动生成行列目标") : t("待占格数"))}</span><span><span className="legend-dot"/> {localize(mode === 'sandbox-editor' ? t("地形画笔可修改") : t("固定地形不可移动"))}</span><span><MousePointer2 size={13}/>  {t("点击放置 / 拿起")}</span></div>
      </section>
      <aside ref={toolsRef} className={`tools-panel ${mode === 'sandbox-editor' ? 'sandbox-editor-tools' : ''}`}><section className={`facility-panel ${showFacilityTips ? '' : 'tips-hidden'}`}><div className="panel-heading"><h2>{localize(mode === 'sandbox-editor' ? t("设施库") : t("待放设施"))}</h2>{mode !== 'sandbox-editor' && <span>{level.pieces.length - placements.length} <small>/ {level.pieces.length}</small></span>}</div>
      {mode === 'sandbox-editor' && <div className="terrain-tools" aria-label={t("地形画笔")}>{terrainKinds.map(kind => <button key={kind} className={terrainBrush === kind ? 'active' : ''} aria-pressed={terrainBrush === kind} onClick={() => { setTerrainBrush(terrainBrush === kind ? null : kind); setSelected(null); setHover(null); setNotice(`点击空地放置${names[kind]}，再次点击移除`); sound('select'); }}><Art kind={kind}/><span>{localize(names[kind])}</span></button>)}</div>}
      <div className="facility-list">{groups.map(group => {
        const total = level.pieces.filter(p => p.kind === group.kind && p.shape === group.shape);
        const remaining = mode === 'sandbox-editor' ? Infinity : total.filter(p => !placements.some(at => at.id === p.id)).length;
        const active = selectedPiece?.kind === group.kind && selectedPiece.shape === group.shape;
        return <div className="facility-wrapper" key={`${group.kind}-${group.shape}`} onPointerEnter={() => { setTipGroup(group.kind); setTipShape(group.shape); }} onFocus={() => { setTipGroup(group.kind); setTipShape(group.shape); }}>
          <button data-facility={group.kind} data-shape={group.shape} className={`facility-card ${active ? 'active' : ''} ${remaining === 0 ? 'empty' : ''}`} aria-label={localize(t("选择{0}{1}{2}", shapeNames[group.shape], names[group.kind], mode === 'sandbox-editor' ? '，不限数量' : `，剩余 ${remaining}`))} aria-pressed={active} disabled={!remaining} onClick={() => choose(group.kind, group.shape)}>
            <div className={`facility-art ${active ? 'selected-art' : ''}`} key={`${rotations[group.shape] || 0}-${active}`}><FacilityArt kind={group.kind} shape={group.shape} rotation={rotations[group.shape] || 0}/></div>
            <div className="facility-info"><strong>{localize(names[group.kind])}</strong></div>
            {mode !== 'sandbox-editor' && <span className="quantity">{remaining === 0 ? <Check size={14}/> : `×${remaining}`}</span>}
          </button>
        </div>;
      })}</div>
      {showFacilityTips && <div className="rule-dock" aria-live="polite">{shownKind ? <><strong>{localize(names[shownKind])}</strong><span><b>{t("要求")}</b>{localize(facilityTips[shownKind][0])}</span><span><b>{t("禁止")}</b>{localize(facilityTips[shownKind][1])}</span>{shownShape !== 'single' && <span><b>{t("提示")}</b>{t("再次点击卡片旋转")}</span>}</> : <p>{t("选择或悬停设施，查看要求与禁止事项。")}</p>}</div>}
      </section>
      <section className="operations camp-tools"><h2>{t("营地工具")}</h2><div className="camp-tool-grid">
        <button className="camp-tool tool-undo" disabled={!history.past.length} data-tutorial="undo" aria-label={t("撤销")} title={t("撤销")} onClick={undo}><CampToolIcon kind="undo"/><span className="sr-only">{t("撤销")}</span></button>
        {mode === 'sandbox-editor' ? <>
          <button className="camp-tool tool-save sandbox-save" disabled={checking} aria-label={t("保存")} title={checking ? t("正在质检…") : t("保存")} onClick={() => runSandboxAction('save')}><CampToolIcon kind="save"/><span className="sr-only">{t("保存")}</span></button>
          <button className="camp-tool tool-export sandbox-export" disabled={checking} aria-label={t("导出地图")} title={checking ? t("正在质检…") : t("导出地图")} onClick={() => runSandboxAction('export')}><CampToolIcon kind="export"/><span className="sr-only">{t("导出地图")}</span></button>
        </> : <>
          {(mode === 'adventure' || replay || localMapId !== undefined) && <button className="camp-tool tool-blueprint blueprint-button" disabled={!blueprintUnlocked} aria-label={t("图纸")} title={blueprintUnlocked ? t("查看图纸") : mode === 'adventure' ? t("通关后解锁") : t("通关或放弃荒野求生挑战后解锁")} onClick={() => { sound(); setBlueprintOpen(true); }}><CampToolIcon kind="blueprint"/><span className="sr-only">{t("图纸")}</span></button>}
          <button className="camp-tool tool-restart" aria-label={t("重新游玩")} title={t("重新游玩")} onClick={restart}><CampToolIcon kind="restart"/><span className="sr-only">{t("重新游玩")}</span></button>
          {mode === 'survival' ? <>
            <button className="camp-tool tool-save survival-collect" aria-label={t("保存")} title={t("保存")} onClick={collectSurvival}><CampToolIcon kind="save"/><span className="sr-only">{t("保存")}</span></button>
            <button className="camp-tool tool-abandon" aria-label={t("放弃")} title={t("放弃")} onClick={survivalController.openAbandon}><CampToolIcon kind="abandon"/><span className="sr-only">{t("放弃")}</span></button>
          </> : mode === 'sandbox-play' && !replay ? <button className="camp-tool tool-save sandbox-save" disabled={checking} aria-label={t("保存")} title={checking ? t("正在质检…") : t("保存")} onClick={() => runSandboxAction('save')}><CampToolIcon kind="save"/><span className="sr-only">{t("保存")}</span></button> : !replay && <button className="camp-tool tool-journal" aria-label={t("营地日记")} title={t("营地日记")} onClick={returnToMenu}><CampToolIcon kind="journal"/><span className="sr-only">{t("营地日记")}</span></button>}
        </>}
      </div></section>
      </aside></div>
      <div className={`guide-strip ${invalidCount || (mode !== 'adventure' && check && check.status !== 'unique') ? 'warning' : ''}`} role="status" aria-live="polite"><span className="guide-icon"><Megaphone size={18}/></span><div><p>{localize(mode === 'survival' ? notice || errors[0] || (shownKind && showFacilityTips ? t("{0}：{1}；禁止{2}", names[shownKind], facilityTips[shownKind][0], facilityTips[shownKind][1]) : level.tip) : notice || (mode !== 'adventure' ? check?.message : '') || errors.join('；') || level.tip)}</p></div>{invalidCount > 0 && <span className="issue-count">{invalidCount}  {t("处待调整")}</span>}</div>
      {mode === 'survival' && survivalError && <div className="survival-error" role="alert">{localize(survivalError)}{result.won && !survivalReward && <button className="secondary" onClick={() => challenge && settleSurvival(challenge)}>{t("重试结算")}</button>}</div>}
    </main>}

    {!saved && <div className="save-error" role="alert">{t("进度暂未保存，原存档已保留。请检查存储空间后重试。")}<button className="text-button" onClick={adventure.retrySave}>{t("重试保存")}</button></div>}
    <dialog ref={dialogRef} className={`modal ${winOpen ? 'win-modal' : ''} ${blueprintOpen ? 'blueprint-modal' : manualOpen ? 'manual-modal' : ''} ${replaceChallenge !== null || abandonOpen || (mode === 'survival' && winOpen) ? 'survival-modal' : ''}`} onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } }}>
      {!saved && <p className="save-error" role="alert">{t("进度暂未保存，原存档已保留。请检查存储空间后重试。")}</p>}
      <button ref={closeRef} className="modal-close icon-button" aria-label={t("关闭")} onClick={closeDialog}><X size={19}/></button>
      {replaceChallenge !== null ? <><h2>{t("开始新的挑战？")}</h2><p>{t("你有一个未完成的挑战。开始新挑战后将放弃旧进度，已有经验和收藏地图会保留。")}</p><div className="sandbox-modal-actions"><button className="secondary" onClick={survivalController.cancelReplacement}>{t("保留旧挑战")}</button><button className="primary" onClick={survivalController.confirmReplacement}>{t("开始新挑战")}</button></div></> : abandonOpen ? <><h2>{t("放弃当前挑战？")}</h2><p>{t("放弃后无法再挑战本关。已有经验和本地地图会保留，保存的地图可在本地查看图纸和编辑。")}</p>{survivalError && <p className="survival-error" role="alert">{localize(survivalError)}</p>}<div className="sandbox-modal-actions"><button className="secondary" onClick={survivalController.closeAbandon}>{t("继续挑战")}</button><button className="primary" onClick={abandonSurvival}>{t("确定放弃")}</button></div></> : leaveOpen ? <><h2>{localize(localMapId !== undefined ? t("返回本地地图？") : t("返回沙盒模式？"))}</h2><p className="sandbox-check-result">{t("尚未保存的地图将丢失，确定返回吗？")}</p><div className="sandbox-modal-actions"><button className="secondary" onClick={() => setLeaveOpen(false)}>{t("继续创造")}</button><button className="primary" onClick={returnToMenu}>{t("确定返回")}<ArrowRight size={16}/></button></div></> : mapCode ? <div className="map-code"><h2>{t("把营地分享出去")}</h2><p role="status">{localize(notice || '地图代码已复制到剪贴板')}</p><textarea aria-label={t("导出的地图代码")} readOnly value={mapCode} spellCheck={false}/><div className="sandbox-modal-actions"><button className="primary" onClick={sandbox.copyMapCode}><ScrollText size={16}/>{t("再次复制")}</button><button className="secondary" onClick={sandbox.closeMapCode}>{t("继续创造")}</button></div></div> : blueprintOpen && blueprintUnlocked ? <Blueprint level={level} placements={mode === 'sandbox-play' ? sandboxDraft!.placements : getSolution(levelId)!} name={mode === 'sandbox-play' ? sandboxName : undefined}/> : manualOpen ? <Manual/> : settingsOpen && aboutOpen ? <div className="game-about"><h2>{t("游戏说明")}</h2><dl><div><dt>{t("作者")}</dt><dd>lelexia</dd></div><div><dt>{t("制作日期")}</dt><dd>2026-10-07</dd></div><div><dt>{t("游戏版本")}</dt><dd>v{localize(version)}</dd></div><div><dt>{t("更新日期")}</dt><dd>2026-10-12</dd></div><div><dt>{t("项目地址")}</dt><dd><a href="https://github.com/lelexia0131/Wildgrid" target="_blank" rel="noreferrer">https://github.com/lelexia0131/Wildgrid</a></dd></div></dl><p>{t("露营主题逻辑益智游戏：在冒险模式挑战 45 个固定关卡，在荒野求生中选择 10 档难度的随机地图、积累经验和身份徽章，也可以在沙盒中创造、导入和分享地图，并通过本地地图保存、继续游玩。")}</p><p>{t("© 2026 lelexia。野格的原创插画、关卡及合成音乐与音效归作者所有。第三方开源组件的权利归各自作者所有。")}</p><p>{t("感谢 React、Vite、Electron、Capacitor 等开源项目，以及每一位游玩、反馈和支持野格的朋友。")}</p><button className="secondary" onClick={() => setAboutOpen(false)}><ArrowLeft size={16}/>{t("返回设置")}</button></div> : settingsOpen ? <><h2>{t("设置")}</h2><div className="player-id-setting"><span>{t("玩家 ID")}</span><strong className={!playerId ? 'player-id-status' : undefined} role="status" aria-live="polite">{localize(playerIdLoading ? t("获取中…") : playerId || '暂未获取')}</strong></div><div className="volume-control"><label htmlFor="music-volume"><span>{t("背景音乐")}</span><output>{Math.round(save.settings.music * 100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value={Math.round(save.settings.music * 100)} onChange={e => updateSettings(s => ({ ...s, music: Number(e.target.value) / 100 }))}/></div><div className="volume-control"><label htmlFor="effects-volume"><span>{t("交互音效")}</span><output>{Math.round(save.settings.effects * 100)}%</output></label><input id="effects-volume" type="range" min="0" max="100" value={Math.round(save.settings.effects * 100)} onChange={e => updateSettings(s => ({ ...s, effects: Number(e.target.value) / 100 }))} onPointerUp={() => sound('place')}/></div><button className={`mute-setting ${save.settings.muted ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.muted} onClick={() => updateSettings(s => ({ ...s, muted: !s.muted }))}><span>{save.settings.muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}  {t("静音模式")}</span><i/></button><button className={`mute-setting ${save.settings.facilityTips ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.facilityTips} onClick={() => updateSettings(s => ({ ...s, facilityTips: !s.facilityTips }))}><span><MousePointer2 size={18}/>  {t("设施提示")}</span><i/></button><button className={`mute-setting ${save.settings.continuousPlacement ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.continuousPlacement} onClick={() => updateSettings(s => ({ ...s, continuousPlacement: !s.continuousPlacement }))}><span><Grid2X2 size={18}/>  {t("连续放置")}</span><i/></button><button className={`mute-setting ${save.settings.facilityNames ? 'is-muted' : ''}`} role="switch" aria-checked={save.settings.facilityNames} onClick={() => updateSettings(s => ({ ...s, facilityNames: !s.facilityNames }))}><span><Tags size={18}/>  {t("设施名称显示")}</span><i/></button><TutorialSettings tutorial={tutorial}/><button className="settings-about" onClick={() => { sound(); setAboutOpen(true); }}><span><BookOpen size={18}/>{t("游戏说明")}</span><ChevronRight size={16}/></button><p className="settings-note">v{localize(version)}</p></> : mode === 'survival' && survivalReward ? <div className={`win-content survival-win ${survivalReward.rank > survivalReward.beforeRank ? 'survival-upgrade' : ''}`}><SurvivalBadge rank={survivalReward.rank}/><h2>{localize(survivalReward.rank > survivalReward.beforeRank ? t("身份升级！") : t("挑战完成"))}</h2><h3>{localize(survivalRanks[survivalReward.rank].name)}</h3>{survivalReward.rank > survivalReward.beforeRank && <p>{localize(survivalRanks[survivalReward.beforeRank].name)} → {localize(survivalRanks[survivalReward.rank].name)}</p>}<div className="survival-reward"><p>{localize(survivalReward.earned ? t("本次获得 +{0} 经验", survivalReward.earned) : t("这张地图已通关，本次不重复奖励"))}</p><p>{t("累计经验")} {survivalReward.xp}</p><p>{t("难度 {0} · 通关 {1} 次", challenge?.difficulty, survivalReward.count)}</p></div><button className="primary" onClick={returnToMenu}>{t("返回难度选择")}<ArrowRight size={18}/></button><button className="secondary" onClick={collectSurvival}><Save size={18}/>{t("保存")}</button><button className="text-button" onClick={restart}><RotateCcw size={18}/>{t("重新游玩")}</button>{notice && <p role="status">{localize(notice)}</p>}{survivalError && <p className="survival-error" role="alert">{localize(survivalError)}</p>}</div> : <div className="win-content"><div className="win-emblem"><Art kind="camp"/><span><Check size={18}/></span></div><h2>{t("规划完成")}</h2><div className="win-level">{localize(mode === 'sandbox-play' ? sandboxName : levelLabel(levelId))}</div><button className="primary" onClick={() => mode === 'sandbox-play' ? returnToMenu() : nextDay ? start(levelId + 1) : (setWinOpen(false), setScreen('levels'))}>{localize(mode === 'sandbox-play' ? localMapId ? t("返回本地地图") : t("返回沙盒模式") : nextDay ? t("下一关") : t("回看旅程"))}<ArrowRight size={18}/></button><button className="text-button" onClick={restart}><RotateCcw size={15}/>  {t("重新游玩")}</button></div>}
    </dialog>
    {tutorial.active && !celebration && <TutorialOverlay {...tutorial.active} language={tutorial.state.language} onNext={tutorial.next} onBack={tutorial.back} onSkip={tutorial.skip} portal={winOpen ? dialogRef.current : null}/>}
  </div></LanguageContext.Provider>;
}
