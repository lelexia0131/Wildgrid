import { useCallback, useMemo, useRef, useState } from 'react';
import { dispatch as previewCommand, getAvailableActions, getState, key, occupied, placementOrigin } from '../../engine';
import type { SandboxDraft } from '../../engine';
import type { Cell, FacilityKind, GameSession, Piece, Placement, Shape, TerrainKind } from '../../engine';
import type { audio } from '../../platform/audio/WildernessAudio';
import { terrainNames } from '../../engine';
import type { TutorialEvent } from '../tutorial/tutorialLessons';

type Options = {
  session: GameSession; continuousPlacement: boolean;
  terrainBrush: TerrainKind | null; clearTerrainBrush: () => void;
  dispatch: (command: Parameters<typeof previewCommand>[1]) => ReturnType<typeof previewCommand>;
  setNotice: (notice: string) => void;
  sound: (name?: Parameters<typeof audio.play>[0]) => void;
  onAction?: (event: TutorialEvent) => void;
  onReject: (cells: Cell[]) => void;
};
export function useGamePlacement({ session, continuousPlacement, terrainBrush, clearTerrainBrush, dispatch, setNotice, sound, onAction, onReject }: Options) {
  const { mode } = session;
  const { level, placements, result } = useMemo(() => getState(session), [session]);
  const [selected, setSelected] = useState<Piece | null>(null);
  const [rotations, setRotations] = useState<Partial<Record<Shape, number>>>({});
  const [hover, setHover] = useState<Cell | null>(null);
  const nextPieceId = useRef(0);
  const rotation = selected ? rotations[selected.shape] || 0 : 0;
  const rotate = useCallback(() => {
    if (!selected || selected.shape === 'single') return;
    const nextRotation = ((rotations[selected.shape] || 0) + 1) % 4;
    setRotations(s => ({ ...s, [selected.shape]: nextRotation })); sound('rotate');
    onAction?.({ type: 'rotate', kind: selected.kind, pieceId: selected.id, rotation: nextRotation });
  }, [selected, rotations, onAction, sound]);
  function resetPieceIds(draft: SandboxDraft) {
    nextPieceId.current = Math.max(0, ...draft.level.pieces.map(piece => Number(/^custom-(\d+)$/.exec(piece.id)?.[1]) || 0));
  }
  function choose(kind: FacilityKind, shape: Shape) {
    clearTerrainBrush();
    if (selected?.kind === kind && selected.shape === shape) { if (shape !== 'single') rotate(); else { setSelected(null); sound('close'); } return; }
    const piece = mode === 'sandbox-editor' ? { id: `custom-${++nextPieceId.current}`, kind, shape } : getAvailableActions(session).pieces.find(p => p.kind === kind && p.shape === shape);
    if (piece) { setSelected(piece); setNotice(''); sound('select'); onAction?.({ type: 'select', kind: piece.kind, pieceId: piece.id }); }
  }
  function rotatePlaced(at: Placement, pivot: Cell) {
    const piece = level.pieces.find(p => p.id === at.id)!;
    const outcome = dispatch({ type: 'rotate', id: at.id, pivot });
    if (outcome.error) { onReject(outcome.cells); setNotice(outcome.error.message); sound('error'); return; }
    setNotice(''); sound('rotate');
    onAction?.({ type: 'rotate', kind: piece.kind, pieceId: piece.id });
  }
  function clickCell(cell: Cell) {
    if (mode === 'sandbox-editor' && terrainBrush) {
      const outcome = dispatch({ type: 'terrain', cell, kind: terrainBrush });
      if (outcome.error) { onReject(outcome.cells); setNotice(outcome.error.message); sound('error'); return; }
      setNotice(''); sound('place'); return;
    }
    const placed = placements.find(at => occupied(level.pieces.find(p => p.id === at.id)!, at).some(p => key(p) === key(cell)));
    if (placed) {
      const piece = level.pieces.find(p => p.id === placed.id)!;
      const outcome = dispatch({ type: 'remove', id: placed.id });
      if (outcome.error) { onReject(outcome.cells); setNotice(outcome.error.message); sound('error'); return; }
      setSelected(piece); setRotations(s => ({ ...s, [piece.shape]: placed.rotation }));
      setNotice('');
      sound('pickup'); onAction?.({ type: 'pickup', kind: piece.kind, pieceId: piece.id }); return;
    }
    const terrain = level.terrain.find(t => key(t) === key(cell));
    if (mode === 'sandbox-editor' && terrain && !selected) {
      const outcome = dispatch({ type: 'terrain', cell });
      if (outcome.error) { onReject(outcome.cells); setNotice(outcome.error.message); sound('error'); return; }
      setNotice(''); sound('pickup'); return;
    }
    if (!selected) { setNotice(terrain ? terrainNames[terrain.kind] : '先从右侧选择一个设施'); sound(terrain ? 'click' : 'error'); return; }
    const origin = placementOrigin(selected.shape, rotation, cell);
    const outcome = dispatch({ type: 'place', piece: selected, cell: origin, rotation });
    if (outcome.error) { onReject(outcome.cells); setNotice(outcome.error.message); sound('error'); return; }
    const issue = getState(outcome.session).result.issues[selected.id];
    sound(issue.status === 'INVALID' ? 'error' : 'place');
    if (issue.status === 'INVALID') onReject(occupied(selected, { ...origin, id: selected.id, rotation }));
    const nextPiece = !continuousPlacement ? null : mode === 'sandbox-editor'
      ? { ...selected, id: `custom-${++nextPieceId.current}` }
      : getAvailableActions(outcome.session).pieces.find(p => p.kind === selected.kind && p.shape === selected.shape) || null;
    setNotice(issue.status === 'INVALID' ? issue.reasons.join('；') : ''); setSelected(nextPiece); setHover(null);
    onAction?.({ type: 'place', kind: selected.kind, pieceId: selected.id, r: origin.r, c: origin.c, rotation });
  }
  const ghostOrigin = selected && hover ? placementOrigin(selected.shape, rotation, hover) : null;
  const ghost = selected && ghostOrigin ? occupied(selected, { ...ghostOrigin, id: selected.id, rotation }) : [];
  const ghostBlocked = selected && ghostOrigin ? Boolean(previewCommand(session, { type: 'place', piece: selected, cell: ghostOrigin, rotation }).error) : false;
  return { selected, setSelected, rotations, setRotations, hover, setHover, rotation, result, choose, rotatePlaced, clickCell, ghost, ghostBlocked, resetPieceIds };
}
