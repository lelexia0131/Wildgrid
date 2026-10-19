import { useId } from 'react';
import { art } from '../../assets/art';
import { useHeroMotion } from '../hooks/useHeroMotion';

// This SVG is a coordinate/animation stage; all static artwork lives in files.
export function HeroArt({ entering = false }: { entering?: boolean }) {
  const running = useHeroMotion();
  const currentMask = useId();
  return <svg className="landscape hero-art" data-motion={running ? 'running' : 'paused'} viewBox="0 0 800 620" fill="none" aria-hidden="true">
    <defs>
      <mask id={currentMask} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="620">
        <path d="M493 220c-78 48 13 64-51 99-48 27-82 12-77 47 5 24 59 29 42 54-10 15-41 35-62 47l58 32c65-37 94-71 64-103-26-29-36-32 10-52 71-31 6-67 66-96Z" fill="white"/>
        <image href={art.object('camp')} x="254" y="261" width="167" height="167" filter="brightness(0)"/>
        <image href={art.object('camp')} x="453" y="333" width="113" height="113" filter="brightness(0)"/>
      </mask>
    </defs>
    <image href={art.hero} width="800" height="620"/>
    <svg y="60" width="800" height="190" viewBox="0 60 800 190" overflow="hidden">
      <image className="hero-cloud" href={art.decoration('cloud')} x="-54" y="140" width="135" height="28"/>
      <image className="hero-cloud hero-cloud-far" href={art.decoration('cloud-far')} x="-42" y="204" width="84" height="16"/>
    </svg>
    {['', ' hero-bird-far', ' hero-bird-low'].map(name => <g className={`hero-bird${name}`} key={name}><image className="hero-bird-wings" href={art.decoration('bird')} x="-12" y="-8" width="24" height="16"/></g>)}
    {/* Water dash geometry remains program-driven. */}
    <path className="hero-current" d="M499 249C465 278 497 309 460 332S373 345 401 374S474 412 374 483" stroke="#e3edcf" strokeWidth="4" strokeLinecap="round" strokeDasharray="12 35" mask={`url(#${currentMask})`}/>
    {[[180, 183, 155, 'hero-forest-back'], [100, 229, 144, ''], [543, 246, 144, 'hero-forest-right']].map(([x, y, size, name]) => <svg key={String(name)} x={x} y={y} width={size} height={size} viewBox="0 0 100 100" overflow="visible" className={`hero-forest ${name}`}>
      <image href={art.object('forest-ground')} width="100" height="100"/>
      <image className="hero-forest-crown" href={art.object('forest-crowns')} width="100" height="100"/>
    </svg>)}
    <image className="hero-fire-glow" href={art.decoration('hero-glow')} width="800" height="620"/>
    {entering && <image className="home-fire-bloom" href={art.decoration('fire-bloom')} width="800" height="620"/>}
    <svg x="339" y="350" width="76" height="76" viewBox="0 0 100 100" overflow="visible" className="hero-fire">
      <image href={art.object('fire-ground')} width="100" height="100"/>
      {[0, 1, 2, 3].map(i => <image key={i} className={i < 3 ? `hero-flame flame-${i}` : undefined} href={art.object(`fire-flame-${i}`)} width="100" height="100"/>)}
    </svg>
  </svg>;
}
