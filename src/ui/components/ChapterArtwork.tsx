import { useId, type CSSProperties } from 'react';
import { getJournalChapterArt, JOURNAL_PALETTES } from './journalArt';
import { Cabin, Campfire, FoodTruck, PicnicTable, Pool, PowerTower, Rock, ScenePaints, Shrub, Tent, Tree } from './JournalSceneObjects';

function CreekScene({ id }: { id: string }) {
  return <>
    <Tree x={56} y={147} scale={.65} variant="round" paintId={id}/>
    <Tree x={97} y={138} scale={.48} paintId={id}/>
    <Tree x={271} y={145} scale={.52} variant="round" paintId={id}/>
    <path d="M291 130c-33 0-58 13-60 30-2 21 13 25-6 42-20 18-17 44 11 67h70v-48c-36 8-61-9-50-23 21-26 2-32 15-48 5-6 13-11 28-13Z" fill="var(--scene-sand)"/>
    <path d="M294 136c-32 0-52 11-54 25-2 20 14 26-5 44-17 17-12 42 13 64h58v-43c-35 7-64-9-52-30 15-25 0-32 14-46 6-6 14-10 26-10Z" fill={`url(#${id}-water)`}/>
    <path className="chapter-ripples" d="M258 153q10-4 19-2m-34 27 15 1m-30 36q10 4 19 1m10 28 23 2" fill="none" stroke="#f3fbef" strokeWidth="2.4" strokeLinecap="round" opacity=".8"/>
    <path d="M49 191c18-25 71-31 113-15 17 7 36 7 46 3-12 31-65 47-118 35Z" fill="var(--scene-sand)" opacity=".85"/>
    <Tent x={127} y={184} scale={1.24} paintId={id}/>
    <PicnicTable x={71} y={223} scale={.63} paintId={id}/>
    <Campfire x={168} y={224} scale={.75} paintId={id}/>
    <Rock x={252} y={206} scale={.73} paintId={id}/>
    <Rock x={219} y={151} scale={.43} paintId={id}/>
    <Shrub x={69} y={238} scale={.8} paintId={id}/>
    <Shrub x={211} y={246} scale={.68} paintId={id}/>
  </>;
}

function WoodlandScene({ id }: { id: string }) {
  return <>
    <g opacity=".72">
      <Tree x={64} y={149} scale={.75} paintId={id}/>
      <Tree x={103} y={140} scale={.65} variant="round" paintId={id}/>
      <Tree x={199} y={134} scale={.68} paintId={id}/>
      <Tree x={259} y={160} scale={.91} paintId={id}/>
    </g>
    <path d="M166 143c-27 8-40 25-35 40 9 24 1 34-41 68" fill="none" stroke="var(--scene-sand)" strokeWidth="22" strokeLinecap="round"/>
    <path d="M266 170c-16 4-27 13-23 20 6 12 31 17 60 10v-32Z" fill={`url(#${id}-water)`}/>
    <path className="chapter-ripples" d="m264 183 15-2m-21 14 20 1" stroke="#f1f6e4" strokeWidth="2" strokeLinecap="round"/>
    <Cabin x={148} y={184} scale={1.08} paintId={id}/>
    <Tent x={231} y={176} scale={.58} paintId={id}/>
    <PicnicTable x={109} y={226} scale={.77} paintId={id}/>
    <Campfire x={200} y={228} scale={.73} paintId={id}/>
    <Tree x={49} y={209} scale={1.02} paintId={id}/>
    <Tree x={268} y={215} scale={.88} variant="round" paintId={id}/>
    <Shrub x={67} y={245} scale={.73} paintId={id}/>
    <Shrub x={242} y={233} scale={.7} paintId={id}/>
    <Rock x={171} y={248} scale={.49} paintId={id}/>
  </>;
}

