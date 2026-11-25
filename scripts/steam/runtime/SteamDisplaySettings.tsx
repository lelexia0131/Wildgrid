import { useEffect, useState } from 'react';
import { useI18n } from '../../localization/LanguageContext';
import './steam-display.css';

interface DisplayState { fullscreen: boolean; saved: boolean }
declare global {
  interface Window {
    wildgridWindow?: {
      getState(): Promise<DisplayState>;
      setFullscreen(value: boolean): Promise<DisplayState>;
      close(): Promise<void>;
      onChange(callback: (state: DisplayState) => void): () => void;
    };
  }
}

export function SteamDisplaySettings() {
  const { language } = useI18n();
  const [state, setState] = useState<DisplayState>();
  useEffect(() => {
    const bridge = window.wildgridWindow;
    if (!bridge) return;
    let active = true;
    const update = (value: DisplayState) => { if (active) setState(value); };
    void bridge.getState().then(update);
    const unsubscribe = bridge.onChange(update);
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!state) return null;
  const en = language === 'en';
  return <div className="steam-display-settings">
    <label className="tutorial-language">{en ? 'Display mode' : '显示模式'}<select aria-label={en ? 'Display mode' : '显示模式'} value={state.fullscreen ? 'fullscreen' : 'windowed'} onChange={event => { void window.wildgridWindow!.setFullscreen(event.target.value === 'fullscreen').then(setState); }}>
      <option value="fullscreen">{en ? 'Borderless fullscreen' : '无边框全屏'}</option>
      <option value="windowed">{en ? 'Windowed' : '窗口模式'}</option>
    </select></label>
    <p>F11 / Alt+Enter</p>
    {!state.saved && <p role="status">{en ? 'Display preference could not be saved.' : '显示模式未能保存。'}</p>}
    <button className="settings-about steam-exit" onClick={() => { void window.wildgridWindow!.close(); }}>{en ? 'Exit game' : '退出游戏'}</button>
  </div>;
}
