import { useId } from 'react';
import { art } from '../../assets/art';
import { SkyArt } from './Art';
import { CLOUDSEA_SCENES, JOURNAL_PALETTES } from './journalArt';
import type { FacilityKind } from '../../engine';

export function CloudseaTree({ x, y, scale, paint }: { x: number; y: number; scale: number; paint: (name: string) => string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx="21" ry="4" fill="#42665a" opacity=".16"/>
    <path d="M-3 0-2-42 3-44 4 1Z" fill={paint('wood')}/><path d="m0-18-12-12m13 3 9-12" stroke="#887252" strokeWidth="2"/>
    <path d="M0-80Q-7-62-17-50l8 1q-7 13-16 21l11-1q-5 9-13 15Q-11-7 0-12q11 5 27-4-8-8-14-14l11 1Q15-39 9-49l8-1Q7-62 0-80Z" fill={paint('leaf')}/>
    <path d="M-1-74q-2 18-10 25l6-1q-4 14-13 21l9-2q-3 8-11 14l19-1Z" fill="#c1cf9e" opacity=".35"/>
    <path d="M-11-48q12 6 20-1m-25 22q16 6 29-2" stroke="#416b5d" strokeWidth="1" opacity=".4"/>
  </g>;
}

function CloudseaProp({ kind, x, y, scale, angle = 0, paint }: { kind: FacilityKind | 'anchor'; x: number; y: number; scale: number; angle?: number; paint: (name: string) => string }) {
  if (kind === 'balloon' || kind === 'airship' || kind === 'kite' || kind === 'anchor') {
    const width = kind === 'airship' ? 200 : kind === 'kite' ? 300 : 100;
    return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} data-scene-prop={kind}><svg x={-width/2} y="-100" width={width} height="100"><SkyArt kind={kind}/></svg></g>;
  }
  return <g transform={`translate(${x} ${y}) scale(${scale})`} data-scene-prop={kind} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx={kind === 'tower' ? 25 : 46} ry="6" fill="#527665" opacity=".18"/>
    {kind === 'camp' ? <>
      <path d="M-12-48 26-55 49-10 5 7Z" fill={paint('canvas-side')} stroke="#a8845e" strokeWidth=".8"/>
      <path d="M-12-48 26-55 46-12 5 6Z" fill={paint('canvas')}/>
      <path d="M-47 0Q-31-26-12-48Q-3-18 5 7Z" fill="#f7dfac" stroke="#b7976b" strokeWidth=".8"/>
      <path d="M-35 0Q-24-21-13-34L-4 4Z" fill="#5c6252"/>
      <path d="M-13-34q-2 23 9 38l-12-2Z" fill="#b78d5f"/>
      <path d="M-13-34q-14 23-22 34l8 1Z" fill="#e2ba7e"/>
      <path d="m-10-45 35-7M8 1q20-5 36-14" stroke="#fff4d7" strokeWidth="1.7"/>
      <path d="M25-50q1 20 18 38m-21-38q0 22 12 40" stroke="#c59e68" strokeWidth=".8" opacity=".5"/>
      <path d="m-46 1-5 6m55-1 3 5m40-20 5 4" stroke="#9a825b" strokeWidth="1.7"/>
    </> : kind === 'tower' ? <>
      <path d="M-15-55-21 1M16-57l7 58M-13-26l31 23m-32 0 30-25" stroke="#8d7755" strokeWidth="4"/>
      <path d="M-12-54-17 0M12-53l6 52" stroke="#d9bc86" strokeWidth="1"/>
      <path d="M-27-58 10-65 30-55 29-36-25-29Z" fill={paint('wood')} stroke="#876f53" strokeWidth=".9"/>
      <path d="M-25-56 12-62v25l-37 6Z" fill="#e2c79a"/><path d="M-20-51 7-56v12l-27 5Z" fill="#5f7867"/>
      <path d="m-34-58 17-24 19 4 33 22-22 6Z" fill={paint('leaf')} stroke="#6e8866" strokeWidth="1"/>
      <path d="m-17-82 19 4 33 22-22 6Z" fill="#799c7d"/><path d="m-17-79 29 25" stroke="#d5dfb0" strokeWidth="1"/>
      <path d="M-6-28-9 1m9-30L3 0M-7-20h7m-8 8h9m-9 8h10" stroke="#bba074" strokeWidth="2"/>
    </> : kind === 'fire' ? <>
      <ellipse cy="-10" rx="43" ry="29" fill={paint('glow')}/>
      <path d="m-16 0 28-8m-25-2 26 9" stroke="#88664d" strokeWidth="7"/>
      <path d="M-15-6q-8-11 1-21l4 7q-2-17 9-28 2 19 11 25l3-10q14 21 1 29Z" fill={paint('fire')}/>
      <path d="M-6-4q-4-10 6-24 2 12 6 15l-1 10Z" fill="#fff1b5"/>
      <path d="m-24 4 7 4m12 1 8 1m13-3 6-4" stroke="#b6b8a1" strokeWidth="5"/>
    </> : <image href={art.object(kind)} x="-45" y="-70" width="90" height="78"/>}
  </g>;
}