function HighlandScene({ id }: { id: string }) {
  return <>
    <path d="M228 115c-39 13-69 20-91 41s-56 31-103 37" fill="none" stroke="var(--scene-sand)" strokeWidth="13" strokeLinecap="round"/>
    <path d="M290 132c-28 8-47 19-36 32 13 13 25 12 48 16v-47Z" fill={`url(#${id}-water)`}/>
    <Tree x={41} y={152} scale={.44} paintId={id}/>
    <PowerTower x={249} y={132} scale={.66} paintId={id}/>
    <path d="M265 81q20 8 36 0m-33 11q18 8 33 1" fill="none" stroke="var(--scene-deep)" strokeWidth="1.1" opacity=".5"/>
    <Tent x={79} y={182} scale={.96} paintId={id}/>
    <Pool x={235} y={192} scale={.78} paintId={id}/>
    <path d="M76 199c37-15 48-4 57 14s26 29 67 24" fill="none" stroke="var(--scene-sand)" strokeWidth="16" strokeLinecap="round"/>
    <FoodTruck x={149} y={231} scale={1.04} paintId={id}/>
    <Tree x={43} y={213} scale={.64} paintId={id}/>
    <Shrub x={67} y={247} scale={.72} paintId={id}/>
    <Shrub x={242} y={239} scale={.7} paintId={id}/>
    <Rock x={265} y={225} scale={.74} paintId={id}/>
    <Rock x={193} y={153} scale={.48} paintId={id}/>
  </>;
}

export function ChapterArtwork({ chapter }: { chapter: number }) {
  const id = useId().replace(/:/g, '');
  const art = getJournalChapterArt(chapter);
  const palette = JOURNAL_PALETTES[chapter === 0 ? 'stream' : chapter === 1 ? 'olive' : 'fog'];
  const style = Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--scene-${key}`, value])) as CSSProperties;
  return <svg className={`chapter-art scene-${art.theme}`} style={style} viewBox="0 0 320 275" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true">
    <ScenePaints id={id}/>
    <defs>
      <linearGradient id={`${id}-chapter-sky`} x2="0" y2="1"><stop stopColor={art.sky}/><stop offset="1" stopColor={palette.paper}/></linearGradient>
      <linearGradient id={`${id}-chapter-ground`} x2=".25" y2="1"><stop stopColor={art.grass}/><stop offset="1" stopColor={palette.land}/></linearGradient>
      <clipPath id={`${id}-chapter-frame`}><path d="M17 148C14 82 63 29 124 20c68-12 140 14 166 73 28 63 10 115-30 143-45 31-144 29-196 5-35-16-49-53-47-93Z"/></clipPath>
    </defs>
    <g clipPath={`url(#${id}-chapter-frame)`}>
      <path d="M0 0h320v275H0Z" fill={`url(#${id}-chapter-sky)`}/>
      <circle cx={chapter === 1 ? 165 : 235} cy="57" r="27" fill="#fff0bb" opacity=".5"/>
      <circle cx={chapter === 1 ? 165 : 235} cy="57" r="17" fill="#f3d498"/>
      <path className="chapter-cloud" d="M40 66c-2-8 10-11 15-7 2-10 16-12 21-2 10-5 20 1 19 9Zm138-23c0-5 6-8 10-6 4-7 14-7 18 0 7-2 12 1 12 6Z" fill="#fffbed" opacity=".8"/>
      {chapter === 2 ? <>
        <path d="M0 121C26 102 38 63 67 62c22-1 40 28 60 17 29-15 35-52 63-52 36-1 57 63 81 50 19-12 34-6 49 19v54H0Z" fill="var(--scene-haze)"/>
        <path d="M0 132c38-3 55-56 87-51 27 3 35 43 64 34 26-8 43-50 68-49 36 0 48 44 101 52v42H0Z" fill="var(--scene-rock)" opacity=".74"/>
        <path d="M164 46q17-24 31-9l15 21-20-7-11 3Z" fill="#edf2e1" opacity=".9"/>
      </> : <>
        <path d="M0 122c26-8 39-38 62-38 30-1 42 35 74 22 38-15 56-46 91-35 28 8 44 37 93 41v45H0Z" fill="var(--scene-haze)"/>
        <path d="M0 139c43-33 66-22 105-12 43 11 65-23 104-24 42-2 75 23 111 35v31H0Z" fill="var(--scene-shade)" opacity=".55"/>
      </>}
      <path d="M0 149c41-25 76-15 115-21 66-11 126-4 205 23v124H0Z" fill={`url(#${id}-chapter-ground)`}/>
      <path d="M0 209c64-23 88-7 129 3 56 14 121-10 191 0v63H0Z" fill="var(--scene-sand)" opacity=".23"/>
      {chapter === 0 ? <CreekScene id={id}/> : chapter === 1 ? <WoodlandScene id={id}/> : <HighlandScene id={id}/>}
      <g fill="#fff1c2"><circle cx="90" cy="241" r="2.3"/><circle cx="226" cy="231" r="2"/><circle cx="73" cy="211" r="1.5"/></g>
    </g>
  </svg>;
}
