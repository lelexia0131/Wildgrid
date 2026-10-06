import type { FacilityKind, Shape, TerrainKind } from '../game/types';

export function Art({ kind, className = '' }: { kind: FacilityKind | TerrainKind; className?: string }) {
  return <svg className={`art ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {kind === 'water' && <><path d="M14 34C22 19 38 26 47 21C64 12 84 27 83 42C98 54 87 75 73 78C62 89 35 83 27 77C6 78 2 53 14 34Z" fill="#699d9f"/><path d="M15 32C28 20 37 30 48 24C65 17 84 30 81 43C92 57 78 74 65 72C50 83 38 73 26 74C10 70 7 46 15 32Z" fill="#98c7c5"/><path d="M26 42q9 5 18 0m8 17q10 5 21-1M26 62l7 1m23-29 10 2" stroke="#e1eece" strokeWidth="3" strokeLinecap="round"/><ellipse cx="14" cy="73" rx="7" ry="4" fill="#c8c5a5"/><path d="m83 67 1-12m0 7 5-5" stroke="#72916a" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'forest' && <><ellipse cx="50" cy="83" rx="35" ry="7" fill="#315a4620"/><path d="M30 60v22m41-25v23M50 54v33" stroke="#947c54" strokeWidth="7" strokeLinecap="round"/><path d="M29 22 10 54h9L9 69q21 7 41 0L40 54h8Z" fill="#638867"/><path d="M72 18 55 47h8L52 65q20 7 39 0L81 47h7Z" fill="#719775"/><path d="M49 8 28 44h9L21 72q29 9 56 0L62 44h10Z" fill="#396e54"/><path d="m49 8-1 67q14 2 29-3L62 44h10Z" fill="#2f604b"/><path d="m39 42 8 2m-14 18 14 3" stroke="#87a278" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'mountain' && <><ellipse cx="50" cy="82" rx="38" ry="7" fill="#315a4620"/><path d="m7 76 24-43 21 42Z" fill="#a7aa97"/><path d="M27 79 56 16 91 79q-31 10-64 0Z" fill="#a29e87"/><path d="m56 16-4 66q21 3 39-3Z" fill="#827f70"/><path d="m56 16-14 31 11-5 8 7 6-9Z" fill="#eeead8"/><path d="m56 16 5 33 6-9Z" fill="#d2d4c3"/><path d="m33 76 8-17" stroke="#bfc0a7" strokeWidth="3" strokeLinecap="round"/><path d="m75 81 4-8m-65 7 4-5" stroke="#788461" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'camp' && <><ellipse cx="50" cy="83" rx="40" ry="7" fill="#624c2420"/><path d="m9 77 38-57 44 57Z" fill="#d59a43"/><path d="m47 20 14 57h30Z" fill="#f2c56e"/><path d="m47 20-2 57H9Z" fill="#f7ce7c"/><path d="m46 43-21 34h39Z" fill="#4d6350"/><path d="m46 43-1 34h19Z" fill="#344f42"/><path d="m46 43-4 31H27Z" fill="#b37b39"/><path d="m47 20-5-7m5 7 5-7M9 77l-4 7m86-7 4 7" stroke="#8f7957" strokeWidth="3" strokeLinecap="round"/><path d="M8 80h84" stroke="#b8894c" strokeWidth="4" strokeLinecap="round"/><path d="m62 42 11 21" stroke="#ffe2a4" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'fire' && <><ellipse cx="50" cy="85" rx="35" ry="7" fill="#624c241c"/><path d="m27 76 47 9m-1-12L29 87" stroke="#80694d" strokeWidth="9" strokeLinecap="round"/><path d="M49 14c4 20 21 23 14 38 7-1 9-7 9-13 20 28 8 40-20 41-26 1-41-18-22-39-2 14 6 16 8 8 5-11 2-24 11-35Z" fill="#e98e4c"/><path d="M51 39c0 13 10 19 12 25 5-2 7-7 7-7 4 17-7 24-19 24-21 0-25-18-15-26-2 11 8 12 9 5Z" fill="#f6c764"/><path d="M50 63c-1 9-6 9-7 14 8 7 22 2 14-8-1 5-4 4-7-6Z" fill="#fff0b4"/><path d="m73 20 2-5M31 25l-2-5" stroke="#e3ac59" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'tower' && <><ellipse cx="50" cy="87" rx="33" ry="6" fill="#624c2420"/><path d="m35 47-8 39m38-39 8 39M33 61l36 19M66 60 30 80" stroke="#937650" strokeWidth="6" strokeLinecap="round"/><path d="M28 35h44v20H28Z" fill="#c5a36d"/><path d="M51 35h21v20H51Z" fill="#b18b59"/><path d="M32 35V24m36 11V24" stroke="#9b7b4f" strokeWidth="5"/><path d="m18 28 31-19 34 19Z" fill="#537b65"/><path d="m49 9 34 19H49Z" fill="#39644f"/><path d="M25 37h50M26 54h48" stroke="#e0c396" strokeWidth="4" strokeLinecap="round"/><path d="M36 38v14m14-14v14m14-14v14" stroke="#91714b" strokeWidth="3"/><path d="m49 63-3 22m12-22 3 22m-13-7h12m-11-8h9" stroke="#c7a874" strokeWidth="3"/></>}
  </svg>;
}

export function CampArt({ shape, rotation = 0 }: { shape: Shape; rotation?: number }) {
  if (shape === 'single') return <Art kind="camp"/>;
  const width = shape === 'long' ? 300 : 200, height = shape === 'el' ? 200 : 100;
  const turn = ((rotation % 4) + 4) % 4;
  const transforms = ['', `translate(${height} 0) rotate(90)`, `translate(${width} ${height}) rotate(180)`, `translate(0 ${width}) rotate(270)`];
  return <svg className="art camp-art" viewBox={`0 0 ${turn % 2 ? height : width} ${turn % 2 ? width : height}`} fill="none" aria-hidden="true">
    <g transform={transforms[turn]}>
      {shape === 'el' ? <>
        <path d="M18 16h64q10 0 10 10v85h89q11 0 11 11v56q0 11-11 11H18q-10 0-10-11V27q0-11 10-11Z" fill="#9b815e" opacity=".19"/>
        <path d="M20 20h60q7 0 7 8v91h93q7 0 7 8v50H14V28q0-8 6-8Z" fill="#d0b780"/>
        <path d="M25 29h50l7 94h92l12 47H23Z" fill="#e9b251"/>
        <path d="M50 29h25l7 94h92v25H50Z" fill="#f7d080"/>
        <path d="M23 170h163v10H23Z" fill="#bf8b45"/>
        <path d="M25 29h25v119h124l12 22H23Z" fill="#edba62"/>
        <path d="M50 29v119h124" stroke="#ffe2a0" strokeWidth="4" strokeLinejoin="round"/>
        <path d="M35 178V158q0-14 13-14t13 14v20Z" fill="#4c6351"/>
        <path d="M35 178V158q0-14 13-14v34Z" fill="#b17a3d"/>
        <path d="M48 149v26" stroke="#e6bf79" strokeWidth="2" strokeLinecap="round"/>
        <path d="m25 99 25 3 29-3m31 24-3 24 6 23" stroke="#ca963f" strokeWidth="2"/>
        <path d="M27 184h152M11 26l-5-5m80 7 6-6m-78 155-7 8m180-8 7 8" stroke="#9e7d4d" strokeWidth="3" strokeLinecap="round"/>
        <path d="m28 40-4 108m61 9h77" stroke="#f8d98e" strokeWidth="2" strokeLinecap="round"/>
      </> : <>
        <ellipse cx={width / 2} cy="83" rx={width / 2 - 9} ry="8" fill="#806844" opacity=".18"/>
        <rect x="9" y="26" width={width - 18} height="56" rx="8" fill="#cbb279"/>
        <path d={`M12 74 34 24H${width - 34}L${width - 12} 74Z`} fill="#d8a04a"/>
        <path d={`M34 24H${width - 34}L${width - 42} 74H42Z`} fill="#f4c66f"/>
        <path d={`M34 24H${width - 34}L${width - 38} 47H38Z`} fill="#ffdc8d"/>
        <path d="m12 74 22-50 8 50Z" fill="#e9b25b"/>
        <path d="M22 74V58q0-12 10-12t10 12v16Z" fill="#49604d"/>
        <path d="M22 74V58q0-12 10-12v28Z" fill="#aa773b"/>
        <path d="M32 51v20" stroke="#e8c487" strokeWidth="2" strokeLinecap="round"/>
        <path d={`m${width - 34} 24 22 50h-30Z`} fill="#c99041"/>
        {Array.from({ length: width / 100 - 1 }, (_, i) => <path key={i} d={`M${(i + 1) * 100} 25v22l4 27`} stroke="#d4a04a" strokeWidth="2.5"/>)}
        <path d={`M34 24H${width - 34}M9 79H${width - 9}`} stroke="#a9834d" strokeWidth="3" strokeLinecap="round"/>
        <path d={`M38 46H${width - 38}`} stroke="#f9db92" strokeWidth="2"/>
        <path d={`m12 74-7 9m${width - 17} -9 7 9M34 24l-3-9m${width - 65} 9 3-9`} stroke="#9f7f51" strokeWidth="3" strokeLinecap="round"/>
      </>}
    </g>
  </svg>;
}

export function Landscape({ miniature = false }: { miniature?: boolean }) {
  return <svg className={miniature ? 'landscape miniature' : 'landscape'} viewBox="0 0 800 620" fill="none" aria-hidden="true">
    <defs><linearGradient id="island" x1="180" y1="270" x2="660" y2="500" gradientUnits="userSpaceOnUse"><stop stopColor="#cbd5a4"/><stop offset="1" stopColor="#91b08a"/></linearGradient><linearGradient id="stream" x1="480" y1="250" x2="390" y2="480" gradientUnits="userSpaceOnUse"><stop stopColor="#b6d9cb"/><stop offset="1" stopColor="#79b4b0"/></linearGradient></defs>
    <circle cx="620" cy="130" r="48" fill="#efd69a" opacity=".75"/><path d="M77 161h83m-42-14h75m414 65h69" stroke="#fffdf1" strokeWidth="12" strokeLinecap="round"/>
    <ellipse cx="410" cy="502" rx="277" ry="38" fill="#426e4220"/>
    <path d="M110 331 398 180 705 339v48L421 549 111 379Z" fill="#7d9670"/><path d="m111 355 310 163 284-159v28L421 549 111 379Z" fill="#a5aa79"/>
    <path d="M110 330q12-23 33-26l238-129q21-12 42 0l263 143q31 15 7 37L437 507q-16 11-35 1L122 362q-28-14-12-32Z" fill="url(#island)"/>
    <g stroke="#799474" strokeWidth="1.5" opacity=".22"><path d="m162 291 315 170M214 263l315 169M266 235l315 169M318 207l315 169M171 388l291-162M226 417l291-162M281 446l291-162M336 475l291-162"/></g>
    <path d="M493 220c-78 48 13 64-51 99-48 27-82 12-77 47 5 24 59 29 42 54-10 15-41 35-62 47l58 32c65-37 94-71 64-103-26-29-36-32 10-52 71-31 6-67 66-96Z" fill="url(#stream)"/><path d="m413 349 24-8m-45 87 17-10m48-139 23-8" stroke="#e3edcf" strokeWidth="5" strokeLinecap="round"/>
    <svg x="293" y="107" width="162" height="162"><Art kind="mountain"/></svg>
    <svg x="180" y="183" width="155" height="155"><Art kind="forest"/></svg>
    <svg x="100" y="229" width="144" height="144"><Art kind="forest"/></svg>
    <svg x="543" y="246" width="144" height="144"><Art kind="forest"/></svg>
    <svg x="489" y="159" width="136" height="136"><Art kind="tower"/></svg>
    <svg x="254" y="261" width="167" height="167"><Art kind="camp"/></svg>
    <svg x="453" y="333" width="113" height="113"><Art kind="camp"/></svg>
    <svg x="339" y="350" width="76" height="76"><Art kind="fire"/></svg>
    <g stroke="#749569" strokeWidth="3" strokeLinecap="round"><path d="m221 378 2-8m2 8 5-5m306 32 2-8m2 8 5-5M349 251l2-8m2 8 5-5m-85 181 2-8m2 8 5-5"/></g>
    <g fill="#f1de9d"><circle cx="241" cy="391" r="4"/><circle cx="250" cy="387" r="3"/><circle cx="595" cy="342" r="4"/><circle cx="574" cy="364" r="3"/><circle cx="291" cy="454" r="4"/></g>
    <path d="m142 179 11 5 11-5m369-86 9 4 9-4" stroke="#758b73" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
