import { useEffect, useId, useRef } from 'react';
import type { Language } from '../../localization';
import flameDisplacement from '../../assets/branding/flame-displacement.svg?url';

// 54 intervals over 1.8 seconds: 30 samples/sec, with native interpolation between samples.
const flameFrames = Array.from({ length: 55 }, (_, frame) => (1 - Math.cos(frame / 54 * Math.PI * 2)) / 2);

// Trace the existing PNG decorations in source coordinates; lettering is never redrawn.
const decorations = {
  en: {
    width: 1774, height: 887,
    fire: { x: 190, y: 402, width: 218, height: 225 },
    leaves: [
      { path: 'M1082 263Q1052 254 1056 242Q1071 206 1125 208Q1124 245 1082 263Z', origin: '1082px 263px' },
      { path: 'M1300 318Q1270 299 1278 276Q1287 247 1317 229Q1339 272 1300 318Z', origin: '1300px 318px' },
      { path: 'M1385 695Q1351 688 1335 719Q1328 745 1342 768Q1382 755 1393 715Z', origin: '1385px 695px' },
    ],
    lantern: 'M1663 444H1692L1735 467V584H1630L1628 566 1637 507 1643 469Z',
    lanternOrigin: '1676px 445px',
  },
  zh: {
    width: 2079, height: 756,
    fire: { x: 308, y: 345, width: 257, height: 232 },
    leaves: [
      { path: 'M1242 198Q1207 189 1218 172Q1234 139 1280 140Q1285 171 1242 198Z', origin: '1242px 198px' },
      { path: 'M1466 258Q1431 243 1442 216Q1454 187 1483 166Q1508 210 1466 258Z', origin: '1466px 258px' },
      { path: 'M1584 661Q1550 657 1540 687Q1533 714 1547 738Q1582 728 1602 681Z', origin: '1584px 661px' },
    ],
    lantern: 'M1910 384H1944L1994 407V538H1883L1886 492 1894 434 1903 406Z',
    lanternOrigin: '1927px 387px',
  },
};

export function TitleArtwork({ language, src, running }: { language: Language; src: string; running: boolean }) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (running) svg?.unpauseAnimations();
    else svg?.pauseAnimations();
  }, [running]);
  const { width, height, fire, leaves, lantern, lanternOrigin } = decorations[language];
  const image = `#${id}-image`;
  const parts = [...leaves.map(leaf => leaf.path), lantern];
  return <svg ref={svgRef} className="title-artwork title-lettering" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <defs>
      <image id={`${id}-image`} href={src} width={width} height={height}/>
      <radialGradient id={`${id}-firelight`}>
        <stop stopColor="#fff5af" stopOpacity=".8"/>
        <stop offset="1" stopColor="#fff5af" stopOpacity="0"/>
      </radialGradient>
      <mask id={`${id}-base`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height} style={{ maskType: 'luminance' }}>
        <rect width={width} height={height} fill="white"/>
        <rect {...fire} fill="black"/>
        {parts.map((path, index) => <path key={index} d={path} fill="black"/>)}
      </mask>
      {parts.map((path, index) => <clipPath key={index} id={`${id}-part-${index}`}><path d={path}/></clipPath>)}
      {[false, true].map(hover => <filter key={String(hover)} id={`${id}-fire-${hover ? 'hover' : 'idle'}`} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" {...fire} colorInterpolationFilters="sRGB">
        <feImage href={flameDisplacement} {...fire} preserveAspectRatio="none" result="bend"/>
        <feDisplacementMap in="SourceGraphic" in2="bend" scale="0" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" values={flameFrames.map(value => (value * (hover ? 24 : 18)).toFixed(4)).join(';')} dur="1.8s" repeatCount="indefinite" calcMode="linear"/>
        </feDisplacementMap>
      </filter>)}
    </defs>
    <use href={image} mask={`url(#${id}-base)`}/>
    {/* Warp the opaque fire region in place, including its background: no old outline or hole is exposed. */}
    <g className="title-flame">
      <use className="title-flame-idle" href={image} filter={`url(#${id}-fire-idle)`}/>
      <use className="title-flame-hover" href={image} filter={`url(#${id}-fire-hover)`}/>
    </g>
    <ellipse className="title-firelight" cx={fire.x + fire.width * .5} cy={fire.y + fire.height * .69} rx={fire.width * .2} ry={fire.height * .25} fill={`url(#${id}-firelight)`}/>
    {leaves.map((leaf, index) => <g key={index} className={`title-leaf title-leaf-${index}`} style={{ transformOrigin: leaf.origin }}>
      <use href={image} clipPath={`url(#${id}-part-${index})`}/>
    </g>)}
    <g className="title-lantern" style={{ transformOrigin: lanternOrigin }}>
      <use href={image} clipPath={`url(#${id}-part-${parts.length - 1})`}/>
    </g>
  </svg>;
}
