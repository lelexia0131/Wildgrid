import { useId, type CSSProperties } from 'react';
import { Rock, Shrub, Tree } from './JournalSceneObjects';

type Point = [number, number, number];

function Grove({ id, points, round = false, opacity = 1 }: { id: string; points: Point[]; round?: boolean; opacity?: number }) {
  return <g opacity={opacity}>{points.map(([x, y, scale], index) => <Tree key={index} x={x} y={y} scale={scale} variant={round ? 'round' : 'pine'} paintId={id}/>)}</g>;
}

function Grass({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="var(--scene-leaf)" opacity=".55">
    <path d="M-3 1Q-8-17-18-19Q-8-5-6 2ZM-1 2Q-4-28 3-31Q0-10 3 2ZM5 2Q9-20 20-23Q10-7 9 3Z"/>
    <path d="M-8 3q-9-11-17-9 10 4 13 11Zm19 0q9-12 18-8-10 4-14 11Z" opacity=".65"/>
  </g>;
}

function CreekLandscape({ id }: { id: string }) {
  return <>
    <path d="M0 212c51-17 71-64 123-65 33-1 61 17 92 8 45-13 65-59 111-61 48-2 77 46 117 45 62-2 77-61 130-60 53 1 64 54 119 57 41 2 87-45 127-39 50 8 63 69 107 75 57 8 91-45 147-28 43 12 70 40 127 47v126H0Z" fill="#d4e3dc"/>
    <path d="M0 236c70-35 116-30 174-13 55 15 86-9 138-18 56-11 110 12 159 7 67-6 87-30 142-28 88 3 94 44 188 27 86-16 145-13 209 11 71 26 129-2 190 15v130H0Z" fill="#c3d7c2" opacity=".7"/>
    <Grove id={id} round opacity={.38} points={[[40, 247, .82], [109, 231, .73], [173, 242, .69], [225, 226, .6], [281, 231, .76], [360, 218, .61], [429, 224, .66], [714, 221, .65], [764, 230, .72], [1004, 246, .9], [1069, 255, .83], [1145, 243, 1.02]]}/>
    <path d="M0 268c86-36 178-15 257-23 116-12 202-28 300-4 127 31 170-13 268-5 91 8 139 38 211 21 66-16 111-8 164 15v528H0Z" fill={`url(#${id}-land)`}/>
    <path d="M0 397c79-50 142-35 194-61 58-29 120-11 162 17 58 39 113 9 165 31 36 15 41 45 84 68-162-10-250 36-366 34-107-3-161 5-239 27Z" fill="#cfdfbe" opacity=".7"/>
    <path d="M790 229c56 18 126 26 154 61 24 31-13 51-12 70 1 25 96 30 91 68-5 42-96 48-133 74-43 30-3 56 21 78 47 44-18 72-80 100-65 29-90 63-9 120H624c-57-66-24-114 58-150 77-33 104-41 90-62-31-45-48-78-9-120 39-42 143-49 141-71-1-23-74-21-80-58-5-29 36-48 29-67-8-22-49-49-70-61Z" fill="#e9e4c6"/>
    <path d="M810 231c44 21 98 29 115 60 20 34-19 48-17 70 3 29 93 31 93 67 0 30-87 43-121 67-45 32-14 60 16 87 39 36-30 62-81 86-73 33-107 72-33 132H652c-58-62-28-109 62-146 61-25 107-44 88-71-38-41-45-73-13-105 45-43 137-46 137-64 0-22-70-25-76-54-5-27 36-44 30-66-6-23-50-48-72-61Z" fill={`url(#${id}-water)`}/>
    <path d="M953 342c-23 7-28 18-21 26 13 15 45 16 62 27l-21-4c-27-3-43-14-48-25-5-8 4-21 28-24Zm-98 134c-24 13-44 33-35 55l-18 9c-16-28 9-53 37-62Z" fill="#bad2b4" opacity=".8"/>
    <path d="M928 309q-13 4-22 2m27 68q20 11 41 11m-133 100q-16 8-20 20m16 117q-31 10-46 23m-54 76q-11 12-9 26m56 36q-9-20-22-26" fill="none" stroke="#f4faf0" strokeWidth="4" strokeLinecap="round" opacity=".75"/>
    <path d="M0 622c100-29 156-9 220-33 67-25 116-12 183 19 54 24 97 25 158 10 42-10 73-1 100 16-35 10-74 31-83 66-9 35 16 64 34 100H0Z" fill="#bfd7b2" opacity=".65"/>
    <Grove id={id} round opacity={.62} points={[[26, 470, 1.8], [116, 461, 1.35], [179, 421, 1.04], [1095, 402, 1.56], [1180, 428, 1.98]]}/>
    <Grove id={id} opacity={.48} points={[[261, 375, .81], [1062, 272, .7], [1133, 290, .76]]}/>
    <g opacity=".7">{[[954, 390, .94], [971, 407, .63], [882, 481, 1.18], [814, 538, .7], [733, 689, 1.25], [618, 761, 1.85], [917, 644, 1.09], [1101, 605, 1.56]].map(([x, y, scale], index) => <Rock key={index} x={x} y={y} scale={scale} paintId={id}/>)}</g>
    <g opacity=".65"><Shrub x={88} y={650} scale={2.4} paintId={id}/><Shrub x={246} y={738} scale={1.85} paintId={id}/><Shrub x={988} y={675} scale={1.8} paintId={id}/><Shrub x={1181} y={718} scale={3.1} paintId={id}/></g>
    <path d="M962 409q0-37-10-51m15 49q1-28 11-45m-12 33 11-12M819 558q1-33-12-49m15 50q4-31 13-39m-13 17-11-10" fill="none" stroke="#99b59b" strokeWidth="3" strokeLinecap="round"/>
    <Grass x={141} y={718} scale={1.35}/><Grass x={362} y={758} scale={1.6}/><Grass x={528} y={728} scale={1.1}/><Grass x={994} y={748} scale={1.8}/><Grass x={1145} y={567} scale={1.2}/>
    <g fill="#f5e8b2" opacity=".8"><circle cx="345" cy="744" r="4"/><circle cx="522" cy="714" r="3"/><circle cx="166" cy="637" r="3"/><circle cx="1002" cy="718" r="4"/></g>
  </>;
}

function WoodlandLandscape({ id }: { id: string }) {
  return <>
    <path d="M0 204c75-51 118-36 168-47 55-13 96-53 159-49 74 5 91 55 157 52 69-4 104-37 166-31 70 6 98 45 163 34 49-9 73-35 128-31 84 6 122 50 188 45 26-2 49-3 71 3v620H0Z" fill="#d5dfc3"/>
    <path d="M0 252c16-18 30-14 39-29 13-21 32-17 46-22 22-8 34-1 47-8 21-10 37 4 56-1 22-7 28 11 48 6 22-7 25 18 48 8 21-9 38 4 53 10 18 7 25-2 43 10 35-21 64 4 96-8 30-11 63 7 82 0 25-9 44 6 63 2 25-6 53 11 76 1 24-9 48 3 64 14 31-25 51-10 79-20 23-8 47 2 65-1 28-6 39 17 63 5 20-11 46 0 61 10 24-13 39-7 64 4 37-16 61 4 97-5 27-7 49 15 80 5v165H0Z" fill="#b9ccb1" opacity=".7"/>
    <Grove id={id} opacity={.5} points={[[22, 282, 1.16], [99, 249, 1.02], [167, 250, .93], [236, 266, 1.15], [321, 257, .8], [391, 264, .93], [753, 264, .92], [812, 250, .89], [875, 267, 1.12], [954, 277, 1.07], [1041, 252, 1.04], [1118, 277, 1.25], [1200, 268, 1.1]]}/>
    <path d="M0 332c96-44 190-36 282-15 107 25 123-56 248-58 90-3 137 57 229 66 159 16 269-59 441-4v479H0Z" fill={`url(#${id}-land)`}/>
    <path d="M587 270c-35 42-66 53-40 85 24 29 91 32 77 67-15 39-104 60-82 97 24 42 111 62 78 105-32 42-116 79-123 176h133c-6-67 45-121 86-166 53-59-47-95-79-130-25-29 62-40 72-79 10-45-75-60-97-90-14-19 1-42-10-65Z" fill="#e9dfbb"/>
    <path d="M584 289c-16 35-45 45-20 68m26 198c24 15 60 27 70 44m-95 128c-20 23-24 34-27 47" fill="none" stroke="#f6efd7" strokeWidth="5" strokeLinecap="round" opacity=".7"/>
    <path d="M1200 389c-72-23-131-9-168 11-42 21-33 38-71 49-55 16-93 33-100 73-8 42 32 56 41 91 12 48 80 67 159 57 65-8 108-35 139-31Z" fill="#d8ddbc"/>
    <path d="M1200 405c-72-26-127-6-159 16-35 24-43 32-85 43-49 13-79 32-83 61-5 33 33 50 39 81 8 37 71 52 139 40 57-10 94-32 149-25Z" fill={`url(#${id}-water)`}/>
    <path d="M1037 431c23-9 62-16 96-8l-24 13-25 6-47 11Zm-90 86c24-17 72-15 103-6l-14 16-70 1Z" fill="#bad4c4" opacity=".6"/>
    <path d="M1056 453q42-10 75-2m-171 73q28 2 52-3m25 83q45 9 86-3" fill="none" stroke="#f1f6e8" strokeWidth="4" strokeLinecap="round" opacity=".7"/>
    <path d="M0 508c86-37 125-14 190-2 62 12 81-6 139 25 45 23 43 64 103 77-105-12-168 38-256 31-72-6-122 18-176 14Zm1200 187c-63-20-143 22-190 3-57-23-59-66-97-72-47-7-87 50-122 80-19 17-33 55-31 94h440Z" fill="#b8cfa7" opacity=".55"/>
    <Grove id={id} round opacity={.72} points={[[4, 504, 2.35], [125, 431, 1.62], [229, 379, 1.36], [995, 371, 1.5], [1100, 402, 1.84], [1201, 506, 2.43]]}/>
    <Grove id={id} opacity={.64} points={[[75, 514, 1.84], [290, 376, 1.13], [936, 409, 1.36], [1160, 514, 2.02]]}/>
    <g fill="#789b73" opacity=".13"><ellipse cx="136" cy="533" rx="158" ry="29" transform="rotate(21 136 533)"/><ellipse cx="1066" cy="515" rx="135" ry="24" transform="rotate(-29 1066 515)"/><ellipse cx="276" cy="694" rx="123" ry="22" transform="rotate(28 276 694)"/></g>
    <Grove id={id} round opacity={.75} points={[[36, 789, 3.7], [1186, 802, 4.05]]}/>
    <Grove id={id} opacity={.68} points={[[152, 743, 2.07], [1105, 773, 2.12]]}/>
    <g opacity=".73"><Shrub x={244} y={746} scale={2.5} paintId={id}/><Shrub x={941} y={690} scale={2.16} paintId={id}/><Shrub x={862} y={781} scale={2.4} paintId={id}/><Rock x={435} y={713} scale={1.76} paintId={id}/><Rock x={918} y={569} scale={1.14} paintId={id}/><Rock x={979} y={669} scale={1.67} paintId={id}/></g>
    <Grass x={302} y={718} scale={1.45}/><Grass x={407} y={765} scale={1.3}/><Grass x={730} y={756} scale={1.27}/><Grass x={898} y={638} scale={1.2}/><Grass x={1018} y={722} scale={1.7}/>
    <g fill="#eddfa4" opacity=".8"><circle cx="294" cy="701" r="3.7"/><circle cx="753" cy="749" r="3.2"/><circle cx="840" cy="719" r="3.5"/></g>
  </>;
}

function HighlandLandscape({ id }: { id: string }) {
  const lake = 'M1058 390c45-16 91-13 142 8v402H615c31-59 54-98 104-126 28-16 52-29 70-50 24-28 39-20 54-50 17-31 55-34 55-70 0-20 58-49 67-70 16-33 60-32 93-44Z';
  return <>
    <path d="M0 224 67 193l42-35 40 10 48-38 42 8 64-62q12-10 25 0l35 37 36-9 47 58 41-11 61 47 53 5 48-42 43 8 58-45 43 2 42-60q10-14 23-6l63 48 42-9 53 53 45-6 67 36 37-5v159H0Z" fill="#d4e1dd"/>
    <path d="M0 313 47 263 92 268 130 215 159 226 210 150q7-11 20-5l44 29 35-9 54 50 30-12 72 88 49 2 59-56 43 7 47-64 33 12 65-87q9-9 17-4l38 20 32-8 74 77 36-4 42 45 75 15 58-27 61 5v164H0Z" fill="#bdcfca"/>
    <path d="m188 225 60-77 45 28-26-4-33 31-10-11-17 33Zm538-17 65-85 35 25-18-3-20 11-19-9-24 38Z" fill="#edf1e1" opacity=".67"/>
    <path d="M0 373c25-41 57-31 89-71l27-8 34-49 30 14 54-31 33 12 51-44q8-8 20 1l39 32 42-8 64 67 31-5 71 58-48 88H0Z" fill="#b3c8bd"/>
    <path d="m151 245 12 61-21 33-7 39h56l-12-47 27-32 28-71-54 31Zm173-49-19 74-52 67 61-16 11-25 39 15 26-12-55-75Z" fill="#ced8c7" opacity=".7"/>
    <path d="M1200 279c-61-12-79 22-130 15-34-4-46-40-82-40-35 1-59 30-96 44-34 12-62-3-86 22-20 21-32 54-67 57l48 90h413Z" fill="#b9cfc0"/>
    <Grove id={id} opacity={.5} points={[[26, 412, 1.4], [109, 397, 1.15], [190, 403, 1.2], [274, 391, 1.02], [353, 367, .81], [421, 374, .8], [829, 366, .91], [892, 347, .83], [961, 337, .92], [1038, 345, 1.05], [1115, 331, 1.14], [1194, 350, 1.2]]}/>
    <path d="M0 461c92-38 163-24 222-48 82-32 128-21 195-39 52-14 104-13 154 4 68 22 120 16 178-17 58-34 121-20 175 1 110 43 192 18 276 43v395H0Z" fill={`url(#${id}-land)`}/>
    <path d="M547 377c-28 16-56 29-76 62-15 26-35 35-28 58 11 34 79 45 64 78-12 26-65 28-104 53-41 25-52 53-24 84 19 22 37 53 45 88h116c-15-63-63-94-63-121 0-23 38-30 68-44 78-37 71-73 40-107-20-22-66-43-61-58 9-25 45-24 41-57-3-20-10-23-18-36Z" fill="#e6dfc2"/>
    <path d="M1083 373c-54 5-107 36-122 56-16 22-71 39-82 68-15 43-56 35-71 60-21 34-38 38-66 62-72 65-125 89-161 181h619V382Z" fill="#cad6bf"/>
    <defs><clipPath id={`${id}-lake-clip`}><path d={lake}/></clipPath></defs>
    <path d={lake} fill={`url(#${id}-water)`}/>
    <g clipPath={`url(#${id}-lake-clip)`} opacity=".4">
      <path d="m1099 391 27 45-49 72-30-6-46 46-29-9-36 36-51-16 38-32 57-9 11-36 59-25Z" fill="#b3cdc5"/>
      <path d="M925 599c89 12 149-36 275-16v46c-100-11-178 33-275 20Z" fill="#deeee2"/>
      <path d="M774 746c76-55 186-32 279-68 51-20 99-10 147-5v38c-111-5-213 48-289 35-41-7-91 21-137 18Z" fill="#c6e0d9"/>
    </g>
    <path d="M979 459q43-27 77-28m-144 99q25-8 46-7m-146 111q39-14 72-12m71 54q50-11 95-5m-306 83q34-9 66-8m177 30q44-12 94-6" fill="none" stroke="#f2f7ed" strokeWidth="4" strokeLinecap="round" opacity=".7"/>
    <path d="M0 635c101-22 134-3 194 19 65 24 120 8 147 47-24 37-26 65 0 99H0Zm1200 94c-24-12-49-28-78-19-24 7-23 28-42 37-28 14-47 24-52 53h172Z" fill="#bfd0b3"/>
    <Grove id={id} opacity={.66} points={[[22, 652, 2.65], [121, 608, 1.83], [222, 535, 1.21], [1142, 622, 2.09], [1212, 660, 2.6]]}/>
    <g opacity=".8"><Rock x={143} y={715} scale={2.82} paintId={id}/><Rock x={210} y={726} scale={1.89} paintId={id}/><Rock x={77} y={575} scale={1.43} paintId={id}/><Rock x={816} y={598} scale={1.73} paintId={id}/><Rock x={890} y={512} scale={1.38} paintId={id}/><Rock x={1108} y={741} scale={2.38} paintId={id}/><Rock x={1174} y={763} scale={1.59} paintId={id}/></g>
    <Grove id={id} opacity={.76} points={[[15, 808, 3.52], [1204, 811, 3.65]]}/>
    <g opacity=".68"><Shrub x={282} y={772} scale={2.2} paintId={id}/><Shrub x={1007} y={781} scale={2.4} paintId={id}/><Shrub x={100} y={793} scale={2.54} paintId={id}/></g>
    <Grass x={300} y={719} scale={1.24}/><Grass x={596} y={761} scale={1.4}/><Grass x={704} y={665} scale={1.06}/><Grass x={1064} y={737} scale={1.58}/>
  </>;
}

export function JournalChapterBackground({ chapter }: { chapter: number }) {
  const id = useId().replace(/:/g, '');
  const woodland = chapter === 1, highland = chapter === 2;
  const style = { '--scene-leaf': woodland ? '#a0b38b' : highland ? '#98b1a0' : '#abc296', '--scene-deep': woodland ? '#779879' : highland ? '#78988c' : '#85a887', '--scene-shade': '#6b8b79' } as CSSProperties;
  return <svg className="journal-chapter-background" style={style} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={woodland ? '#faf4df' : highland ? '#eff5ed' : '#f7f6e6'}/><stop offset="1" stopColor={woodland ? '#e4ecd6' : '#dcece6'}/></linearGradient>
      <linearGradient id={`${id}-land`} x1="0" y1="0" x2=".2" y2="1"><stop stopColor={woodland ? '#dde5c6' : highland ? '#d8e1cf' : '#dce7c8'}/><stop offset=".55" stopColor={woodland ? '#d9e2c3' : '#d3e1c6'}/><stop offset="1" stopColor={woodland ? '#c4d4ad' : '#c8d9bd'}/></linearGradient>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#d3e9e1"/><stop offset=".6" stopColor="#badbd7"/><stop offset="1" stopColor="#a9ced0"/></linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="var(--scene-leaf)"/><stop offset="1" stopColor="var(--scene-deep)"/></linearGradient>
      <radialGradient id={`${id}-sunlight`}><stop stopColor="#fff4cf" stopOpacity=".85"/><stop offset="1" stopColor="#fff4cf" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-clearing`}><stop stopColor="#fbf5e5" stopOpacity=".28"/><stop offset=".7" stopColor="#fbf5e5" stopOpacity=".13"/><stop offset="1" stopColor="#fbf5e5" stopOpacity="0"/></radialGradient>
    </defs>
    <path d="M0 0h1200v800H0Z" fill={`url(#${id}-sky)`}/>
    <ellipse cx={woodland ? 432 : 909} cy="88" rx="180" ry="130" fill={`url(#${id}-sunlight)`}/>
    <circle cx={woodland ? 432 : 909} cy="86" r={highland ? 26 : 34} fill="#fcf0cd" opacity=".75"/>
    <path d="M43 80c-2-13 17-21 30-15 4-17 31-24 42-6 17-6 36 6 35 21Zm797-25c2-11 15-16 26-10 8-14 28-11 32 0 16-4 28 4 28 10Z" fill="#fffdf1" opacity=".7"/>
    {woodland ? <WoodlandLandscape id={id}/> : highland ? <HighlandLandscape id={id}/> : <CreekLandscape id={id}/>}
    <ellipse cx="601" cy="393" rx="435" ry="291" fill={`url(#${id}-clearing)`}/>
  </svg>;
}
