import { useId } from 'react';
import { Art } from './Art';
import { useHeroMotion } from '../hooks/useHeroMotion';

export function HeroArt() {
  const running = useHeroMotion();
  const id = useId();
  return <svg className="landscape hero-art" data-motion={running ? 'running' : 'paused'} viewBox="0 0 800 620" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-island`} x1="180" y1="270" x2="660" y2="500" gradientUnits="userSpaceOnUse"><stop stopColor="#cbd5a4"/><stop offset="1" stopColor="#91b08a"/></linearGradient><linearGradient id={`${id}-stream`} x1="480" y1="250" x2="390" y2="480" gradientUnits="userSpaceOnUse"><stop stopColor="#b6d9cb"/><stop offset="1" stopColor="#79b4b0"/></linearGradient><radialGradient id={`${id}-fire-glow`}><stop stopColor="#f5c363" stopOpacity=".38"/><stop offset="1" stopColor="#f5c363" stopOpacity="0"/></radialGradient></defs>
    <circle cx="620" cy="130" r="48" fill="#efd69a" opacity=".75"/>
    <defs><clipPath id={`${id}-sky`}><rect x="0" y="60" width="800" height="190"/></clipPath></defs>
    <g stroke="#fffdf1" strokeWidth="12" strokeLinecap="round" clipPath={`url(#${id}-sky)`}>
      <path className="hero-cloud" d="M-48 161h83m-42-14h75"/>
      <path className="hero-cloud hero-cloud-far" d="M-35 212h69"/>
    </g>
    <g stroke="#758b73" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <g className="hero-bird"><path className="hero-bird-wings" d="M-10-3Q-5-4 0 2Q5-4 10-3"/></g>
      <g className="hero-bird hero-bird-far"><path className="hero-bird-wings" d="M-10-3Q-5-4 0 2Q5-4 10-3"/></g>
      <g className="hero-bird hero-bird-low"><path className="hero-bird-wings" d="M-10-3Q-5-4 0 2Q5-4 10-3"/></g>
    </g>
    <ellipse cx="410" cy="502" rx="277" ry="38" fill="#426e4220"/>
    <path d="M110 331 398 180 705 339v48L421 549 111 379Z" fill="#7d9670"/><path d="m111 355 310 163 284-159v28L421 549 111 379Z" fill="#a5aa79"/>
    <path d="M110 330q12-23 33-26l238-129q21-12 42 0l263 143q31 15 7 37L437 507q-16 11-35 1L122 362q-28-14-12-32Z" fill={`url(#${id}-island)`}/>
    <g stroke="#799474" strokeWidth="1.5" opacity=".22"><path d="m162 291 315 170M214 263l315 169M266 235l315 169M318 207l315 169M171 388l291-162M226 417l291-162M281 446l291-162M336 475l291-162"/></g>
    <path d="M493 220c-78 48 13 64-51 99-48 27-82 12-77 47 5 24 59 29 42 54-10 15-41 35-62 47l58 32c65-37 94-71 64-103-26-29-36-32 10-52 71-31 6-67 66-96Z" fill={`url(#${id}-stream)`}/><g fill="none" stroke="#e3edcf" strokeWidth="4" strokeLinecap="round">
      <path className="hero-current" d="M499 249q-35 26-22 47t-39 34q-64 14-46 41t44 47q-4 24-50 53" strokeDasharray="12 35"/>
    </g>
    <svg x="293" y="107" width="162" height="162"><Art kind="mountain"/></svg>
    <svg x="180" y="183" width="155" height="155"><Art kind="forest" className="hero-forest hero-forest-back"/></svg>
    <svg x="100" y="229" width="144" height="144"><Art kind="forest" className="hero-forest"/></svg>
    <svg x="543" y="246" width="144" height="144"><Art kind="forest" className="hero-forest hero-forest-right"/></svg>
    <svg x="489" y="159" width="136" height="136"><Art kind="tower"/></svg>
    <svg x="254" y="261" width="167" height="167"><Art kind="camp"/></svg>
    <svg x="453" y="333" width="113" height="113"><Art kind="camp"/></svg>
    <ellipse className="hero-fire-glow" cx="377" cy="400" rx="32" ry="30" fill={`url(#${id}-fire-glow)`}/>
    <svg x="339" y="350" width="76" height="76"><Art kind="fire" className="hero-fire"/></svg>
    <g stroke="#749569" strokeWidth="3" strokeLinecap="round"><path d="m221 378 2-8m2 8 5-5m306 32 2-8m2 8 5-5M349 251l2-8m2 8 5-5m-85 181 2-8m2 8 5-5"/></g>
    <g fill="#f1de9d"><circle cx="241" cy="391" r="4"/><circle cx="250" cy="387" r="3"/><circle cx="595" cy="342" r="4"/><circle cx="574" cy="364" r="3"/><circle cx="291" cy="454" r="4"/></g>
  </svg>;
}
