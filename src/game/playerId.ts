import { Capacitor, registerPlugin } from '@capacitor/core';

interface PlayerIdResult { playerId: string }
interface NativePlayerId { resolve(options: { apiUrl: string }): Promise<PlayerIdResult> }

declare global {
  interface Window {
    wildgridPlayerId?: { resolve(apiUrl: string): Promise<PlayerIdResult> };
  }
}

const PLAYER_ID_API = 'https://179.255.156.84/api/player-id';
const nativePlayerId = registerPlugin<NativePlayerId>('WildgridPlayerId');
let playerId: string | null = null;
let pending: Promise<string | null> | null = null;

async function requestPlayerId(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = window.wildgridPlayerId
      ? window.wildgridPlayerId.resolve(PLAYER_ID_API)
      : Capacitor.isNativePlatform() ? nativePlayerId.resolve({ apiUrl: PLAYER_ID_API }) : null;
    if (!request) return null;
    const result = await Promise.race([request, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 12000); })]);
    if (!result || typeof result.playerId !== 'string' || !/^\d{6,}$/.test(result.playerId) || /^0+$/.test(result.playerId)) return null;
    playerId = result.playerId;
    return playerId;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function resolvePlayerId(): Promise<string | null> {
  if (playerId) return Promise.resolve(playerId);
  if (!pending) pending = requestPlayerId().finally(() => { pending = null; });
  return pending;
}
