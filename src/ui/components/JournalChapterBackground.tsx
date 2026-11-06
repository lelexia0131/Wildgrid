import { useId } from 'react';
import { art } from '../../assets/art';
import { SkyArt } from './Art';
import { CloudseaTree } from './ChapterArtwork';

export function JournalChapterBackground({ chapter }: { chapter: number }) {
  const id = `chapter-sky-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (chapter === 3) return <svg className="journal-chapter-background cloudsea-background" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-sky`} x2=".3" y2="1"><stop stopColor="#cbdfe0"/><stop offset=".55" stopColor="#f4edce"/><stop offset="1" stopColor="#e4e8d2"/></linearGradient>
      <linearGradient id={`${id}-ridge`} x2=".8" y2="1"><stop stopColor="#bdcebd"/><stop offset="1" stopColor="#759ba0"/></linearGradient>
      <linearGradient id={`${id}-cloud`} x2="0" y2="1"><stop stopColor="#fff9e5"/><stop offset="1" stopColor="#cbded8"/></linearGradient>
      <linearGradient id={`${id}-grass`} x2=".5" y2="1"><stop stopColor="#ced7ac"/><stop offset="1" stopColor="#86a08a"/></linearGradient>
      <linearGradient id={`${id}-leaf`} x2=".7" y2="1"><stop stopColor="#a4b995"/><stop offset="1" stopColor="#587f70"/></linearGradient><linearGradient id={`${id}-wood`} x2=".7" y2="1"><stop stopColor="#d0b485"/><stop offset="1" stopColor="#957b60"/></linearGradient>
      <radialGradient id={`${id}-sun`}><stop stopColor="#fff0bd" stopOpacity=".9"/><stop offset="1" stopColor="#fff0bd" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="1440" height="900" fill={`url(#${id}-sky)`}/>
    <circle cx="1150" cy="150" r="180" fill={`url(#${id}-sun)`}/><circle cx="1150" cy="150" r="57" fill="#fff2ca"/>
    <path d="M0 380 61 341 98 351 132 291Q151 263 173 283L219 326 252 312 300 252 331 265 382 191Q398 175 414 191L468 254 495 242 533 324 592 303 638 251Q670 221 697 251L750 290 781 278 837 321 890 282 944 221 968 231 1005 190Q1023 177 1046 202L1091 258 1112 251 1146 301 1218 262 1264 225Q1283 210 1301 227L1350 283 1380 276 1440 330V610H0Z" fill="#c0d4cd"/>
    <path d="M0 478 58 429 88 437 143 341Q160 320 178 339L224 397 248 389 279 422 338 365 369 381 442 280Q457 260 477 284L524 350 548 339 625 457 692 402 723 415 782 345Q800 325 818 347L863 389 889 381 957 431 1014 367 1047 378 1114 308Q1130 292 1147 310L1200 361 1231 354 1299 423 1366 376 1398 388 1440 354V665H0Z" fill={`url(#${id}-ridge)`}/>
    <path d="m153 312 31 94-59-37-55 55Zm303-70 65 151-58-42-36 31-34-62Zm340 69 41 108-45-43-43 42Zm333-34 51 121-53-39-37 44-27-45Z" fill="#e0e8d8" opacity=".7"/>
    <path d="M0 533q104-89 217-28t224-2 217 30 225-42 242 11 315-39v278H0Z" fill={`url(#${id}-cloud)`}/>
    <path d="M0 597q91-25 164 0t171-10 199 28 215-21 245 14 237-42 209 16" stroke="#fffbe9" strokeWidth="7" opacity=".7"/>
    <path d="M0 677q158-79 288-1t223-8 267 29 222-16 269-12 171-28v259H0Z" fill="#dce7d6"/>
    <path d="M0 639q153-61 255 45t194 78l139 138H0ZM1101 900q38-127 142-145t197-93v238Z" fill="#8faaa0"/>
    <path d="M0 618q154-57 259 47t190 78l139 157H0ZM1101 900q49-144 151-166t188-98v264Z" fill={`url(#${id}-grass)`}/>
    <path d="M0 733q149-14 248 66l79 101H179Q144 815 0 802Z" fill="#a9ceca"/><path d="M0 748q144-8 239 62m-116 12 57 20" stroke="#e9f1d9" strokeWidth="4" opacity=".7"/>
    <path d="M1180 900q49-89 161-98t99-41" stroke="#ede1bd" strokeWidth="19" strokeLinecap="round"/>
    {Array.from({length:22},(_,i)=><g key={`far-${i}`} opacity=".22"><CloudseaTree x={i*69-10} y={500+(i%4)*15} scale={.48+(i%3)*.13} paint={name=>`url(#${id}-${name})`}/></g>)}
    {[[-12,758,3.4],[86,823,2.4],[143,750,1.7],[1324,810,2.4],[1423,725,3.4],[1248,865,1.5]].map(([x,y,scale],i)=><CloudseaTree key={i} x={x} y={y} scale={scale} paint={name=>`url(#${id}-${name})`}/>)}
    <svg x="105" y="113" width="92" height="130" opacity=".7"><SkyArt kind="balloon"/></svg>
    <svg x="1276" y="337" width="130" height="65" opacity=".55"><SkyArt kind="airship"/></svg>
    <path d="M873 126q7-9 13-7t13 7m18 7q5-7 11-6t12 6M233 170q53-15 93-5m552 108q78 14 141-4" stroke="#739b98" strokeWidth="2" opacity=".35" strokeLinecap="round"/>
    <path d="m65 864 8-19m11 22 12-16m1182 20 8-23m10 19 12-12" stroke="#d3dbaa" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
  return <img className="journal-chapter-background" src={art.backgrounds.chapters[chapter]} alt="" draggable={false} aria-hidden="true"/>;
}
