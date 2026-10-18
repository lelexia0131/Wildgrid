import { useId } from 'react';
import { useI18n } from '../../localization/LanguageContext';

// Original lettering drawn on a camp-sign grid, independent of installed fonts.
const ENGLISH_GLYPHS = [
  'M0 4 13 2 20 49 28 19 39 18 48 49 53 0 67 3 57 72 43 74 34 45 26 74 12 71Z', // W
  'M3 1 29 0 30 13 24 14 24 59 32 60 31 73 2 73 1 60 9 59 9 15 2 15Z', // I
  'M2 0 18 2 17 57 44 56 43 73 0 72Z', // L
  'M2 2 24 0Q53 0 53 35Q54 73 24 74L0 72ZM17 16 17 57 24 57Q37 57 37 36Q37 15 24 16Z', // D
  'M51 9 42 23Q34 14 25 17Q14 21 15 38Q15 58 30 58L37 57 37 45 27 45 27 31 53 31 52 66Q43 76 27 75Q-2 75 0 37Q0 3 26 0Q41-2 51 9Z', // G
  'M1 2 26 0Q51 0 50 24Q50 40 37 44L54 71 36 75 21 48 16 48 17 74 0 73ZM17 15 17 33 25 33Q34 33 34 24Q34 15 25 15Z', // R
  'M3 1 29 0 30 13 24 14 24 59 32 60 31 73 2 73 1 60 9 59 9 15 2 15Z', // I
  'M2 2 24 0Q53 0 53 35Q54 73 24 74L0 72ZM17 16 17 57 24 57Q37 57 37 36Q37 15 24 16Z', // D
];
const LETTER_POSITIONS = [22, 96, 135, 186, 246, 306, 367, 407];
const LETTER_TILTS = [-5, 3, -2, 2, -3, 3, -2, 4];

export function GameTitle({ entering = false }: { entering?: boolean }) {
  const { language, t } = useI18n();
  const id = useId();
  const chinese = language === 'zh';
  return <h1 className={`camp-title camp-title-${language}`} aria-label={t('野格')}>
    <svg viewBox={chinese ? '0 0 330 172' : '0 0 490 144'} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-paint`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff3c6"/><stop offset=".55" stopColor="#f4d28b"/><stop offset="1" stopColor="#e3b369"/>
        </linearGradient>
        <g id={`${id}-letters`}>
          {chinese ? <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path transform="rotate(-4 98 88)" d="M35 35 85 33 86 85 35 85ZM36 59 85 59M60 35 60 132M33 108 86 106M28 135 91 129M105 33 144 33 120 56M109 50 134 69M100 78 150 76 138 95M124 79 124 134 109 132"/>
            <path transform="rotate(4 234 88)" d="M183 32 181 139M163 63 204 61M180 65 159 103M183 76 201 94M229 30 213 55M224 42 266 41Q250 77 211 91M220 55Q247 80 279 87M220 101 264 100 264 136 220 136Z"/>
          </g> : ENGLISH_GLYPHS.map((d, i) => <path key={i} d={d} fillRule="evenodd" transform={`translate(${LETTER_POSITIONS[i]} ${35 + (i % 2) * 3}) rotate(${LETTER_TILTS[i]} 25 36)`}/>)}
        </g>
        {entering && <>
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#ffd377" stopOpacity="0"/><stop offset=".4" stopColor="#ffe8a2" stopOpacity=".35"/><stop offset=".55" stopColor="#fff6d1" stopOpacity=".9"/><stop offset="1" stopColor="#ffd377" stopOpacity="0"/>
          </linearGradient>
          <mask id={`${id}-shine-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="490" height="172">
            <use href={`#${id}-letters`} stroke="white" strokeWidth={chinese ? 15 : 2} fill={chinese ? 'none' : 'white'} strokeLinejoin="round"/>
          </mask>
        </>}
      </defs>
      <g strokeLinejoin="round">
        <use href={`#${id}-letters`} transform="translate(0 7)" stroke="#674f36" strokeWidth={chinese ? 26 : 10} fill={chinese ? 'none' : '#674f36'}/>
        <use href={`#${id}-letters`} stroke="#385f49" strokeWidth={chinese ? 25 : 9} fill={chinese ? 'none' : '#385f49'}/>
        <use href={`#${id}-letters`} stroke={chinese ? `url(#${id}-paint)` : '#fff1bd'} strokeWidth={chinese ? 15 : 2} fill={chinese ? 'none' : `url(#${id}-paint)`}/>
      </g>
      <g fill="#8aa66a" stroke="#385f49" strokeWidth="2.5" strokeLinejoin="round">
        <path d={chinese ? 'M280 45Q268 16 292 13Q302 34 280 45Z' : 'M451 26Q449 3 473 7Q472 29 451 26Z'}/>
        <path d={chinese ? 'M281 45Q282 27 310 30Q303 49 281 45Z' : 'M451 26Q433 23 436 9Q450 8 451 26Z'} fill="#b5c887"/>
      </g>
      <g fill="none" stroke="#bd965f" strokeWidth="2" strokeLinecap="round" opacity=".7">
        <path d={chinese ? 'M38 43 49 43M41 113 51 113M225 125 240 125M230 128 235 128' : 'M151 91h18m-14 4h8M195 52v14M421 88v9'}/>
      </g>
      <path d={chinese ? 'M104 157q58 10 119-1' : 'M175 129q70 9 142-1'} fill="none" stroke="#a9b690" strokeWidth="3" strokeLinecap="round"/>
      {entering && <g mask={`url(#${id}-shine-mask)`}><rect className="home-title-shine" x="-160" y="0" width="160" height="172" fill={`url(#${id}-shine)`}/></g>}
    </svg>
  </h1>;
}
