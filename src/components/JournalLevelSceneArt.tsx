import { useId, type CSSProperties } from 'react';
import { journalLevelCovers, journalPalettes } from './journalArt';
import { journalSceneDesigns, type ScenePath, type ScenePaint } from './journalSceneDesigns';
import { Cabin, Campfire, FoodTruck, PicnicTable, Pool, PowerTower, Rock, ScenePaints, Shrub, Tent, Tower, Tree } from './JournalSceneObjects';

function scenicPaint(paint: ScenePaint, id: string) {
  if (paint === 'ground' || paint === 'water' || paint === 'leaf') return `url(#${id}-${paint})`;
  return paint === 'light' ? '#fff6de' : `var(--scene-${paint})`;
}

function ScenicPaths({ paths, paintId }: { paths: ScenePath[]; paintId: string }) {
  return <>{paths.map(({ d, paint, opacity, stroke, width }, index) => <path key={index} d={d} fill={stroke ? 'none' : scenicPaint(paint, paintId)} stroke={stroke ? scenicPaint(paint, paintId) : undefined} strokeWidth={width ?? 2} opacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>)}</>;
}

// Both the journal and completion render these same hand-composed environments and shared buildings.
export function JournalLevelSceneArt({ id }: { id: number }) {
  const uid = useId();
  const cover = journalLevelCovers[id - 1], colors = journalPalettes[cover.palette];
  const design = journalSceneDesigns[id - 1];
  const skies = {
    morning: [colors.paper, '#fff7e3'],
    day: [colors.paper, '#edf4e9'],
    golden: ['#f1e2c6', '#fff1cf'],
    dusk: ['#cdd8df', '#f2d8bd'],
    mist: ['#dce8e7', '#f1f3e8'],
  };
  const [skyTop, skyBottom] = skies[design.mood];
  const style = Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--scene-${key}`, value])) as CSSProperties;
  const subjects = cover.subjects.map((kind, index) => ({ kind, position: design.subjects[index], index })).sort((a, b) => a.position[1] - b.position[1]);
  const facilities = { fire: Campfire, tower: Tower, picnic: PicnicTable, cabin: Cabin, foodTruck: FoodTruck, powerTower: PowerTower, pool: Pool };
  return <svg className="level-cover-art journal-scene-art" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" style={style} data-cover-main={cover.main} data-cover-layout={cover.composition} data-cover-level={id} data-scene-theme={design.name}>
    <ScenePaints id={uid}/>
    <defs>
      <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor={skyTop}/><stop offset="1" stopColor={skyBottom}/></linearGradient>
      <linearGradient id={`${uid}-ground`} x2=".25" y2="1"><stop stopColor={colors.sand}/><stop offset=".35" stopColor={colors.land}/><stop offset="1" stopColor={colors.shade}/></linearGradient>
      <linearGradient id={`${uid}-atmosphere`} x2="1" y2="1"><stop stopColor={skyBottom} stopOpacity={design.mood === 'dusk' ? '.2' : '.08'}/><stop offset=".7" stopColor={skyBottom} stopOpacity="0"/></linearGradient>
      <clipPath id={`${uid}-frame`}><rect width="320" height="220" rx="16"/></clipPath>
    </defs>
    <g clipPath={`url(#${uid}-frame)`}>
      <rect width="320" height="220" fill={`url(#${uid}-sky)`}/>
      {design.sun && <circle cx={design.sun[0]} cy={design.sun[1]} r={design.sun[2]} fill={design.mood === 'dusk' ? '#f2c19a' : '#fff3cb'} opacity=".8"/>}
      {design.clouds && <path d={design.clouds} fill="#fffaf0" opacity=".62"/>}
      <ScenicPaths paths={design.distant} paintId={uid}/>
      <ScenicPaths paths={design.terrain} paintId={uid}/>
      {design.backTrees?.map(([x, y, scale, variant], index) => <Tree key={index} x={x} y={y} scale={scale} variant={variant} paintId={uid}/>)}
      {cover.subjects.includes('powerTower') && <g stroke="var(--scene-deep)" strokeWidth="1.1" opacity=".4">
        {cover.subjects.map((kind, index) => {
          if (kind !== 'powerTower') return null;
          const [x, y, scale] = design.subjects[index], upperY = y - 77 * scale, lowerY = y - 59 * scale;
          return <path key={index} d={`M${x + 24 * scale} ${upperY}Q${(x + 320) / 2} ${upperY + 16} 320 ${upperY - 3}M${x + 29 * scale} ${lowerY}Q${(x + 320) / 2} ${lowerY + 16} 320 ${lowerY - 3}`}/>;
        })}
      </g>}
      <g data-cover-role="main">
        {subjects.map(({ kind, position: [x, y, scale, long, facing], index }) => {
          const props = { x, y, scale, paintId: uid };
          if (kind === 'camp') return <Tent key={index} {...props} long={long} facing={facing}/>;
          const Facility = facilities[kind];
          return <Facility key={index} {...props}/>;
        })}
      </g>
      {design.rocks?.map(([x, y, scale], index) => <Rock key={index} x={x} y={y} scale={scale} paintId={uid}/>)}
      {design.shrubs?.map(([x, y, scale], index) => <Shrub key={index} x={x} y={y} scale={scale} paintId={uid}/>)}
      {design.foregroundTrees?.map(([x, y, scale, variant], index) => <Tree key={index} x={x} y={y} scale={scale} variant={variant} paintId={uid}/>)}
      {design.accents && <ScenicPaths paths={design.accents} paintId={uid}/>}
      <rect width="320" height="220" fill={`url(#${uid}-atmosphere)`}/>
    </g>
  </svg>;
}
