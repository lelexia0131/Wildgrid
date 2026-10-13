export interface SceneObjectProps {
  x: number;
  y: number;
  scale?: number;
  paintId: string;
}

export function ScenePaints({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}-canvas`} x1="0" y1="0" x2=".7" y2="1">
      <stop stopColor="#fff0bf"/><stop offset=".52" stopColor="#f4d293"/><stop offset="1" stopColor="#dcb175"/>
    </linearGradient>
    <linearGradient id={`${id}-canvas-side`} x1="0" y1="0" x2=".7" y2="1">
      <stop stopColor="#efcd92"/><stop offset="1" stopColor="#bb875b"/>
    </linearGradient>
    <linearGradient id={`${id}-wood`} x1="0" y1="0" x2=".8" y2="1">
      <stop stopColor="#c8a079"/><stop offset="1" stopColor="#8d674e"/>
    </linearGradient>
    <linearGradient id={`${id}-roof`} x1="0" y1="0" x2=".5" y2="1">
      <stop stopColor="#d6a077"/><stop offset="1" stopColor="#aa7257"/>
    </linearGradient>
    <linearGradient id={`${id}-water`} x1="0" y1="0" x2=".5" y2="1">
      <stop stopColor="#b4ddd8"/><stop offset=".5" stopColor="#8ac3c6"/><stop offset="1" stopColor="#69aab7"/>
    </linearGradient>
    <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2=".7" y2="1">
      <stop stopColor="var(--scene-leaf, #87aa7c)"/><stop offset="1" stopColor="var(--scene-deep, #4d7568)"/>
    </linearGradient>
    <linearGradient id={`${id}-fire`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#ffd78b"/><stop offset=".55" stopColor="#f3a15e"/><stop offset="1" stopColor="#d3754b"/>
    </linearGradient>
    <radialGradient id={`${id}-glow`}>
      <stop stopColor="#ffe4a1" stopOpacity=".65"/><stop offset="1" stopColor="#ffe4a1" stopOpacity="0"/>
    </radialGradient>
  </defs>;
}

export function Tent({ x, y, scale = 1, paintId, long = false, facing = 'right' }: SceneObjectProps & { long?: boolean; facing?: 'left' | 'right' }) {
  const ridgeX = long ? 39 : 23;
  const ridgeY = long ? -57 : -53;
  const backX = long ? 66 : 49;
  return <g transform={`translate(${x} ${y}) scale(${facing === 'left' ? -scale : scale} ${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx={long ? 8 : 0} cy="3" rx={long ? 58 : 49} ry="6" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d={`M-13-46 ${ridgeX} ${ridgeY} ${backX}-9 4 7Z`} fill={`url(#${paintId}-canvas-side)`} stroke="#ab7e52" strokeWidth=".7"/>
    <path d={`M-13-46 ${ridgeX} ${ridgeY} ${backX - 2}-11 4 5Z`} fill={`url(#${paintId}-canvas)`}/>
    <path d="M-46 0Q-32-27-13-46Q-1-20 4 7Z" fill="#f9dfaa" stroke="#bd9462" strokeWidth=".7"/>
    <path d="M-35 0Q-23-21-14-32L-4 5Z" fill="#695f4b"/>
    <path d="M-14-32Q-9-16-4 5L-16 2Q-10-12-14-32Z" fill="#bb9263"/>
    <path d="M-14-32Q-23-15-35 0L-28 1Q-16-11-14-32Z" fill="#e6bc7e"/>
    <path d="M-16 2-27 1-32 0" fill="none" stroke="#d6b780" strokeWidth="1.2"/>
    <path d={`M-10-43 ${ridgeX - 1} ${ridgeY + 4}M8 1Q${Math.round(backX / 2)}-4 ${backX - 5}-13`} fill="none" stroke="#fff2ce" strokeWidth="1.7" opacity=".8"/>
    <path d={`M${ridgeX - 2} ${ridgeY + 5}Q${ridgeX + 4}-29 ${backX - 7}-10`} fill="none" stroke="#d2a56e" strokeWidth=".85" opacity=".7"/>
    <path d="M-44 1-46 5M3 6 4 9" stroke="#8d795d" strokeWidth="1.8"/>
    <path d={`M${backX - 1}-8 ${backX}-4`} stroke="#8d795d" strokeWidth="1.8"/>
  </g>;
}

export function Tower({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="1" cy="3" rx="34" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d="M-14-51-22-2M15-51 24 1M-2-59-8-9M26-59 33-9" stroke="#7b654d" strokeWidth="5"/>
    <path d="M-14-47 20-8M16-47-19-7M-9-27 20-26M18-49 31-14M27-48 20-17" fill="none" stroke="#aa8460" strokeWidth="3"/>
    <path d="M-15-50-20-4M16-49 23-2" stroke="#cba37a" strokeWidth="1.2"/>
    <path d="M-28-59 21-64 35-55-14-49Z" fill="#d6b48a" stroke="#997752" strokeWidth=".8"/>
    <path d="M-28-59-14-49V-44L-28-53ZM-14-49 35-55V-50L-14-44Z" fill={`url(#${paintId}-wood)`}/>
    <path d="M-23-83V-61M17-87V-65M29-79V-57M-11-77V-51" stroke="#916e50" strokeWidth="3.4"/>
    <path d="M-23-72 17-76 29-68M-23-63 17-67M-11-64 29-69M-11-53 29-58M-11-65V-53M0-66V-55M10-67V-56M21-68V-57" fill="none" stroke="#c19a72" strokeWidth="2.5"/>
    <path d="M-30-82 1-97 35-83 18-78Z" fill="#e1ba8b"/>
    <path d="M-30-82 1-97-11-79-34-75Z" fill={`url(#${paintId}-roof)`}/>
    <path d="M1-97 35-83 36-78-11-74-11-79Z" fill="#bc8660" stroke="#a47355" strokeWidth=".7"/>
    <path d="M-29-81-10-77 32-82" fill="none" stroke="#efd4a5" strokeWidth="1.3"/>
    <path d="M-4-46-10 1M4-47-2 3M-5-38 3-39M-6-30 2-31M-7-22 1-23M-8-14 0-15M-9-6-1-7" stroke="#cfad81" strokeWidth="2"/>
  </g>;
}

export function Campfire({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="-6" rx="27" ry="15" fill={`url(#${paintId}-glow)`}/>
    <ellipse cy="3" rx="26" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <ellipse cy="-1" rx="22" ry="7" fill="#b5b2a0"/>
    <ellipse cy="-2" rx="17" ry="5" fill="#8f8875"/>
    <path d="M-14 0 13-8M-12-9 15 1" stroke="#755441" strokeWidth="7"/>
    <path d="M-14-2 11-9M-12-11 12-1" stroke="#b5895e" strokeWidth="2.2"/>
    <path d="M-10-8Q-23-18-12-29Q-12-21-6-22Q3-27 0-42Q20-29 12-18Q18-19 18-25Q28-9 7-6Z" fill={`url(#${paintId}-fire)`}/>
    <path d="M-5-7Q-12-15-4-23Q-3-16 2-16L5-28Q17-15 8-7Z" fill="#ffdfa0"/>
    <path d="M-1-7Q-3-12 2-18Q8-10 5-6Z" fill="#fff1bf"/>
    <path d="M-23-2-18-5M-20 4-14 3M-3 6 3 6M15 3 21 2M19-5 22-3" stroke="#d5d0bb" strokeWidth="3"/>
  </g>;
}

export function PicnicTable({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx="42" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d="M-20-25-27 1M-17-24-5 4M18-30 10-5M21-29 33-3" fill="none" stroke="#836449" strokeWidth="5"/>
    <path d="M-24-11-10-10M14-16 29-16" stroke="#b38c62" strokeWidth="3"/>
    <path d="M-40-12 25-19 42-11-23-3Z" fill="#e3bd88" stroke="#ba9469" strokeWidth=".7"/>
    <path d="M-40-12-23-3V1L-40-8ZM-23-3 42-11V-7L-23 1Z" fill={`url(#${paintId}-wood)`}/>
    <path d="M-31-22 21-28 34-22-17-15Z" fill="#bf966b"/>
    <path d="M-31-22-17-15V-12L-31-18ZM-17-15 34-22V-19L-17-12Z" fill="#9b7452"/>
    <path d="M-35-29 19-35 39-25-16-18Z" fill="#ebc694" stroke="#bb966b" strokeWidth=".7"/>
    <path d="M-35-29-16-18V-14L-35-25ZM-16-18 39-25V-21L-16-14Z" fill={`url(#${paintId}-wood)`}/>
    <path d="M-28-25 27-31M-22-22 33-28M-33-9 32-16" fill="none" stroke="#fff0c6" strokeWidth=".8" opacity=".75"/>
    <path d="M-29-1-30 5M32-7 33-2" stroke="#977554" strokeWidth="3"/>
  </g>;
}

export function Cabin({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx="46" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d="M-35-4 13 5 41-6V-12L12-3-35-12Z" fill="#b0ad97"/>
    <path d="M-35-43-11-63 13-36V-3L-35-12Z" fill="#dcb68c" stroke="#a58260" strokeWidth=".8"/>
    <path d="M13-36 41-48V-13L13-3Z" fill={`url(#${paintId}-wood)`} stroke="#997552" strokeWidth=".8"/>
    <path d="M-42-42-12-75 20-43 12-35Z" fill="#bb815f"/>
    <path d="M-12-75 19-75 46-51 20-43Z" fill={`url(#${paintId}-roof)`}/>
    <path d="M-42-42-39-38-12-67 12-35 20-43-12-75Z" fill="#f1d2a2"/>
    <path d="M20-43 46-51V-47L17-39Z" fill="#946548"/>
    <path d="M-30-37 7-30M-31-30 8-23M-31-23 8-16M17-28 37-35M17-20 37-27" stroke="#bc936b" strokeWidth="1" opacity=".7"/>
    <path d="M-23-33-9-30V-6L-23-9Z" fill="#876950" stroke="#f4d7a8" strokeWidth="2"/>
    <path d="M-20-30-12-28V-7" fill="none" stroke="#a48760" strokeWidth="1"/>
    <circle cx="-12" cy="-17" r="1.1" fill="#e1be80"/>
    <path d="M-3-32 7-30V-19L-3-21ZM22-34 34-39V-26L22-22Z" fill="#b9d9d0" stroke="#ecd0a5" strokeWidth="2"/>
    <path d="M2-31V-20M-3-26 7-24M28-36V-24M22-28 34-33" stroke="#ecd0a5" strokeWidth="1.3"/>
    <path d="M-28-6-6-2-2 2-27-2Z" fill="#d4c7ad"/>
    <path d="M-8-70 16-70 38-51" fill="none" stroke="#e1b184" strokeWidth="1.3"/>
  </g>;
}

export function FoodTruck({ x, y, scale = 1 }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx="49" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d="M-39-42Q-39-49-31-51L26-57Q34-58 38-51L43-20V-7L-37 0Z" fill="#e2b877" stroke="#b18b5d" strokeWidth=".8"/>
    <path d="M-40-42 30-49V-10L-40-2Z" fill="#f3dfa7"/>
    <path d="M30-49 44-40 46-12 30-5Z" fill="#cda46e"/>
    <path d="M-40-15 30-23V-10L-40-2Z" fill="#88a597"/>
    <path d="M30-23 46-22V-12L30-5Z" fill="#638677"/>
    <path d="M-39-42Q-43-52-32-54L25-60Q36-60 44-49L30-45Z" fill="#fff0c9" stroke="#c6a579" strokeWidth=".7"/>
    <path d="M-25-39 13-43V-25L-25-21Z" fill="#607d73" stroke="#d3b281" strokeWidth="1.8"/>
    <path d="M-21-35 9-38V-29L-21-26Z" fill="#aacbbf"/>
    <path d="M-6-38V-27" stroke="#d6b383" strokeWidth="1.5"/>
    <path d="M32-43 41-37 42-26 32-29Z" fill="#a5c6c0" stroke="#efe0b1" strokeWidth="1.8"/>
    <path d="M-29-44 15-49 25-38-36-31Z" fill="#f4e4b7" stroke="#c39c72" strokeWidth=".7"/>
    <path d="M-29-44-21-45-26-32-36-31ZM-12-46-4-47-6-34-17-33ZM6-48 15-49 25-38 15-37Z" fill="#cd8871"/>
    <path d="M-36-31 25-38V-34Q21-30 16-33Q11-28 5-31Q0-26-6-30Q-12-24-17-28Q-24-22-29-26Q-34-22-36-26Z" fill="#ecd9ac"/>
    <path d="M-29-22 19-27 21-22-29-16Z" fill="#bb936a"/>
    <path d="M-29-22 19-27" stroke="#fff1ca" strokeWidth="1.3"/>
    <ellipse cx="-25" cy="-1" rx="7" ry="8" fill="#57665f"/><ellipse cx="-24" cy="-1" rx="3.4" ry="4.3" fill="#d9d0b4"/>
    <ellipse cx="24" cy="-7" rx="7" ry="8" fill="#57665f"/><ellipse cx="25" cy="-7" rx="3.4" ry="4.3" fill="#d9d0b4"/>
    <path d="M-43-6-36-7M43-13 48-15" stroke="#e1caaa" strokeWidth="3"/>
    <path d="M-34-11-31-11M37-22 41-20" stroke="#f5d083" strokeWidth="2.7"/>
  </g>;
}

export function PowerTower({ x, y, scale = 1 }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx="36" ry="5" fill="var(--scene-shade, #55715f)" opacity=".2"/>
    <path d="M-30 0-17-4-13 2-27 6ZM19 0 32-3 35 3 21 7ZM-15-8-5-11-2-6-13-4ZM17-9 25-12 28-7 19-5Z" fill="#bec2ad"/>
    <path d="M-5-86-13-8M7-88 22-10" stroke="#6b8b82" strokeWidth="3.8"/>
    <path d="M-7-86-25 2M6-87 26 2M-6-85 6-87M-12-58 12-60M-18-31 18-33M-24-3 24-3" fill="none" stroke="#527a72" strokeWidth="4"/>
    <path d="M-6-83 12-61M6-85-12-60M-12-56 18-34M12-58-18-33M-18-29 25 0M18-31-25 0" fill="none" stroke="#78978a" strokeWidth="2.6"/>
    <path d="M-5-84-22 0M6-85 24 0" stroke="#bdcbb8" strokeWidth="1"/>
    <path d="M-26-84-5-92 26-89 29-84-26-79ZM-33-64-10-73 31-72 34-67-33-59Z" fill="#6c9187" stroke="#4f746c" strokeWidth=".8"/>
    <path d="M-23-84 24-88M-29-63 29-71" stroke="#b1c5b4" strokeWidth="1.5"/>
    <path d="M-6-93-2-104 4-105 8-93" fill="none" stroke="#64877c" strokeWidth="3"/>
    <path d="M-23-83V-73M24-88V-77M-29-63V-53M29-70V-59" stroke="#789082" strokeWidth="2"/>
    <path d="M-26-80H-20M-26-77H-20M-26-74H-20M21-84H27M21-81H27M21-78H27M-32-60H-26M-32-57H-26M-32-54H-26M26-66H32M26-63H32M26-60H32" stroke="#c8cdb8" strokeWidth="2.2"/>
  </g>;
}

export function Pool({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="5" rx="55" ry="7" fill="var(--scene-shade, #55715f)" opacity=".18"/>
    <path d="M-53-17Q-55-23-43-27L19-35Q28-36 34-31L52-20Q56-16 50-11L-16 5Q-23 7-30 3Z" fill="#faf0d4" stroke="#c8cab0" strokeWidth="1"/>
    <path d="M-53-17-30 3Q-23 7-16 5L50-11V-3L-15 12Q-24 14-31 8L-53-10Z" fill="#b4c7b7"/>
    <path d="M-53-17-30 3Q-23 7-16 5V12Q-24 14-31 8L-53-10Z" fill="#ced6bd"/>
    <path d="M-43-19Q-45-22-37-23L20-30Q25-31 30-28L42-19Q47-16 40-14L-16 0Q-22 2-28-2Z" fill="#6a9fa6"/>
    <path d="M-42-16-28-2Q-22 2-16 0L40-14Q43-15 43-17L30-25Q25-28 20-27L-35-20Z" fill={`url(#${paintId}-water)`}/>
    <path d="M-32-14Q-12-19 7-20M-9-7 13-12M20-16 32-18" fill="none" stroke="#e0f1e5" strokeWidth="1.6" opacity=".8"/>
    <path d="M-47-17-29-4Q-22 2-16 1L45-14" fill="none" stroke="#fff9e7" strokeWidth="1.5"/>
    <path d="M25-4V-17Q25-21 21-19L17-17M33-6V-20Q33-24 29-22L25-20M25-11 33-13M25-6 33-8" fill="none" stroke="#557f7b" strokeWidth="2.2"/>
    <path d="M25-18Q26-21 21-19M33-21Q34-24 29-22" fill="none" stroke="#e2e3cb" strokeWidth="1.1"/>
  </g>;
}

export function Tree({ x, y, scale = 1, paintId, variant = 'pine' }: SceneObjectProps & { variant?: 'pine' | 'round' }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cy="3" rx={variant === 'round' ? 24 : 19} ry="4" fill="var(--scene-shade, #55715f)" opacity=".16"/>
    <path d="M-3 0-3-35 2-39 4 1Z" fill="#95795a"/>
    <path d="M0-17-11-29M1-25 12-34" stroke="#95795a" strokeWidth="3"/>
    {variant === 'pine' ? <>
      <path d="M0-74Q-8-57-16-48L-9-49Q-17-35-23-30L-13-31Q-20-20-25-17Q-11-9 0-13Q12-9 25-18Q18-24 13-32L23-31Q16-39 9-49L16-48Q6-61 0-74Z" fill={`url(#${paintId}-leaf)`}/>
      <path d="M0-70Q-3-54-11-48L-5-49Q-8-36-17-30L-9-31Q-12-20-18-18Q-8-14-1-17Z" fill="var(--scene-leaf, #87aa7c)" opacity=".65"/>
      <path d="M-9-47Q-1-44 7-47M-14-30Q-3-26 12-30" fill="none" stroke="var(--scene-deep, #4d7568)" strokeWidth="1" opacity=".3"/>
    </> : <>
      <path d="M-20-25Q-34-30-28-44Q-28-57-13-59Q-4-74 11-63Q28-65 29-50Q36-38 23-28Q17-17 4-23Q-9-17-20-25Z" fill={`url(#${paintId}-leaf)`}/>
      <path d="M-25-42Q-26-54-13-54Q-6-64 5-60Q-2-53-2-44Q-13-48-25-42Z" fill="var(--scene-leaf, #87aa7c)" opacity=".8"/>
      <path d="M5-25Q16-22 24-32M-22-33Q-16-28-10-29" fill="none" stroke="var(--scene-deep, #4d7568)" strokeWidth="1.4" opacity=".25"/>
    </>}
    <path d="M0-11V-2" stroke="#c2a47a" strokeWidth="1"/>
  </g>;
}

export function Shrub({ x, y, scale = 1, paintId }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="2" rx="24" ry="3" fill="var(--scene-shade, #55715f)" opacity=".14"/>
    <path d="M-22 0Q-28-10-16-12Q-16-22-4-18Q4-26 12-17Q24-18 23-7Q29 3 14 3L-14 3Z" fill={`url(#${paintId}-leaf)`}/>
    <path d="M-17-7Q-16-14-9-11M-1-14Q6-19 11-12" fill="none" stroke="var(--scene-leaf, #87aa7c)" strokeWidth="2.6" strokeLinecap="round"/>
  </g>;
}

export function Rock({ x, y, scale = 1 }: SceneObjectProps) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
    <ellipse cy="2" rx="18" ry="3" fill="var(--scene-shade, #55715f)" opacity=".16"/>
    <path d="M-17-1-11-11 1-14 13-9 17 0 7 4-8 3Z" fill="#b6bcaa"/>
    <path d="M-11-11 1-14 13-9 2-6-15-3Z" fill="#d2d4bf"/>
    <path d="M2-6 13-9 17 0 7 4 4-1Z" fill="#929f94"/>
    <path d="M-9-9-2-10" fill="none" stroke="#e9e7d0" strokeWidth="1.4" strokeLinecap="round"/>
  </g>;
}
