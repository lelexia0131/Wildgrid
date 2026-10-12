import { Art } from './Art';
import { facilityNames, terrainNames } from '../game/facilityRegistry';
import type { FacilityKind, TerrainKind } from '../game/types';
import type { MapIconId } from '../game/mapIcons';

export function MenuIcon({ kind }: { kind: MapIconId | 'check' | 'share' | 'edit' | 'badge' }) {
  if (kind in facilityNames || kind in terrainNames) return <Art kind={kind as FacilityKind | TerrainKind}/>;
  return <svg className="art menu-icon" data-icon={kind} viewBox="0 0 100 100" fill="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
    {!['adventure', 'survival', 'sandbox', 'maps'].includes(kind) && <ellipse cx="50" cy="87" rx="36" ry="6" fill="#526d4820"/>}
    {kind === 'adventure' && <>
      <path d="m13 48 13-9 20 8 17-7v37l-17 7-20-8-13 7Z" fill="#f1e2b6" stroke="#bd9c68" strokeWidth="2"/>
      <path d="M26 41v35m20-28v34" stroke="#d7be8b" strokeWidth="2"/>
      <path d="M19 69q8-15 15-5t18-9" stroke="#92aa7f" strokeWidth="3" strokeDasharray="3 5"/>
      <path d="M63 16V9h12v7" stroke="#bc995a" strokeWidth="4"/>
      <circle cx="66" cy="42" r="28" fill="#b99152"/><circle cx="66" cy="39" r="26" fill="#f0ce83"/><circle cx="66" cy="39" r="20" fill="#fff0c5"/>
      <path d="m71 22 4 19-14 15-4-19Z" fill="#477561"/><path d="m71 22 4 19-9-2Z" fill="#7fa58c"/><path d="m61 56-4-19 9 2Z" fill="#d8c395"/>
      <circle cx="66" cy="39" r="3" fill="#b39459"/>
    </>}
    {kind === 'survival' && <>
      <path d="M37 22v-7q13-10 26 0v7" stroke="#a78a5f" strokeWidth="6"/>
      <path d="M23 36q-9-8-9 9l3 24m60-33q9-8 9 9l-3 24" stroke="#446b54" strokeWidth="6"/>
      <rect x="23" y="21" width="54" height="63" rx="16" fill="#70976a"/><path d="M66 24q11 4 11 17v28q0 14-13 15V25Z" fill="#507951"/>
      <path d="M25 26q25-10 50 0l-4 25q-21 8-42 0Z" fill="#a6bc83"/>
      <path d="M36 29v25m28-25v25" stroke="#e4d6a0" strokeWidth="5"/><rect x="32" y="48" width="9" height="7" rx="2" fill="#b79b60"/><rect x="59" y="48" width="9" height="7" rx="2" fill="#b79b60"/>
      <rect x="32" y="61" width="36" height="18" rx="6" fill="#c3ce93"/><path d="M38 65h24m-16 10 5-7 5 7Z" stroke="#76875a" strokeWidth="2"/>
      <path d="M18 16h64" stroke="#d3b783" strokeWidth="9"/><path d="M20 14h59" stroke="#f3dfad" strokeWidth="5"/>
    </>}
    {(kind === 'sandbox' || kind === 'edit') && <>
      <g transform="rotate(-8 47 52)"><rect x="12" y="19" width="62" height="65" rx="8" fill="#bd965f"/><rect x="12" y="15" width="62" height="65" rx="8" fill="#e4c88d"/><rect x="20" y="23" width="46" height="49" rx="4" fill="#f8efcf"/><path d="M35 23v49m15-49v49M20 39h46m-46 16h46" stroke="#c7d5ac" strokeWidth="2"/><path d="m26 64 10-17 13 12 9-23" stroke="#83a080" strokeWidth="3"/></g>
      <g transform="rotate(25 78 47)"><path d="M72 12h13v57l-6 15-7-15Z" fill="#efbf65"/><path d="M72 12h5v57h-5Z" fill="#ffe6a6"/><path d="m72 69 7 15 6-15Z" fill="#e5cb9b"/><path d="m76 78 3 6 3-6Z" fill="#4e6653"/><rect x="72" y="9" width="13" height="10" rx="3" fill="#7ca5a4"/></g>
    </>}
    {kind === 'maps' && <>
      <path d="m19 25 53-5 13 13v46l-53 7-13-13Z" fill="#ae8c57"/><path d="m20 22 52-5 13 13-52 7Z" fill="#f7e7be"/><path d="M21 29v42l9 9V38Z" fill="#dfc38b"/><path d="m31 36 54-6v48l-54 7Z" fill="#89a57b"/><path d="m36 40 44-5v38l-44 6Z" fill="#c9d9a9"/>
      <path d="m44 62 7-11 9 8 8-15" stroke="#7b9b73" strokeWidth="3"/><path d="M22 41l7 6m-7 6 7 6m-7 6 7 6" stroke="#9b7a4c" strokeWidth="3"/>
      <path d="M62 30v18l7-5 7 3V28Z" fill="#db9e65"/><circle cx="64" cy="69" r="5" fill="#f3d38a"/>
    </>}
    {kind === 'lantern' && <>
      <path d="M33 25V17q17-20 34 0v8" stroke="#647e69" strokeWidth="5"/><path d="m34 26-6 52h44l-6-52Z" fill="#90aca0"/>
      <path d="m38 31-5 39h34l-5-39Z" fill="#fae4a2"/><path d="M49 36v28" stroke="#fff5d3" strokeWidth="7"/><path d="m51 49-9 16h18Z" fill="#f0bd65"/>
      <path d="M25 27h50M25 80h50" stroke="#456f60" strokeWidth="7"/><path d="M35 25h30" stroke="#c7d6ba" strokeWidth="3"/>
    </>}
    {kind === 'boots' && <>
      <path d="m50 21 21-3 5 33 14 10v16H46V64l9-10Z" fill="#ba8f5b"/><path d="m26 26 23-3 4 33 14 10v16H17V67l12-11Z" fill="#ddbb7d"/>
      <path d="m29 28 17-2 3 19-18 3Z" fill="#728c65"/><path d="M34 48h15m-13 7h14m-12 6h13" stroke="#f4e5bb" strokeWidth="3"/>
      <path d="M18 81h49m-20-4h42" stroke="#6e644d" strokeWidth="6"/><path d="M22 69q12-4 21 0" stroke="#efcf96" strokeWidth="3"/>
    </>}
    {kind === 'camera' && <>
      <path d="M23 32 30 20h25l7 12" fill="#87a59a"/><rect x="13" y="30" width="75" height="49" rx="10" fill="#527d72"/><path d="M13 43h75v24H13Z" fill="#9ac2b3"/>
      <circle cx="51" cy="55" r="21" fill="#e4d6b0"/><circle cx="51" cy="55" r="15" fill="#4d6a69"/><circle cx="51" cy="55" r="10" fill="#80b4ba"/><path d="M47 48q6-5 11 1" stroke="#d2e9dd" strokeWidth="3"/><rect x="71" y="35" width="9" height="7" rx="2" fill="#f2d384"/>
    </>}
    {kind === 'mug' && <>
      <path d="M70 38h10q17 21-10 26" stroke="#aa7b56" strokeWidth="7"/><path d="M21 35h51l-5 42q-23 13-41 0Z" fill="#deaa79"/><path d="M24 39h42l-4 33q-17 8-34 0Z" fill="#efcca0"/>
      <ellipse cx="46" cy="35" rx="25" ry="6" fill="#9d7254"/><ellipse cx="46" cy="35" rx="20" ry="4" fill="#704e39"/><path d="M35 26q-9-7 0-16m16 15q-8-7 0-16m12 17q-5-5 0-10" stroke="#d0d3bd" strokeWidth="3"/>
      <path d="m41 50-9 15h22Z" fill="#769774"/>
    </>}
    {kind === 'acorn' && <>
      <path d="M47 23q-3-10 8-15" stroke="#7a7352" strokeWidth="5"/><path d="M26 39q-5 29 24 45 30-16 24-45" fill="#d4a36a"/><path d="M34 43q-3 23 14 32" stroke="#efc98c" strokeWidth="5"/>
      <path d="M20 42q2-29 31-25 26 0 30 25-27 12-61 0Z" fill="#8d9970"/><path d="m29 30 12 14m0-21 15 22m1-22 14 18M27 40l36-15" stroke="#6f7f58" strokeWidth="2"/>
      <path d="M57 16q15-16 27-7-1 17-27 7Z" fill="#aac28b"/>
    </>}
    {kind === 'flower' && <>
      <path d="M50 46v38m0-12q-22-25-28-10 2 14 28 10Zm0-9q22-24 29-10-2 14-29 10Z" stroke="#648d61" strokeWidth="4" fill="#aac893"/>
      <g fill="#e8c794"><ellipse cx="50" cy="23" rx="10" ry="15"/><ellipse cx="50" cy="48" rx="10" ry="15"/><ellipse cx="37" cy="35" rx="15" ry="10"/><ellipse cx="63" cy="35" rx="15" ry="10"/></g><circle cx="50" cy="35" r="10" fill="#d2a254"/><circle cx="47" cy="32" r="3" fill="#f8e2a4"/>
    </>}
    {kind === 'moon' && <>
      <circle cx="50" cy="46" r="35" fill="#9bafaa"/><path d="M58 14a31 31 0 1 0 23 49q-36 3-39-25-1-15 16-24Z" fill="#f5d891"/><path d="m66 27 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#fff0bf"/><circle cx="28" cy="60" r="4" fill="#e6c17d"/><circle cx="42" cy="70" r="3" fill="#e6c17d"/>
    </>}
    {kind === 'binoculars' && <>
      <path d="M20 30q30-21 60 0" stroke="#a88d61" strokeWidth="5"/><path d="M25 24h17l8 50H12Zm35 0h17l11 50H50Z" fill="#83a68b"/><path d="M38 24h5l7 50H38m35-50h5l10 50H73" fill="#54775f"/>
      <rect x="39" y="36" width="22" height="15" rx="5" fill="#d4c396"/><ellipse cx="30" cy="72" rx="19" ry="13" fill="#dccaa0"/><ellipse cx="69" cy="72" rx="19" ry="13" fill="#dccaa0"/><ellipse cx="30" cy="72" rx="13" ry="9" fill="#538791"/><ellipse cx="69" cy="72" rx="13" ry="9" fill="#538791"/><path d="m23 69 9-2m30 2 9-2" stroke="#c8e3d9" strokeWidth="3"/>
    </>}
    {kind === 'check' && <>
      <rect x="19" y="18" width="58" height="68" rx="8" fill="#bca270"/><rect x="24" y="24" width="48" height="55" rx="4" fill="#f7ecc9"/><rect x="35" y="12" width="26" height="15" rx="5" fill="#789478"/>
      <path d="m32 41 5 5 8-10m-13 25 5 5 8-10m9-13h10m-10 19h10" stroke="#80a079" strokeWidth="3"/><circle cx="72" cy="71" r="18" fill="#a4c093"/><path d="m62 71 7 7 14-17" stroke="#fff3cf" strokeWidth="5"/>
    </>}
    {kind === 'share' && <>
      <path d="m13 31 31 13 44-18-20 56-19-21-19 9Z" fill="#b2cbab"/><path d="m13 25 34 12 41-17-22 53-17-19-20 10Z" fill="#f3e2af"/><path d="m29 64 18-27 41-17-39 34Z" fill="#d9bf89"/>
      <path d="M18 77q-1-14 13-13" stroke="#8ca88a" strokeWidth="3" strokeDasharray="3 5"/>
    </>}
    {kind === 'badge' && <>
      <path d="m33 53-9 32 21-9 8 11 8-34" fill="#cf9d6a"/><path d="m48 54 5 33 12-12 17 5-15-30" fill="#ebc17e"/><path d="m50 12 10 6 12 2 4 12 6 10-6 11-4 12-12 3-10 6-11-6-12-3-3-12-7-11 7-10 3-12 12-2Z" fill="#8eaa7a"/>
      <circle cx="50" cy="43" r="22" fill="#f4dd9f"/><path d="m50 27 5 10 12 2-9 9 2 12-10-6-10 6 2-12-9-9 12-2Z" fill="#b58b4c"/>
    </>}
  </svg>;
}
