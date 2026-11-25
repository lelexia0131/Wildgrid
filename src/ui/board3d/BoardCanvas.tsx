import { useLayoutEffect, useRef } from 'react';
import { Compass, ListOrdered, RotateCcw, Scan } from 'lucide-react';
import { useI18n } from '../../localization/LanguageContext';
import { useDisplay } from './display';
import type { createBoardScene } from './scene';
import type { BoardView } from './landscape';

export function BoardCanvas({view,showClues,onToggleClues}:{view:BoardView;showClues:boolean;onToggleClues:()=>void}) {
  const {quality,change}=useDisplay(),{t}=useI18n();
  const canvas=useRef<HTMLCanvasElement>(null), scene=useRef<ReturnType<typeof createBoardScene>|undefined>(undefined);
  const current=useRef(view),fail=useRef(()=>change({mode:'2d'},true));
  useLayoutEffect(()=>{
    current.current=view;fail.current=()=>change({mode:'2d'},true);scene.current?.setView(view);
  });
  useLayoutEffect(()=>{
    const el=canvas.current!, stage=el.parentElement!;
    let cancelled=false;
    async function load(){
      try{
        const [{createBoardScene},{loadArtLibrary}]=await Promise.all([import('./scene'),import('./models')]);
        if(cancelled)return;
        const assets=await loadArtLibrary();
        if(!cancelled)scene.current=createBoardScene(stage,el,assets,quality,current.current,()=>fail.current());
      }catch(error){
        if(!cancelled){console.warn('Wildgrid 3D',error);fail.current();}
      }
    }
    void load();
    return ()=>{cancelled=true;scene.current?.dispose();scene.current=undefined;};
  },[quality,view.level.size,view.level.id]);
  return <><canvas className="camp-canvas" ref={canvas} aria-hidden="true"/>
    <div className="camera-tools" role="group" aria-label={t('镜头')}>
      {([['home','复位镜头',RotateCcw],['top','正俯视',Scan],['turn','转向下一方位',Compass]] as const).map(([preset,label,Icon])=>
        <button key={preset} type="button" data-camera={preset} aria-label={t(label)} title={t(label)} onClick={()=>scene.current?.preset(preset)}><Icon size={15}/></button>)}
      <button type="button" aria-label={t('行列提示')} title={t('行列提示')} aria-pressed={showClues} onClick={onToggleClues}><ListOrdered size={16}/></button>
    </div></>;
}
