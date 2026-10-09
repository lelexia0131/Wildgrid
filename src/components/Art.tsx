import { useId } from 'react';
import { offsets } from '../game/rules';
import type { FacilityKind, Shape, TerrainKind } from '../game/types';

export function FootprintSurface({ shape, rotation }: { shape: Shape; rotation: number }) {
  const cells = offsets(shape, rotation);
  const width = (Math.max(...cells.map(p => p.c)) + 1) * 100, height = (Math.max(...cells.map(p => p.r)) + 1) * 100;
  const has = (r: number, c: number) => cells.some(p => p.r === r && p.c === c);
  const fill = cells.map(p => `M${p.c * 100} ${p.r * 100}h100v100h-100Z`).join('');
  const outline = cells.map(({r,c}) => [
    !has(r-1,c) ? `M${c*100} ${r*100}h100` : '', !has(r+1,c) ? `M${c*100} ${(r+1)*100}h100` : '',
    !has(r,c-1) ? `M${c*100} ${r*100}v100` : '', !has(r,c+1) ? `M${(c+1)*100} ${r*100}v100` : '',
  ].join('')).join('');
  return <svg className="facility-footprint" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><path className="footprint-fill" d={fill}/><path className="footprint-outline" d={outline} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></svg>;
}

function FootprintArt({ shape, rotation, children }: { shape: Shape; rotation: number; children: React.ReactNode }) {
  const clip = useId(), cells = offsets(shape, rotation);
  const width = (Math.max(...cells.map(p => p.c)) + 1) * 100, height = (Math.max(...cells.map(p => p.r)) + 1) * 100;
  return <svg className="art footprint-art" viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
    <defs><clipPath id={clip}>{cells.map(p => <rect key={`${p.r},${p.c}`} x={p.c * 100} y={p.r * 100} width="100" height="100"/>)}</clipPath></defs>
    <g clipPath={`url(#${clip})`}>{children}</g>
  </svg>;
}

type Point = { x: number; y: number };
// Trace the occupied outline, then inset the roof for a fixed view from above.
function roofOutline(shape: Shape, rotation: number): Point[] {
  const cells = offsets(shape, rotation), edges: [Point, Point][] = [];
  const has = (r: number, c: number) => cells.some(p => p.r === r && p.c === c);
  for (const {r,c} of cells) {
    const x = c * 100, y = r * 100;
    if (!has(r-1,c)) edges.push([{x,y},{x:x+100,y}]);
    if (!has(r,c+1)) edges.push([{x:x+100,y},{x:x+100,y:y+100}]);
    if (!has(r+1,c)) edges.push([{x:x+100,y:y+100},{x,y:y+100}]);
    if (!has(r,c-1)) edges.push([{x,y:y+100},{x,y}]);
  }
  const points = [edges[0][0]];
  let end = edges[0][1];
  while (end.x !== points[0].x || end.y !== points[0].y) {
    points.push(end);
    end = edges.find(([start]) => start.x === end.x && start.y === end.y)![1];
  }
  const corners = points.filter((p,i) => {
    const prev = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
    return (p.x-prev.x)*(next.y-p.y) !== (p.y-prev.y)*(next.x-p.x);
  });
  const inset = (a: Point, b: Point) => {
    const x = Math.sign(a.y-b.y), y = Math.sign(b.x-a.x), distance = y > 0 ? 16 : y < 0 ? 30 : 10;
    return {x:x*distance,y:y*distance};
  };
  return corners.map((p,i) => {
    const a = inset(corners[(i+corners.length-1)%corners.length],p), b = inset(p,corners[(i+1)%corners.length]);
    return {x:p.x+a.x+b.x,y:p.y+a.y+b.y};
  });
}

