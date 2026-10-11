import { useCallback, useMemo, useRef, useState } from 'react';
import { evaluate, key, occupied, placementBlock, rotateAround } from '../game/rules';
import { withEditorPlacements } from '../game/sandbox';
import type { SandboxDraft } from '../game/sandbox';
import type { Cell, FacilityKind, GameMode, Level, Piece, Placement, Shape, TerrainKind } from '../game/types';
import { audio } from '../game/audio';
import { terrainNames } from '../game/facilityRegistry';
import type { TutorialEvent } from '../game/tutorial';

type Options = {
  mode: GameMode; level: Level; placements: Placement[]; continuousPlacement: boolean;
  terrainBrush: TerrainKind | null; clearTerrainBrush: () => void;
  commit: (placements: Placement[], level?: Level) => void;
  setNotice: (notice: string) => void;
  sound: (name?: Parameters<typeof audio.play>[0]) => void;
  onAction?: (event: TutorialEvent) => void;
};
export function useGamePlacement({ mode, level, placements, continuousPlacement, terrainBrush, clearTerrainBrush, commit, setNotice, sound, onAction }: Options) {
  const [selected, setSelected] = useState<Piece | null>(null);
  const [rotations, setRotations] = useState<Partial<Record<Shape, number>>>({});
  const [hover, setHover] = useState<Cell | null>(null);
  const nextPieceId = useRef(0);
  const result = useMemo(() => evaluate(level, placements), [level, placements]);
  const rotation = selected ? rotations[selected.shape] || 0 : 0;
  const rotate = useCallback(() => {
    if (!selected || selected.shape === 'single') return;
    setRotations(s => ({ ...s, [selected.shape]: ((s[selected.shape] || 0) + 1) % 4 })); audio.play('rotate');
    onAction?.({ type: 'rotate', kind: selected.kind, pieceId: selected.id });
  }, [selected, onAction]);
  function resetPieceIds(draft: SandboxDraft) {
    nextPieceId.current = Math.max(0, ...draft.level.pieces.map(piece => Number(/^custom-(\d+)$/.exec(piece.id)?.[1]) || 0));
  }
  function choose(kind: FacilityKind, shape: Shape) {
    clearTerrainBrush();
    if (selected?.kind === kind && selected.shape === shape) { if (shape !== 'single') rotate(); else setSelected(null); return; }
    const piece = mode === 'sandbox-editor' ? { id: `custom-${++nextPieceId.current}`, kind, shape } : level.pieces.find(p => p.kind === kind && p.shape === shape && !placements.some(at => at.id === p.id));
    if (piece) { setSelected(piece); setNotice(''); sound('select'); onAction?.({ type: 'select', kind: piece.kind, pieceId: piece.id }); }
  }
  function rotatePlaced(at: Placement, pivot: Cell) {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const next = rotateAround(piece, at, pivot);
    const block = placementBlock(level, placements, next);
    if (block) { setNotice(block.includes('地形') || block.includes('重叠') ? '已经被占用' : block); sound('error'); return; }
    commit(placements.map(p => p.id === at.id ? next : p)); setNotice(''); sound('rotate');
    onAction?.({ type: 'rotate', kind: piece.kind, pieceId: piece.id });
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
      sound('pickup'); onAction?.({ type: 'pickup', kind: piece.kind, pieceId: piece.id }); return;
    }
    const terrain = level.terrain.find(t => key(t) === key(cell));
    if (mode === 'sandbox-editor' && terrain && !selected) {
      commit(placements, { ...level, terrain: level.terrain.filter(t => key(t) !== key(cell)) });
      setNotice(''); sound('pickup'); return;
    }
    if (!selected) { setNotice(terrain ? terrainNames[terrain.kind] : '先从右侧选择一个设施'); return; }
    const candidate = { ...cell, id: selected.id, rotation };
    const placementLevel = mode === 'sandbox-editor' ? { ...level, pieces: [...level.pieces, selected] } : level;
    const block = placementBlock(placementLevel, placements, candidate);
    if (block) { setNotice(block); sound('error'); return; }
    const next = [...placements, candidate];
    commit(next, placementLevel);
    const issue = evaluate(mode === 'sandbox-editor' ? withEditorPlacements({ level: placementLevel, placements }, next).level : level, next).issues[candidate.id];
    sound(issue.status === 'INVALID' ? 'error' : 'place');
    const nextPiece = !continuousPlacement ? null : mode === 'sandbox-editor'
      ? { ...selected, id: `custom-${++nextPieceId.current}` }
      : level.pieces.find(p => p.kind === selected.kind && p.shape === selected.shape && !next.some(at => at.id === p.id)) || null;
    setNotice(''); setSelected(nextPiece); setHover(null);
    onAction?.({ type: 'place', kind: selected.kind, pieceId: selected.id });
  }
  const ghost = selected && hover ? occupied(selected, { ...hover, id: selected.id, rotation }) : [];
  const ghostBlocked = selected && hover ? Boolean(placementBlock(mode === 'sandbox-editor' ? { ...level, pieces: [...level.pieces, selected] } : level, placements, { ...hover, id: selected.id, rotation })) : false;
  return { selected, setSelected, rotations, setRotations, hover, setHover, rotation, result, choose, rotatePlaced, clickCell, ghost, ghostBlocked, resetPieceIds };
}
