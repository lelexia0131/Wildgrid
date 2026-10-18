import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { audio } from '../../platform/audio/WildernessAudio';
import { readLocalMaps, saveLocalMap, unlockSurvivalMaps } from '../../save-system/localMapStorage';
import { completeSurvival, readSurvival, readSurvivalForWrite, writeSurvival } from '../../save-system/survivalStorage';
import { abandonSurvivalChallenge, replaceSurvivalChallenge, restartSurvivalChallenge, updateSurvivalProgress } from '../../game-modes/survival/survivalChallenge';
import { survivalCollectionTarget } from '../../game-modes/sandbox/localMapCollection';
import { createSurvivalGenerationTask } from '../../workers/workerTasks';
import type { GameSession, Piece, Shape } from '../../engine';
import type { SurvivalChallenge, SurvivalProgress, SurvivalReward, SurvivalSave } from '../../game-modes/survival/survivalChallenge';

type Options = {
  active: boolean;
  history: GameSession;
  rotations: Partial<Record<Shape, number>>;
  selected: Piece | null;
  enterGame: (challenge: SurvivalChallenge, progress: SurvivalProgress | null) => void;
  openMenu: () => void;
  returnToMenu: () => void;
  onSettled: () => void;
  invalidateCheck: () => void;
  resetSandboxContext: () => void;
  refreshLocalMaps: () => void;
  setNotice: (message: string) => void;
  sound: (name?: Parameters<typeof audio.play>[0]) => void;
};

export function useSurvivalChallenge({ active, history, rotations, selected, enterGame, openMenu, returnToMenu, onSettled, invalidateCheck, resetSandboxContext, refreshLocalMaps, setNotice, sound }: Options) {
  const [survival, setSurvival] = useState(readSurvival);
  const [challenge, setChallenge] = useState<SurvivalChallenge | null>(null);
  const [survivalReward, setSurvivalReward] = useState<SurvivalReward | null>(null);
  const [survivalError, setSurvivalError] = useState('');
  const [generating, setGenerating] = useState<number | null>(null);
  const [replaceChallenge, setReplaceChallenge] = useState<number | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const generatorRef = useRef(createSurvivalGenerationTask());
  const placements = history.present.placements;

  useLayoutEffect(() => {
    if (!active || !challenge) return;
    try {
      const latest = readSurvivalForWrite();
      const next = updateSurvivalProgress(latest, challenge.id, { placements, past: history.past.map(h => h.placements), future: history.future.map(h => h.placements), rotations, selectedId: selected?.id || null });
      if (next === latest) return;
      writeSurvival(next); setSurvival(next); setSurvivalError('');
    }
    catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '挑战进度保存失败'); }
  }, [active, challenge, history, placements, rotations, selected]);
  useEffect(() => () => generatorRef.current.cancel(), []);

  function openSurvivalMenu() { sound(); setSurvival(readSurvival()); setSurvivalError(''); openMenu(); }
  function persistSurvival(next: SurvivalSave) { writeSurvival(next); setSurvival(next); }
  function playSurvival(current: SurvivalChallenge, feedback = true) {
    const latest = readSurvival(), progress = latest.challenge?.id === current.id ? latest.progress : null;
    if (feedback) sound('confirm');
    invalidateCheck(); setChallenge(current); resetSandboxContext();
    setSurvivalReward(null); setSurvivalError(''); enterGame(current, progress);
  }
  function continueSurvival() {
    const latest = readSurvival();
    if (latest.challenge) playSurvival(latest.challenge);
  }
  function cancelGeneration() {
    generatorRef.current.cancel(); setGenerating(null);
  }
  function requestSurvival(difficulty: number) {
    sound('confirm'); setSurvivalError('');
    const latest = readSurvival(); setSurvival(latest);
    if (latest.challenge) { setReplaceChallenge(difficulty); return; }
    generateChallenge(difficulty);
  }
  function generateChallenge(difficulty: number) {
    if (generatorRef.current.isRunning()) return;
    setReplaceChallenge(null); setGenerating(difficulty); setSurvivalError('');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const id = `wild-${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-')}`;
    try {
      const fail = (message: string) => { cancelGeneration(); setSurvivalError(message); sound('error'); };
      generatorRef.current.start({ difficulty, seed, id, recent: readSurvival().recent }, {
        onError: reason => fail(reason === 'timeout' ? '生成已超时，旧挑战仍然保留，请重试。' : '地图生成失败，旧挑战仍然保留，请重试。'),
        onResult: result => {
          if (!result.challenge) { fail(result.error || '地图生成失败，请重试'); return; }
          const current = { ...result.challenge, startedAt: Date.now() };
          cancelGeneration();
          try {
            const latest = readSurvivalForWrite();
            persistSurvival(replaceSurvivalChallenge(latest, current));
            refreshLocalMaps();
            playSurvival(current, false);
          } catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '新挑战保存失败，旧挑战仍然保留'); sound('error'); }
        },
      });
    } catch { cancelGeneration(); setSurvivalError('地图生成未能启动，请重试。'); sound('error'); }
  }
  function abandonSurvival() {
    try {
      const latest = readSurvivalForWrite();
      const next = abandonSurvivalChallenge(latest, challenge?.id);
      if (next !== latest) persistSurvival(next);
      refreshLocalMaps();
      setAbandonOpen(false); returnToMenu(); sound('close');
    } catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '未能清除挑战进度，请重试'); sound('error'); }
  }
  function collectSurvival() {
    if (!challenge) return;
    try {
      const latest = readSurvivalForWrite();
      const target = survivalCollectionTarget(readLocalMaps(), latest, challenge);
      const map = saveLocalMap(challenge.draft, [], target.existingId, target.survival);
      refreshLocalMaps(); setNotice(`已收藏到${map.name}`); sound('success');
    } catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '收藏失败，请重试'); sound('error'); }
  }
  function settleSurvival(current: SurvivalChallenge) {
    try {
      const settled = completeSurvival(current, placements);
      setSurvival(settled.save); setSurvivalReward(settled.reward); setSurvivalError('');
      onSettled();
      try { unlockSurvivalMaps(current.id); } catch { setSurvivalError('奖励已保存，收藏图纸已解锁；收藏记录写入失败，重新进入本地地图可恢复。'); }
      refreshLocalMaps();
    } catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '结算保存失败，请重试'); sound('error'); }
  }
  function prepareRestart() {
    if (!challenge) return true;
    try {
      const latest = readSurvivalForWrite();
      const next = restartSurvivalChallenge(latest, challenge);
      if (next !== latest) persistSurvival(next);
      return true;
    } catch (cause) { setSurvivalError(cause instanceof Error ? cause.message : '重新挑战保存失败'); sound('error'); return false; }
  }
  function confirmReplacement() {
    if (replaceChallenge === null) return;
    const pending = replaceChallenge; setReplaceChallenge(null); generateChallenge(pending);
  }
  function closeSurvivalDialogs() { setReplaceChallenge(null); setAbandonOpen(false); }

  return {
    survival, challenge, survivalReward, survivalError, generating, replaceChallenge, abandonOpen,
    openSurvivalMenu, continueSurvival, cancelGeneration, requestSurvival, abandonSurvival, collectSurvival, settleSurvival, prepareRestart,
    confirmReplacement, closeSurvivalDialogs, cancelReplacement: () => setReplaceChallenge(null),
    openAbandon: () => { sound(); setAbandonOpen(true); }, closeAbandon: () => setAbandonOpen(false), resetReward: () => setSurvivalReward(null),
  };
}
