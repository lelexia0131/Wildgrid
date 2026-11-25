import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../../localization/LanguageContext';
import type { Quality } from './landscape';

type Display = {mode:'2d'|'3d'; quality:Quality};
const key='wildgrid-display-v1';
const initial:Display={mode:'3d',quality:'medium'};
function readDisplay():Display {
  try {
    const value=JSON.parse(localStorage.getItem(key)||'{}');
    return {mode:value.mode==='2d'?'2d':'3d',quality:value.quality==='low'||value.quality==='high'?value.quality:'medium'};
  } catch {return initial;}
}
const DisplayContext=createContext({ ...initial, fallback:false, preview:(_mode:Display['mode']|null)=>{}, change:(_patch:Partial<Display>,_fallback=false)=>{} });
export const useDisplay=()=>useContext(DisplayContext);
export function DisplayProvider({children}:{children:ReactNode}){
  const [settings,setSettings]=useState(readDisplay),[fallback,setFallback]=useState(false);
  const [demonstration,preview]=useState<Display['mode']|null>(null);
  function change(patch:Partial<Display>,failed=false){
    const next={...settings,...patch};preview(null);setSettings(next);setFallback(failed);
    try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Preferences still apply for this session. */}
  }
  return <DisplayContext.Provider value={{...settings,mode:demonstration??settings.mode,preview,change,fallback}}>{children}</DisplayContext.Provider>;
}
export function DisplaySettings({inGame}:{inGame:boolean}){
  const {mode,quality,change}=useDisplay(),{t}=useI18n();
  return <div className="display-settings">{inGame && <label>{t('棋盘视图')}<select value={mode} onChange={e=>change({mode:e.target.value as Display['mode']})}>
    <option value="2d">{t('平面规划')}</option><option value="3d">{t('实景营地')}</option></select></label>}
    <label>{t('画面品质')}<select value={quality} onChange={e=>change({quality:e.target.value as Quality})}>
      <option value="low">{t('低')}</option><option value="medium">{t('中')}</option><option value="high">{t('高')}</option></select></label></div>;
}