function BuildingArt({ kind, shape, rotation }: { kind: 'camp' | 'cabin'; shape: Shape; rotation: number }) {
  const gradient = useId(), points = roofOutline(shape, rotation), cells = offsets(shape, rotation);
  const roof = `M${points.map(p=>`${p.x} ${p.y}`).join('L')}Z`;
  const edges = points.map((p,i)=>({p,q:points[(i+1)%points.length]}));
  const fronts = edges.filter(({p,q})=>q.x<p.x).map(({p,q})=>({x:q.x,y:q.y,width:p.x-q.x}));
  const front = [...fronts].sort((a,b)=>b.y-a.y || b.width-a.width)[0];
  const doorX = front.x + (front.width > 120 ? 40 : front.width / 2), doorY = front.y;
  const camp = kind === 'camp';
  const ridge = cells.flatMap(p=>cells.filter(q=>q.r===p.r && q.c===p.c+1 || q.c===p.c && q.r===p.r+1).map(q=>`M${p.c*100+50} ${p.r*100+42}L${q.c*100+50} ${q.r*100+42}`)).join('');
  const chimney = [...cells].sort((a,b)=>a.r-b.r || a.c-b.c)[0];
  return <FootprintArt shape={shape} rotation={rotation}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor={camp ? '#ffdc8d' : '#7e9b78'}/><stop offset="1" stopColor={camp ? '#e2ab50' : '#456e56'}/></linearGradient></defs>
    <path d={`M${points.map(p=>`${p.x+4} ${p.y+21}`).join('L')}Z`} fill="#624c2420"/>
    {edges.filter(({p,q})=>q.y>p.y).map(({p,q},i)=><path key={i} d={`M${p.x} ${p.y}L${q.x} ${q.y}l8 12L${p.x+8} ${p.y+12}Z`} fill={camp ? '#bf8b45' : '#9f754f'}/>)}
    {fronts.map((f,i)=><g key={i}><rect x={f.x} y={f.y} width={f.width} height="20" fill={camp ? '#d2a05a' : '#c59865'}/>{!camp && <path d={`M${f.x+4} ${f.y+7}h${f.width-8}m-${f.width-8} 7h${f.width-8}`} stroke="#af804e" strokeWidth="2"/>}</g>)}
    <path className="roof-plane" d={roof} fill={`url(#${gradient})`} stroke={camp ? '#b58a4b' : '#42654e'} strokeWidth="3" strokeLinejoin="round"/>
    <path d={ridge} stroke={camp ? '#ffe6aa' : '#a4b891'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    {camp ? <>
      <path d={`M${doorX} ${doorY-28}l-34 48h68Z`} fill="#e9b25b"/>
      <path className="building-door" d={`M${doorX} ${doorY-7}l-15 27h30Z`} fill="#49604d"/>
      <path d={`M${doorX} ${doorY-7}v27h-15Z`} fill="#b17a3d"/>
      <path d={`M${doorX-32} ${doorY+21}l-5 6m69-6 5 6`} stroke="#9f7f51" strokeWidth="3" strokeLinecap="round"/>
    </> : <>
      <rect className="building-door" x={doorX-10} y={doorY-6} width="20" height="26" rx="2" fill="#53654e"/>
      <circle cx={doorX+6} cy={doorY+9} r="2" fill="#e8c783"/>
      {front.width>120 && <><rect x={front.x+front.width-55} y={doorY+3} width="25" height="13" fill="#f5d795"/><path d={`M${front.x+front.width-43} ${doorY+3}v13`} stroke="#ead3a6" strokeWidth="2"/></>}
      <rect x={chimney.c*100+60} y={chimney.r*100+27} width="12" height="24" fill="#9b9382"/><path d={`M${chimney.c*100+58} ${chimney.r*100+27}h16v6h-16Z`} fill="#b6af9c"/>
      <path d={`M${doorX-16} ${doorY+24}h32`} stroke="#d6b789" strokeWidth="4" strokeLinecap="round"/>
    </>}
  </FootprintArt>;
}

function PicnicArt({ shape, rotation }: { shape: Shape; rotation: number }) {
  const cells = offsets(shape, rotation), horizontal = Math.max(...cells.map(p=>p.c))>0;
  const table = horizontal ? {x:13,y:22,w:174,h:23} : {x:32,y:20,w:36,h:146};
  const benches = horizontal ? [{x:20,y:12,w:160,h:9},{x:8,y:64,w:184,h:9}] : [{x:7,y:26,w:17,h:141},{x:76,y:26,w:17,h:141}];
  const supports = horizontal ? [46,153].flatMap(x=>[{x,y:39},{x:x+12,y:39}]) : [44,154].flatMap(y=>[{x:38,y},{x:62,y}]);
  const cup = {x:table.x+table.w*.3,y:table.y+table.h*.3};
  const plate = {x:table.x+table.w*.7,y:table.y+table.h*.7};
  return <FootprintArt shape={shape} rotation={rotation}>
    <ellipse cx={horizontal ? 100 : 50} cy={horizontal ? 87 : 191} rx={horizontal ? 91 : 43} ry="7" fill="#624c2420"/>
    <path className="picnic-legs" d={supports.map((p,i)=>`M${p.x} ${p.y}l${i%2 ? 8 : -8} ${horizontal ? 44 : 34}`).join('')} stroke="#836547" strokeWidth="6" strokeLinecap="round"/>
    {benches.map((b,i)=><g key={i}><path d={horizontal ? `M${b.x+20} ${b.y+5}v20m${b.w-40}-20v20` : `M${b.x+8} ${b.y+20}v20m0 ${b.h-52}v20`} stroke="#836547" strokeWidth="5" strokeLinecap="round"/><rect x={b.x} y={b.y+6} width={b.w} height={b.h} rx="2" fill="#b48a53"/><rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill="#e3bd7e"/></g>)}
    <rect x={table.x} y={table.y+8} width={table.w} height={table.h} rx="2" fill="#bd9057"/>
    <path className="roof-plane" d={`M${table.x} ${table.y+8}l8-8h${table.w-16}l8 8v${table.h-8}h-${table.w}Z`} fill="#ebc78d"/>
    <path d={horizontal ? `M${table.x+12} ${table.y+12}h${table.w-24}` : `M${table.x+12} ${table.y+12}v${table.h-22}`} stroke="#f4dba7" strokeWidth="3" strokeLinecap="round"/>
    <rect x={cup.x-4} y={cup.y-7} width="8" height="10" rx="1" fill="#7b9f88"/><ellipse cx={plate.x} cy={plate.y} rx="7" ry="4" fill="#f4e6c4"/><circle cx={plate.x} cy={plate.y-2} r="4" fill="#d38d60"/>
  </FootprintArt>;
}

function TentArt({ shape, rotation }: { shape: Shape; rotation: number }) {
  if (shape === 'el') return <BuildingArt kind="camp" shape={shape} rotation={rotation}/>;
  const cells = offsets(shape, rotation), width = (Math.max(...cells.map(p=>p.c))+1)*100, height = (Math.max(...cells.map(p=>p.r))+1)*100;
  const horizontal = width > height;
  return <FootprintArt shape={shape} rotation={rotation}>
    {horizontal ? <>
      <ellipse cx={width/2} cy="83" rx={width/2-9} ry="8" fill="#806844" opacity=".18"/>
      <rect x="9" y="26" width={width-18} height="56" rx="8" fill="#cbb279"/>
      <path className="roof-plane" d={`M12 74 34 24H${width-34}L${width-12} 74Z`} fill="#d8a04a"/>
      <path d={`M34 24H${width-34}L${width-42} 74H42Z`} fill="#f4c66f"/><path d={`M34 24H${width-34}L${width-38} 47H38Z`} fill="#ffdc8d"/>
      <path d="m12 74 22-50 8 50Z" fill="#e9b25b"/>
      <path className="building-door" d="M22 74V58q0-12 10-12t10 12v16Z" fill="#49604d"/><path d="M22 74V58q0-12 10-12v28Z" fill="#aa773b"/>
      <path d="M32 51v20" stroke="#e8c487" strokeWidth="2" strokeLinecap="round"/>
      <path d={`m${width-34} 24 22 50h-30Z`} fill="#c99041"/>
      <path d={`M34 24H${width-34}M9 79H${width-9}`} stroke="#a9834d" strokeWidth="3" strokeLinecap="round"/>
      <path d={`m12 74-7 9m${width-17}-9 7 9M34 24l-3-9m${width-65} 9 3-9`} stroke="#9f7f51" strokeWidth="3" strokeLinecap="round"/>
    </> : <>
      <ellipse cx="50" cy={height-10} rx="43" ry="7" fill="#806844" opacity=".18"/>
      <path className="roof-plane" d={`M32 18h36l22 ${height-46}H10Z`} fill="#f4c66f"/>
      <path d={`M50 18h18l22 ${height-46}H50Z`} fill="#d8a04a"/>
      <path d={`M50 18v${height-72}`} stroke="#ffdf96" strokeWidth="3"/>
      <path d={`M50 ${height-56} 10 ${height-14}h80Z`} fill="#e9b25b"/>
      <path className="building-door" d={`M50 ${height-39} 33 ${height-14}h34Z`} fill="#49604d"/>
      <path d={`M50 ${height-39}v25H33Z`} fill="#aa773b"/>
      <path d={`M10 ${height-14}l-5 7m85-7 5 7M32 18l-3-8m39 8 3-8`} stroke="#9f7f51" strokeWidth="3" strokeLinecap="round"/>
    </>}
  </FootprintArt>;
}

export function FacilityArt({ kind, shape, rotation = 0 }: { kind: FacilityKind; shape: Shape; rotation?: number }) {
  if (shape === 'single') return <Art kind={kind}/>;
  if (kind === 'picnic') return <PicnicArt shape={shape} rotation={rotation}/>;
  if (kind === 'camp') return <TentArt shape={shape} rotation={rotation}/>;
  return <BuildingArt kind="cabin" shape={shape} rotation={rotation}/>;
}


export function Art({ kind, className = '' }: { kind: FacilityKind | TerrainKind; className?: string }) {
  return <svg className={`art ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {kind === 'foodTruck' && <><ellipse cx="50" cy="86" rx="40" ry="6" fill="#624c2420"/><path d="M14 38q0-7 7-7h48l16 20v27H14Z" fill="#f4e3bd"/><path d="M68 32 85 52v26H68Z" fill="#dfc99c"/><path d="M72 41h4l8 12H72Z" fill="#92bfc0"/><rect x="23" y="41" width="36" height="22" rx="3" fill="#53746a"/><path d="M28 45h25v13H28Z" fill="#a8c8b8"/><path d="M41 45v13" stroke="#f4dfb2" strokeWidth="2"/><path d="M19 31h44l5 11H14Z" fill="#dc956b"/><path d="m24 31-3 11h9l2-11m9 0v11h9l-2-11m9 0 3 11h8l-5-11" fill="#f8dfae"/><path d="M14 42q5 6 10 0 5 6 10 0 5 6 10 0 5 6 10 0 7 6 14 0" stroke="#c17d55" strokeWidth="2"/><path d="M21 64h41" stroke="#bd8e5b" strokeWidth="4" strokeLinecap="round"/><path d="M15 76h69" stroke="#bd986a" strokeWidth="4"/><circle cx="29" cy="79" r="9" fill="#5e665e"/><circle cx="72" cy="79" r="9" fill="#5e665e"/><circle cx="29" cy="79" r="4" fill="#d1c5a3"/><circle cx="72" cy="79" r="4" fill="#d1c5a3"/><path d="M79 62h7" stroke="#f5ce77" strokeWidth="3" strokeLinecap="round"/><path d="M48 53h6v7h-6Z" fill="#dfad69"/></>}
    {kind === 'powerTower' && <><ellipse cx="50" cy="88" rx="31" ry="5" fill="#315a4620"/><path d="M26 87 45 13h10l19 74M38 43h24M32 65h36M45 13l17 30M55 13 38 43m0 0 30 22m-6-22L32 65m0 0 42 22m-6-22L26 87" stroke="#7f9290" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M26 27h48M20 43h60" stroke="#a9b6ac" strokeWidth="5" strokeLinecap="round"/><path d="M28 27v9m44-9v9M22 43v9m56-9v9" stroke="#6d817e" strokeWidth="3"/><path d="M25 36h6m38 0h6M19 52h6m50 0h6" stroke="#d3bf8c" strokeWidth="4" strokeLinecap="round"/><path d="M43 86h14" stroke="#c4cec0" strokeWidth="4"/><path d="m52 49-7 10h7l-4 9 12-13h-8l5-6Z" fill="#efcb78"/><path d="M22 88h10m36 0h10" stroke="#a7a997" strokeWidth="5" strokeLinecap="round"/></>}
    {kind === 'pool' && <><ellipse cx="50" cy="85" rx="40" ry="6" fill="#315a4620"/><path d="M10 41q0-10 12-10h56q12 0 12 10v32q0 10-12 10H22q-12 0-12-10Z" fill="#c8c7ad"/><rect x="10" y="24" width="80" height="52" rx="13" fill="#f0e8cf"/><rect x="17" y="31" width="66" height="38" rx="9" fill="#7daeb8"/><path d="M19 43q0-9 9-9h44q9 0 9 9v15q0 8-9 8H28q-9 0-9-8Z" fill="#a9d5dc"/><path d="M25 46q8 4 16 0m10 10q10 4 20 0m-42 4 9 1m18-22 11 1" stroke="#e6f1e6" strokeWidth="3" strokeLinecap="round"/><path d="M65 27V17q0-5 5-5t5 5v22M54 28V17q0-5 5-5t5 5v22m-9-13h10m-10 8h10" stroke="#a0aaa0" strokeWidth="3" strokeLinecap="round"/><path d="M23 73h12m13 0h12m12 0h7" stroke="#d4cfb7" strokeWidth="2" strokeLinecap="round"/></>}
    {kind === 'picnic' && <><ellipse cx="50" cy="85" rx="39" ry="7" fill="#624c2420"/><path d="m34 42-12 43m43-43 13 43M28 71h46" stroke="#836547" strokeWidth="7" strokeLinecap="round"/><path d="M14 35h72v17H14Z" fill="#c49a60"/><path d="m14 35 13-9h48l11 9Z" fill="#ebc78d"/><path d="M9 63h28v10H9Zm55 0h28v10H64Z" fill="#c49a60"/><path d="M21 34h56M20 46h60" stroke="#f4dba7" strokeWidth="3" strokeLinecap="round"/><path d="M31 25h8v10h-8Z" fill="#7b9f88"/><circle cx="69" cy="34" r="5" fill="#d38d60"/></>}
    {kind === 'cabin' && <><ellipse cx="51" cy="86" rx="39" ry="7" fill="#624c2420"/><path d="M19 42h60v40H19Z" fill="#c59865"/><path d="M58 42h21v40H58Z" fill="#9f754f"/><path d="M67 18h10v23H67Z" fill="#9b9382"/><path d="m10 44 38-31 42 31Z" fill="#63846a"/><path d="m48 13 42 31H48Z" fill="#3e6653"/><path d="M22 53h53m-53 11h53m-53 10h53" stroke="#af804e" strokeWidth="3"/><path d="M39 58h19v25H39Z" fill="#53654e"/><path d="M25 49h12v13H25Zm39 0h10v13H64Z" fill="#f5d795"/><path d="M31 49v13m38-13v13" stroke="#ead3a6" strokeWidth="2"/><circle cx="53" cy="71" r="2" fill="#e8c783"/><path d="M15 84h69" stroke="#d6b789" strokeWidth="5" strokeLinecap="round"/></>}
    {kind === 'water' && <><path d="M14 34C22 19 38 26 47 21C64 12 84 27 83 42C98 54 87 75 73 78C62 89 35 83 27 77C6 78 2 53 14 34Z" fill="#699d9f"/><path d="M15 32C28 20 37 30 48 24C65 17 84 30 81 43C92 57 78 74 65 72C50 83 38 73 26 74C10 70 7 46 15 32Z" fill="#98c7c5"/><path d="M26 42q9 5 18 0m8 17q10 5 21-1M26 62l7 1m23-29 10 2" stroke="#e1eece" strokeWidth="3" strokeLinecap="round"/><ellipse cx="14" cy="73" rx="7" ry="4" fill="#c8c5a5"/><path d="m83 67 1-12m0 7 5-5" stroke="#72916a" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'forest' && <><ellipse cx="50" cy="83" rx="35" ry="7" fill="#315a4620"/><path d="M30 60v22m41-25v23M50 54v33" stroke="#947c54" strokeWidth="7" strokeLinecap="round"/><path d="M29 22 10 54h9L9 69q21 7 41 0L40 54h8Z" fill="#638867"/><path d="M72 18 55 47h8L52 65q20 7 39 0L81 47h7Z" fill="#719775"/><path d="M49 8 28 44h9L21 72q29 9 56 0L62 44h10Z" fill="#396e54"/><path d="m49 8-1 67q14 2 29-3L62 44h10Z" fill="#2f604b"/><path d="m39 42 8 2m-14 18 14 3" stroke="#87a278" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'mountain' && <><ellipse cx="50" cy="82" rx="38" ry="7" fill="#315a4620"/><path d="m7 76 24-43 21 42Z" fill="#a7aa97"/><path d="M27 79 56 16 91 79q-31 10-64 0Z" fill="#a29e87"/><path d="m56 16-4 66q21 3 39-3Z" fill="#827f70"/><path d="m56 16-14 31 11-5 8 7 6-9Z" fill="#eeead8"/><path d="m56 16 5 33 6-9Z" fill="#d2d4c3"/><path d="m33 76 8-17" stroke="#bfc0a7" strokeWidth="3" strokeLinecap="round"/><path d="m75 81 4-8m-65 7 4-5" stroke="#788461" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'camp' && <><ellipse cx="50" cy="83" rx="40" ry="7" fill="#624c2420"/><path d="m9 77 38-57 44 57Z" fill="#d59a43"/><path d="m47 20 14 57h30Z" fill="#f2c56e"/><path d="m47 20-2 57H9Z" fill="#f7ce7c"/><path d="m46 43-21 34h39Z" fill="#4d6350"/><path d="m46 43-1 34h19Z" fill="#344f42"/><path d="m46 43-4 31H27Z" fill="#b37b39"/><path d="m47 20-5-7m5 7 5-7M9 77l-4 7m86-7 4 7" stroke="#8f7957" strokeWidth="3" strokeLinecap="round"/><path d="M8 80h84" stroke="#b8894c" strokeWidth="4" strokeLinecap="round"/><path d="m62 42 11 21" stroke="#ffe2a4" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'fire' && <><ellipse cx="50" cy="85" rx="35" ry="7" fill="#624c241c"/><path d="m27 76 47 9m-1-12L29 87" stroke="#80694d" strokeWidth="9" strokeLinecap="round"/><path d="M49 14c4 20 21 23 14 38 7-1 9-7 9-13 20 28 8 40-20 41-26 1-41-18-22-39-2 14 6 16 8 8 5-11 2-24 11-35Z" fill="#e98e4c"/><path d="M51 39c0 13 10 19 12 25 5-2 7-7 7-7 4 17-7 24-19 24-21 0-25-18-15-26-2 11 8 12 9 5Z" fill="#f6c764"/><path d="M50 63c-1 9-6 9-7 14 8 7 22 2 14-8-1 5-4 4-7-6Z" fill="#fff0b4"/><path d="m73 20 2-5M31 25l-2-5" stroke="#e3ac59" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'tower' && <><ellipse cx="50" cy="87" rx="33" ry="6" fill="#624c2420"/><path d="m35 47-8 39m38-39 8 39M33 61l36 19M66 60 30 80" stroke="#937650" strokeWidth="6" strokeLinecap="round"/><path d="M28 35h44v20H28Z" fill="#c5a36d"/><path d="M51 35h21v20H51Z" fill="#b18b59"/><path d="M32 35V24m36 11V24" stroke="#9b7b4f" strokeWidth="5"/><path d="m18 28 31-19 34 19Z" fill="#537b65"/><path d="m49 9 34 19H49Z" fill="#39644f"/><path d="M25 37h50M26 54h48" stroke="#e0c396" strokeWidth="4" strokeLinecap="round"/><path d="M36 38v14m14-14v14m14-14v14" stroke="#91714b" strokeWidth="3"/><path d="m49 63-3 22m12-22 3 22m-13-7h12m-11-8h9" stroke="#c7a874" strokeWidth="3"/></>}
  </svg>;
}

export function CampArt({ shape, rotation = 0 }: { shape: Shape; rotation?: number }) {
  return <FacilityArt kind="camp" shape={shape} rotation={rotation}/>;
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
