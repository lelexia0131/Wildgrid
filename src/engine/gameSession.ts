import { evaluate, placementBlock } from './placementRules';
import { key, occupied, rotateAround } from './boardGeometry';
import { withEditorPlacements } from './mapBlueprint';
import { facilityLibrary } from './facilityRegistry';
import type { Cell, FacilityKind, GameMode, Piece, Snapshot, TerrainKind } from './types';

export const MAX_HISTORY_STEPS = 80;

export type GameSession = { readonly mode: GameMode; readonly past: readonly Snapshot[]; readonly present: Snapshot; readonly future: readonly Snapshot[] };
export type GameCommand =
  | { type: 'place'; piece: Piece; cell: Cell; rotation: number }
  | { type: 'remove'; id: string }
  | { type: 'rotate'; id: string; pivot: Cell }
  | { type: 'terrain'; cell: Cell; kind?: TerrainKind }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' };
export type GameEvent = { type: GameCommand['type']; pieceId?: string; kind?: FacilityKind; r?: number; c?: number; rotation?: number };
export type CommandResult = {
  session: GameSession;
  error: { code: 'unknown' | 'duplicate' | 'coordinates' | 'rotation' | 'blocked' | 'mode'; message: string } | null;
  cells: Cell[];
  events: GameEvent[];
};

export function createSession(config: { mode: GameMode; present: Snapshot; past?: readonly Snapshot[]; future?: readonly Snapshot[] }): GameSession {
  return { mode: config.mode, present: config.present, past: config.past?.slice(-MAX_HISTORY_STEPS) || [], future: config.future?.slice(0, MAX_HISTORY_STEPS) || [] };
}

export function getState(session: GameSession) {
  return { ...session.present, result: evaluate(session.present.level, session.present.placements) };
}

export function getAvailableActions(session: GameSession) {
  return { undo: session.past.length > 0, redo: session.future.length > 0, pieces: session.present.level.pieces.filter(piece => !session.present.placements.some(at => at.id === piece.id)) };
}

export function dispatch(session: GameSession, command: GameCommand): CommandResult {
  const { level, placements } = session.present, editor = session.mode === 'sandbox-editor';
  const reject = (code: NonNullable<CommandResult['error']>['code'], message: string, cells: Cell[] = []): CommandResult => ({ session, error: { code, message }, cells, events: [] });
  const accept = (present: Snapshot, event: GameEvent): CommandResult => ({
    session: { ...session, past: [...session.past.slice(1 - MAX_HISTORY_STEPS), session.present], present: editor ? withEditorPlacements(present, present.placements) : present, future: [] },
    error: null, cells: [], events: [event],
  });
  if (command.type === 'undo') return {
    session: session.past.length ? { ...session, past: session.past.slice(0, -1), present: session.past[session.past.length - 1], future: [session.present, ...session.future] } : session,
    error: null, cells: [], events: session.past.length ? [{ type: 'undo' }] : [],
  };
  if (command.type === 'redo') return {
    session: session.future.length ? { ...session, past: [...session.past, session.present], present: session.future[0], future: session.future.slice(1) } : session,
    error: null, cells: [], events: session.future.length ? [{ type: 'redo' }] : [],
  };
  if (command.type === 'clear') return accept({ level, placements: [] }, { type: 'clear' });
  if (command.type === 'terrain') {
    if (!editor) return reject('mode', '只能在创造地图时修改地形');
    const cell = command.cell;
    if (![cell.r, cell.c].every(n => Number.isInteger(n) && n >= 0 && n < level.size)) return reject('coordinates', '地形坐标超出棋盘范围', [cell]);
    if (placements.some(at => occupied(level.pieces.find(piece => piece.id === at.id)!, at).some(p => key(p) === key(cell)))) return reject('blocked', '先拿起这里的设施，再修改地形', [cell]);
    const current = level.terrain.find(t => key(t) === key(cell));
    const terrain = level.terrain.filter(t => key(t) !== key(cell));
    if (command.kind && current?.kind !== command.kind) terrain.push({ ...cell, kind: command.kind });
    return accept({ level: { ...level, terrain }, placements }, { type: 'terrain', ...cell });
  }
  if (command.type === 'place') {
    const existing = level.pieces.find(piece => piece.id === command.piece.id), piece = existing || (editor ? command.piece : undefined);
    if (!piece) return reject('unknown', '未知设施');
    if (!existing && !facilityLibrary.some(template => template.kind === piece.kind && template.shape === piece.shape)) return reject('unknown', '未知设施');
    if (placements.some(at => at.id === piece.id)) return reject('duplicate', '同一设施不能重复放置');
    if (![command.cell.r, command.cell.c].every(Number.isInteger)) return reject('coordinates', '设施坐标无效', [command.cell]);
    if (!Number.isInteger(command.rotation) || command.rotation < 0 || command.rotation > 3) return reject('rotation', '设施旋转方向无效');
    const at = { r: command.cell.r, c: command.cell.c, id: piece.id, rotation: command.rotation };
    const nextLevel = existing ? level : { ...level, pieces: [...level.pieces, piece] };
    const block = placementBlock(nextLevel, placements, at);
    if (block) return reject('blocked', block, occupied(piece, at));
    return accept({ level: nextLevel, placements: [...placements, at] }, { type: 'place', pieceId: piece.id, kind: piece.kind, r: at.r, c: at.c, rotation: at.rotation });
  }
  const at = placements.find(at => at.id === command.id), piece = level.pieces.find(piece => piece.id === command.id);
  if (!at || !piece) return reject('unknown', '未知设施');
  if (command.type === 'remove') return accept({ level, placements: placements.filter(p => p.id !== at.id) }, { type: 'remove', pieceId: piece.id, kind: piece.kind });
  if (![command.pivot.r, command.pivot.c].every(n => Number.isInteger(n) && n >= 0 && n < level.size)) return reject('coordinates', '设施坐标无效', [command.pivot]);
  const next = rotateAround(piece, at, command.pivot), block = placementBlock(level, placements, next);
  if (block) return reject('blocked', block, [...occupied(piece, next), command.pivot]);
  return accept({ level, placements: placements.map(p => p.id === at.id ? next : p) }, { type: 'rotate', pieceId: piece.id, kind: piece.kind, r: next.r, c: next.c, rotation: next.rotation });
}