export function Cloudscape({ variant = 0, className = '' }: { variant?: number; className?: string }) {
  const id = `cloudsea-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`, portrait = variant === 15;
  const scene = CLOUDSEA_SCENES[Math.min(variant,14)], colors = JOURNAL_PALETTES[portrait ? 'mint' : scene.palette];
  const paint = (name: string) => `url(#${id}-${name})`, height = portrait ? 310 : 220;
  const props = portrait ? [
    ['camp',99,246,.84],['camp',250,275,.62],['fire',169,273,.43],['tower',277,214,.44],
    ['balloon',79,145,1.05],['balloon',272,113,.48],['airship',216,169,.67,-8],['kite',220,70,.48,7],['anchor',48,233,.43],
  ] as const : scene.props;
  const land = portrait ? 'M0 207Q46 175 105 201T205 222Q268 193 320 218V310H0Z' : scene.land;
  const water = portrait ? 'M0 255Q74 228 133 258T246 263L267 284Q174 288 116 271T0 276Z' : scene.water;
  return <svg className={`cloudscape ${className}`} viewBox={`0 0 320 ${height}`} fill="none" aria-hidden="true" data-scene-composition={portrait ? '云海崖畔的立体营地与系留飞行器' : scene.composition}>
    <defs>
      <linearGradient id={`${id}-sky`} x2=".2" y2="1"><stop stopColor={portrait?'#dce9de':scene.palette==='gold'?'#e8dcbf':scene.palette==='mint'?'#d4e5df':'#cddfe5'}/><stop offset=".7" stopColor="#f4f0db"/><stop offset="1" stopColor={colors.paper}/></linearGradient>
      <linearGradient id={`${id}-land`} x1=".2" y1="0" x2=".8" y2="1"><stop stopColor="#d5dfb7"/><stop offset=".55" stopColor={colors.land}/><stop offset="1" stopColor={colors.shade}/></linearGradient>
      <linearGradient id={`${id}-ridge`} x2=".7" y2="1"><stop stopColor="#acc6c3"/><stop offset="1" stopColor="#71999f"/></linearGradient>
      <linearGradient id={`${id}-water`} x2=".7" y2="1"><stop stopColor="#d1e9dd"/><stop offset=".45" stopColor="#a3ccd0"/><stop offset="1" stopColor="#6fa9b9"/></linearGradient>
      <linearGradient id={`${id}-mist`} x2="0" y2="1"><stop stopColor="#fffbe9" stopOpacity=".96"/><stop offset="1" stopColor="#dae7df" stopOpacity=".7"/></linearGradient>
      <linearGradient id={`${id}-leaf`} x2=".7" y2="1"><stop stopColor="#a1ba8e"/><stop offset=".5" stopColor="#789e7f"/><stop offset="1" stopColor="#456f62"/></linearGradient>
      <linearGradient id={`${id}-wood`} x2=".8" y2="1"><stop stopColor="#dfc08e"/><stop offset="1" stopColor="#927256"/></linearGradient>
      <linearGradient id={`${id}-canvas`} x2=".7" y2="1"><stop stopColor="#fff1c4"/><stop offset=".5" stopColor="#edcc8d"/><stop offset="1" stopColor="#c49b66"/></linearGradient>
      <linearGradient id={`${id}-canvas-side`} x2="1" y2="1"><stop stopColor="#dfba80"/><stop offset="1" stopColor="#a77651"/></linearGradient>
      <linearGradient id={`${id}-fire`} x2="0" y2="1"><stop stopColor="#ffe6a0"/><stop offset="1" stopColor="#d88956"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#ffe5a3" stopOpacity=".7"/><stop offset="1" stopColor="#ffe5a3" stopOpacity="0"/></radialGradient>
      <clipPath id={`${id}-frame`}>{portrait ? <path d="M8 195C-2 139 34 119 46 82C74 3 247 14 281 86C301 123 329 159 315 213C310 282 261 303 165 304C71 306 13 276 8 195Z"/> : <rect width="320" height={height} rx="16"/>}</clipPath>
    </defs>
    <g clipPath={`url(#${id}-frame)`} strokeLinecap="round" strokeLinejoin="round">
      <rect width="320" height={height} fill={paint('sky')}/>
      <circle cx={scene.sun[0]} cy={scene.sun[1]} r={scene.sun[2]*2.2} fill={paint('glow')}/><circle cx={scene.sun[0]} cy={scene.sun[1]} r={scene.sun[2]} fill="#fff2c8" opacity=".9"/>
      <path d="M-15 97Q38 56 73 87T139 69 213 91 278 57 343 85V173H0Z" fill={colors.haze} opacity=".65"/>
      <path d={`${scene.ridge}V${portrait?208:163}H0Z`} fill={paint('ridge')} opacity=".75" transform={portrait?'translate(0 26)':undefined}/>
      <path d="m36 115 23-25 17 17-14-5-12 14m91-20 23-30 21 27-19-11-13 15m99 13 20-21 16 18-17-8" stroke="#dce8dc" strokeWidth="2" opacity=".4"/>
      <g className="cloudsea-mist" transform={portrait?'translate(0 44)':undefined}>
        <path d="M-20 133q33-24 61-9t56-1 63 5 63-11 64 3 57-6v51H0Z" fill={paint('mist')}/>
        <path d="M-13 148q37-11 59-1t55-2m111-7q31 15 74 3" stroke="#fffced" strokeWidth="2" opacity=".75"/>
      </g>
      <path d={land} fill="#7e9a88" transform="translate(0 5)" opacity=".7"/>
      <path d={land} fill={paint('land')}/>
      <path d={land} stroke="#eef0d2" strokeWidth="1" opacity=".6"/>
      {water && <><path d={water} stroke="#eadfc1" strokeWidth="6" fill={paint('water')}/><path d={water} fill={paint('water')}/><path d={portrait?'M10 261q42-13 73-3m39 11 30 8m44-6 25-1':'M143 164q29-7 54-3m28 9 23-2m-72 10 20 1'} stroke="#f4fae9" strokeWidth="1.3" opacity=".65"/></>}
      {scene.trail && !portrait && <><path d={scene.trail} stroke={colors.sand} strokeWidth="11"/><path d={scene.trail} stroke="#f5e8c8" strokeWidth="1" opacity=".6"/></>}
      {(portrait?[[20,236,.87],[306,264,.89],[237,214,.36]]:scene.trees).map(([x,y,scale],i)=><CloudseaTree key={i} x={x} y={y} scale={scale} paint={paint}/>)}
      {props.filter(([kind])=>!['balloon','airship','kite','anchor'].includes(kind)).map(([kind,x,y,scale,angle],i)=><CloudseaProp key={`ground-${i}`} kind={kind} x={x} y={y} scale={scale} angle={angle} paint={paint}/>)}
      {props.filter(([kind])=>kind==='anchor').map(([kind,x,y,scale],i)=><CloudseaProp key={`anchor-${i}`} kind={kind} x={x} y={y} scale={scale} paint={paint}/>)}
      {portrait && <path d="M76 139q-4 54-26 83" stroke="#a88e65" strokeWidth="1.1"/>}
      {variant===0 && <path d="M78 117q-3 39 6 65" stroke="#a88e65" strokeWidth=".85"/>}
      {props.filter(([kind])=>['balloon','airship','kite'].includes(kind)).map(([kind,x,y,scale,angle],i)=><CloudseaProp key={`sky-${i}`} kind={kind} x={x} y={y} scale={scale} angle={angle} paint={paint}/>)}
      <g transform={`translate(0 ${height-220})`}>
        {scene.frame==='rock' ? <><path d="m0 220 8-25 25-7 22 16 24 16Z" fill="#9eafa3"/><path d="m8 195 25-7 22 16-30-3Z" fill="#d3d7bc"/><path d="m273 220 13-19 18-4 16 9v14Z" fill="#9cae9f"/></> : <>
          <path d="M0 220v-17q15-19 28-6 12-15 28-1 13-1 18 24M265 220q9-23 24-16 18-23 31-6v22Z" fill={paint('leaf')} opacity=".7"/>
          <path d="m17 212 4-6m8 8 3-9m264 11 4-11m9 10 4-6" stroke="#d8dfad" strokeWidth="1.3"/>
        </>}
        <g fill="#f9edc1"><circle cx="43" cy="206" r="1.8"/><circle cx="39" cy="210" r="1.2"/><circle cx="281" cy="211" r="1.4"/><circle cx="286" cy="215" r="1.2"/></g>
        <path d="m97 211 3-5m2 6 3-3m128 3 2-5m3 6 3-3" stroke="#a7b58d" strokeWidth="1" opacity=".8"/>
      </g>
      <path d="M18 48q8-6 14 0m1 0q7-5 13 0" stroke="#789e9a" strokeWidth="1" opacity=".45"/>
    </g>
  </svg>;
}

export function ChapterArtwork({ chapter }: { chapter: number }) {
  if (chapter === 3) return <div className="chapter-art" aria-hidden="true"><Cloudscape variant={15}/></div>;
  const layers = art.chapters[chapter];
  return <div className="chapter-art" aria-hidden="true">
    <img src={layers.base} alt="" draggable={false}/>
    <img className="chapter-cloud" src={layers.cloud} alt="" draggable={false}/>
    <img className="chapter-ripples" src={layers.ripples} alt="" draggable={false}/>
  </div>;
}
