import { art } from '../../assets/art';
import { useId } from 'react';
import { offsets } from '../../engine';
import type { FacilityKind, Shape, TerrainKind } from '../../engine';

export function FootprintSurface({ shape, rotation }: { shape: Shape; rotation: number }) {
  const clip = `surface-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cells = offsets(shape, rotation);
  const width = (Math.max(...cells.map(p => p.c)) + 1) * 100, height = (Math.max(...cells.map(p => p.r)) + 1) * 100;
  const corners = footprintCorners(cells);
  const outline = corners.map((p,i) => {
    const previous = corners[(i+corners.length-1)%corners.length], next = corners[(i+1)%corners.length];
    const before = { x:p.x-Math.sign(p.x-previous.x)*8, y:p.y-Math.sign(p.y-previous.y)*8 };
    const after = { x:p.x+Math.sign(next.x-p.x)*8, y:p.y+Math.sign(next.y-p.y)*8 };
    return `${i ? 'L' : 'M'}${before.x} ${before.y}Q${p.x} ${p.y} ${after.x} ${after.y}`;
  }).join('')+'Z';
  return <svg className="facility-footprint" data-shape={shape} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id={clip}><path d={outline}/></clipPath></defs><path className="footprint-fill" d={outline}/><path className="footprint-outline" d={outline} fill="none" vectorEffect="non-scaling-stroke" clipPath={`url(#${clip})`}/></svg>;
}

function FootprintArt({ shape, rotation, children }: { shape: Shape; rotation: number; children: React.ReactNode }) {
  const clip = `footprint-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`, cells = offsets(shape, rotation);
  const width = (Math.max(...cells.map(p => p.c)) + 1) * 100, height = (Math.max(...cells.map(p => p.r)) + 1) * 100;
  const boundary = `M${footprintCorners(cells).map(p => `${p.x} ${p.y}`).join('L')}Z`;
  return <svg key={`${shape}-${rotation}`} className="art footprint-art" viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
    <defs><clipPath id={clip} clipPathUnits="userSpaceOnUse"><path d={boundary}/></clipPath></defs>
    <g clipPath={`url(#${clip})`}>{children}</g>
  </svg>;
}

type Point = { x: number; y: number };
function footprintCorners(cells: { r: number; c: number }[]): Point[] {
  const edges: [Point, Point][] = [];
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
  return points.filter((p,i) => {
    const prev = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
    return (p.x-prev.x)*(next.y-p.y) !== (p.y-prev.y)*(next.x-p.x);
  });
}

// Keep both wings equally wide and join their roof ridges at the inner cell.
function roofOutline(shape: Shape, rotation: number, ridge = false): Point[] {
  const corners = footprintCorners(offsets(shape, rotation));
  const inset = (a: Point, b: Point) => {
    const x = Math.sign(a.y-b.y), y = Math.sign(b.x-a.x), distance = ridge ? 50 : 17;
    return {x:x*distance,y:y*distance};
  };
  return corners.map((p,i) => {
    const a = inset(corners[(i+corners.length-1)%corners.length],p), b = inset(p,corners[(i+1)%corners.length]);
    return {x:p.x+a.x+b.x,y:p.y+a.y+b.y-(ridge ? 8 : 0)};
  });
}

function BuildingArt({ kind, shape, rotation }: { kind: 'camp' | 'cabin'; shape: Shape; rotation: number }) {
  const points = roofOutline(shape, rotation), peaks = roofOutline(shape, rotation, true), cells = offsets(shape, rotation);
  const roof = `M${points.map(p=>`${p.x} ${p.y}`).join('L')}Z`;
  const edges = points.map((p,i)=>({p,q:points[(i+1)%points.length]}));
  const fronts = edges.filter(({p,q})=>q.x<p.x).map(({p,q})=>({x:q.x,y:q.y,width:p.x-q.x}));
  const front = [...fronts].sort((a,b)=>b.y-a.y || b.width-a.width)[0];
  const doorX = front.x + (front.width > 120 ? 33 : front.width / 2), doorY = front.y;
  const camp = kind === 'camp';
  const ridge = `M${peaks.map(p=>`${p.x} ${p.y}`).join('L')}Z`;
  const chimney = [...cells].sort((a,b)=>a.r-b.r || a.c-b.c)[0];
  return <FootprintArt shape={shape} rotation={rotation}>
    <path d={`M${points.map(p=>`${p.x+4} ${p.y+11}`).join('L')}Z`} fill="#624c2420"/>
    {edges.filter(({p,q})=>q.y>p.y).map(({p,q},i)=><path key={i} d={`M${p.x} ${p.y}L${q.x} ${q.y}l6 12L${p.x+6} ${p.y+12}Z`} fill={camp ? '#b99559' : '#9f754f'}/>)}
    {fronts.map((f,i)=><g key={i}><rect x={f.x} y={f.y} width={f.width} height={camp ? 7 : 14} fill={camp ? '#cbb279' : '#c59865'}/>{!camp && <path d={`M${f.x+4} ${f.y+5}h${f.width-8}m-${f.width-8} 6h${f.width-8}`} stroke="#af804e" strokeWidth="2"/>}</g>)}
    <path d={roof} fill={camp ? '#dba552' : '#67875f'}/>
    {edges.map(({p,q},i) => {
      const a = peaks[i], b = peaks[(i+1)%peaks.length];
      const shade = q.x > p.x ? 0 : q.y > p.y ? 1 : q.x < p.x ? 2 : 3;
      return <path key={`roof-${i}`} className="roof-plane" d={`M${p.x} ${p.y}L${q.x} ${q.y}L${b.x} ${b.y}L${a.x} ${a.y}Z`} fill={(camp ? ['#ffdfa0','#d8a04a','#f4c66f','#f7ce7c'] : ['#91ad7d','#456d54','#789969','#a4bb8d'])[shade]} stroke={camp ? '#d7a355' : '#6c8d63'} strokeWidth="1" strokeLinejoin="round"/>;
    })}
    <path d={ridge} stroke={camp ? '#c99142' : '#45684f'} strokeWidth={camp ? 3 : 4} strokeLinecap="round" strokeLinejoin="round"/>
    <path d={ridge} stroke={camp ? '#ffedb4' : '#bfd0a2'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    {!camp && cells.map(p => <path key={`shingles-${p.r}-${p.c}`} d={`M${p.c*100+22} ${p.r*100+50}h18m10 0h18m-39 12h16m10 0h16`} stroke="#b5c49a" strokeWidth="2" strokeLinecap="round" opacity=".6"/>)}
    {camp ? <>
      <path d={`M${doorX} ${doorY-37}l-30 44h60Z`} fill="#e9b25b"/>
      <path className="building-door" d={`M${doorX} ${doorY-22}l-17 29h34Z`} fill="#4d6350"/>
      <path d={`M${doorX} ${doorY-22}l-4 26h-11Z`} fill="#b37b39"/>
      <path d={`M${doorX} ${doorY-37}l-3-6m3 6 3-6M${doorX-30} ${doorY+7}l-5 4m65-4 5 4`} stroke="#9f7f51" strokeWidth="3" strokeLinecap="round"/>
    </> : <>
      <rect className="building-door" x={doorX-9} y={doorY-8} width="18" height="22" rx="2" fill="#53654e"/>
      <circle cx={doorX+5} cy={doorY+3} r="2" fill="#e8c783"/>
      {front.width>120 && <><rect x={front.x+front.width-49} y={doorY+2} width="22" height="10" fill="#f5d795"/><path d={`M${front.x+front.width-38} ${doorY+2}v10`} stroke="#ead3a6" strokeWidth="2"/></>}
      <rect x={chimney.c*100+60} y={chimney.r*100+27} width="12" height="24" fill="#9b9382"/><path d={`M${chimney.c*100+58} ${chimney.r*100+27}h16v6h-16Z`} fill="#b6af9c"/>
      <path d={`M${doorX-14} ${doorY+11}h28`} stroke="#d6b789" strokeWidth="4" strokeLinecap="round"/>
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
  return <img className={`art ${className}`} src={art.object(kind)} alt="" draggable={false} aria-hidden="true"/>;
}

export function CampArt({ shape, rotation = 0 }: { shape: Shape; rotation?: number }) {
  return <FacilityArt kind="camp" shape={shape} rotation={rotation}/>;
}
