import { useCallback, useEffect, useRef, useState } from 'react';
import type { audio } from '../game/audio';
import { writeClipboard } from '../game/clipboard';
import { readLocalMaps, saveLocalMap } from '../game/localMaps';
import type { LocalMap } from '../game/localMaps';
import { createSandbox, decodeMap, encodeMap } from '../game/sandbox';
import type { SandboxCheck, SandboxDraft } from '../game/sandbox';
import type { GameMode, Placement, TerrainKind } from '../game/types';

type Options = {
  mode: GameMode;
  present: SandboxDraft;
  placements: Placement[];
  enterGame: (mode: 'sandbox-editor' | 'sandbox-play', snapshot: SandboxDraft) => void;
  resetPieceIds: (draft: SandboxDraft) => void;
  setNotice: (message: string) => void;
  sound: (name?: Parameters<typeof audio.play>[0]) => void;
};

export function useSandboxEditor({ mode, present, placements, enterGame, resetPieceIds, setNotice, sound }: Options) {
  const [localMaps, setLocalMaps] = useState(readLocalMaps);
  const [localMapId, setLocalMapId] = useState<number>();
  const [sandboxDraft, setSandboxDraft] = useState<SandboxDraft | null>(null);
  const [mapCode, setMapCode] = useState('');
  const [check, setCheck] = useState<SandboxCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [terrainBrush, setTerrainBrush] = useState<TerrainKind | null>(null);
  const checkerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);

  const cancelCheck = useCallback(() => {
    checkerRef.current?.terminate(); checkerRef.current = null; revisionRef.current++;
    setChecking(false);
  }, []);
  const invalidateCheck = useCallback(() => { cancelCheck(); setCheck(null); }, [cancelCheck]);
  const refreshLocalMaps = useCallback(() => setLocalMaps(readLocalMaps()), []);
  const resetSandboxContext = useCallback(() => {
    setLocalMapId(undefined); setSandboxDraft(null); setTerrainBrush(null);
  }, []);
  const markEditorDirty = useCallback(() => setEditorDirty(true), []);
  useEffect(() => () => checkerRef.current?.terminate(), []);

  function openSandbox(size: 6 | 8) {
    sound(); invalidateCheck(); resetSandboxContext();
    enterGame('sandbox-editor', createSandbox(size));
    setCheck(null); setChecking(false); setEditorDirty(false);
  }
  function openSandboxPlay(draft: SandboxDraft, progress: Placement[] = [], id?: number) {
    sound(); invalidateCheck(); setSandboxDraft(draft); setLocalMapId(id); setTerrainBrush(null);
    enterGame('sandbox-play', { level: draft.level, placements: progress });
  }
  function importSandbox(code: string) { openSandboxPlay(decodeMap(code)); }
  function openLocalMap(map: LocalMap) { openSandboxPlay(map.draft, map.progress, map.id); }
  function editLocalMap(map: LocalMap) {
    if (map.survival && !map.survival.blueprintUnlocked) { setNotice('通关或放弃挑战后才能编辑这张地图'); return; }
    openSandbox(map.draft.level.size as 6 | 8);
    setLocalMapId(map.id); enterGame('sandbox-editor', structuredClone(map.draft));
    resetPieceIds(map.draft);
  }
  function runSandboxAction(action: 'save' | 'export') {
    if (mode === 'survival') return;
    if (checking || checkerRef.current) return;
    const draft = mode === 'sandbox-editor' ? present : sandboxDraft;
    if (!draft) return;
    sound();
    const revision = revisionRef.current;
    setChecking(true); setCheck(null); setNotice('正在进行营地质检…');
    try {
      const worker = new Worker(new URL('../game/sandbox.worker.ts', import.meta.url), { type: 'module' });
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
          refreshLocalMaps(); setLocalMapId(map.id); setEditorDirty(false);
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
  function copyMapCode() {
    void writeClipboard(mapCode).then(() => setNotice('地图代码已复制到剪贴板')).catch(() => setNotice('暂时无法复制，请重试'));
  }

  return {
    localMaps, localMapId, sandboxDraft, mapCode, check, checking, editorDirty, terrainBrush, setTerrainBrush,
    openSandbox, openSandboxPlay, importSandbox, openLocalMap, editLocalMap, runSandboxAction, copyMapCode,
    closeMapCode: () => setMapCode(''), invalidateCheck, cancelCheck, markEditorDirty, resetSandboxContext, refreshLocalMaps,
  };
}
