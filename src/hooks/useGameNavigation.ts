import { useState } from 'react';
import type { GameMode } from '../engine';

export type Screen = 'menu' | 'adventure' | 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps' | 'survival' | 'levels' | 'game';

export function useGameNavigation(initialLevelId: number) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('adventure');
  const [levelId, setLevelId] = useState(initialLevelId);
  function enterGame(nextMode: GameMode, id?: number) {
    setMode(nextMode);
    if (id !== undefined) setLevelId(id);
    setScreen('game');
  }
  function returnToMenu(localMapId?: number) {
    setScreen(mode === 'survival' ? 'survival' : mode === 'adventure' ? 'levels' : localMapId !== undefined ? 'local-maps' : 'sandbox');
  }
  return { screen, setScreen, mode, levelId, enterGame, returnToMenu };
}
