import { Art } from './Art';
import { facilityNames, terrainNames } from '../../engine';
import type { FacilityKind, TerrainKind } from '../../engine';
import type { MapIconId } from '../../game-modes/sandbox/mapIcons';

export function MenuIcon({ kind }: { kind: MapIconId | 'check' | 'share' | 'edit' | 'badge' | 'archive' | 'resume' | 'tools' | 'difficulty' | 'overview' | 'clues' | 'rotate' | 'settings' }) {
  if (kind in facilityNames || kind in terrainNames) return <Art kind={kind as FacilityKind | TerrainKind}/>;
  return <svg className="art menu-icon" data-icon={kind} viewBox="0 0 100 100" fill="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
    {!['adventure', 'survival', 'sandbox', 'maps'].includes(kind) && <ellipse cx="50" cy="87" rx="36" ry="6" fill="#526d4820"/>}
    {kind === 'adventure' && <>
      <path d="M45 18v68" stroke="#b69461" strokeWidth="9"/><path d="M43 19v65" stroke="#efd4a0" strokeWidth="3"/>
      <path d="M17 20h54l14 13-14 13H17Z" fill="#557d60"/><path d="M19 22h51l10 11-10 10H19Z" fill="#a8c791"/><path d="M28 33h33m-7-6 7 6-7 6" stroke="#f9edca" strokeWidth="4"/>
      <path d="M73 49H28L15 61l13 12h45Z" fill="#c6a16a"/><path d="M72 52H29L19 61l10 9h43Z" fill="#f0d397"/><path d="M37 61h27" stroke="#a08050" strokeWidth="3"/>
      <path d="M33 86h25m12 0 5-14 5 14m-65 0 3-8 4 8" stroke="#75976c" strokeWidth="4"/><ellipse cx="45" cy="88" rx="32" ry="4" fill="#526d4820"/>
    </>}
    {kind === 'survival' && <>
      <path d="m21 76 53-50" stroke="#a38964" strokeWidth="13"/><path d="m22 72 51-48" stroke="#ead4a5" strokeWidth="5"/><path d="m68 28 16-16 6 6-17 16Z" fill="#739381"/>
      <path d="m18 37 18-17 23 20-19 19Z" fill="#a8b8aa"/><path d="m18 37 18-17 8 7-18 19Z" fill="#e4e8ce"/><path d="m40 58 8-8 28 27-8 8Z" fill="#b5885b"/><path d="m45 55 25 24" stroke="#e5bf8a" strokeWidth="3"/>
      <path d="M16 17v8m-4-4h8m37-9-4 7m8-3-8 3m28 34-7 3" stroke="#e3b764" strokeWidth="3"/><path d="m23 84 15-2m37 6 9-3" stroke="#779471" strokeWidth="4"/>
    </>}
    {kind === 'sandbox' && <>
      <path d="m10 66 39-19 41 19-40 22Z" fill="#5f8a77"/><path d="m10 60 39-19 41 19-40 22Z" fill="#a2c9b9"/><path d="M10 60v6l40 22v-6m40-22v6" stroke="#5f8a77" strokeWidth="2"/>
      <path d="m23 49 19-9 17 9-18 10Z" fill="#f0d493"/><path d="M23 49v14l18 10V59m18-10v14L41 73" fill="#c3a56c"/><path d="m23 49 18 10 18-10" stroke="#fae8b5" strokeWidth="2"/>
      <path d="m58 41 13-7 13 7-13 7Z" fill="#b6d6aa"/><path d="M58 41v12l13 7V48m13-7v12l-13 7" fill="#74996b"/>
      <g transform="rotate(32 55 25)"><path d="M49 8h12v31l-6 12-6-12Z" fill="#edc16f"/><path d="M49 8h4v31h-4Z" fill="#fff0bb"/><path d="m49 39 6 12 6-12" fill="#dec99b"/><path d="m52 46 3 5 3-5Z" fill="#426954"/><rect x="49" y="7" width="12" height="8" rx="2" fill="#749ca4"/></g>
    </>}
    {kind === 'maps' && <>
      <path d="m13 26 22-8 28 10 22-8v56l-22 8-28-10-22 8Z" fill="#c2ab81"/><path d="m13 21 22-8 28 10 22-8v55l-22 8-28-10-22 8Z" fill="#f3e5bc"/><path d="M35 13v55m28-45v55" stroke="#d7be8e" strokeWidth="2"/>
      <path d="m17 41 8-6 8 6m11 9 8-11 9 12m5-11 8-7 8 6" stroke="#93af85" strokeWidth="3"/><path d="M23 59q15-19 25 2t29-9" stroke="#ad9567" strokeWidth="2" strokeDasharray="3 5"/>
      <path d="M59 40q0-14 13-14t13 14c0 9-13 20-13 20S59 49 59 40Z" fill="#ae7868"/><circle cx="72" cy="39" r="6" fill="#fae3b5"/>
    </>}
    {kind === 'edit' && <>
      <g transform="rotate(-8 47 52)"><rect x="12" y="19" width="62" height="65" rx="8" fill="#bd965f"/><rect x="12" y="15" width="62" height="65" rx="8" fill="#e4c88d"/><rect x="20" y="23" width="46" height="49" rx="4" fill="#f8efcf"/><path d="M35 23v49m15-49v49M20 39h46m-46 16h46" stroke="#c7d5ac" strokeWidth="2"/><path d="m26 64 10-17 13 12 9-23" stroke="#83a080" strokeWidth="3"/></g>
      <g transform="rotate(25 78 47)"><path d="M72 12h13v57l-6 15-7-15Z" fill="#efbf65"/><path d="M72 12h5v57h-5Z" fill="#ffe6a6"/><path d="m72 69 7 15 6-15Z" fill="#e5cb9b"/><path d="m76 78 3 6 3-6Z" fill="#4e6653"/><rect x="72" y="9" width="13" height="10" rx="3" fill="#7ca5a4"/></g>
    </>}
    {kind === 'archive' && <><rect x="16" y="29" width="68" height="51" rx="5" fill="#96af83"/><path d="M18 43h64v33H18Z" fill="#c1d2a0"/><rect x="12" y="26" width="76" height="17" rx="4" fill="#6e8c67"/><rect x="36" y="50" width="28" height="15" rx="3" fill="#f1dfae"/><path d="M42 57h16" stroke="#ad996d" strokeWidth="3"/><path d="m26 25-3-12 48-4 2 16" fill="#f4e8c6"/><path d="m33 20 9-4 11 5 10-5" stroke="#a6b793" strokeWidth="2"/></>}
    {kind === 'resume' && <><circle cx="50" cy="48" r="33" fill="#9fb78c"/><circle cx="50" cy="48" r="26" fill="#f6e6ba"/><path d="M50 30v19l14 8" stroke="#779370" strokeWidth="4"/><path d="m42 11 8-6 8 6" stroke="#b59660" strokeWidth="4"/><path d="M72 66v22l18-11Z" fill="#668d73"/></>}
    {kind === 'tools' && <><path d="m21 27 14-8 10 15-14 8Z" fill="#a7b9a1"/><path d="m35 36 36 41" stroke="#c1a06b" strokeWidth="10"/><path d="m31 23 4-4 10 15-4 4" fill="#d7dfc5"/><path d="m28 79 40-49" stroke="#729482" strokeWidth="9"/><path d="m62 32 7-17 12 5-5 17Z" fill="#e4c28a"/></>}
    {kind === 'difficulty' && <><path d="M16 78V63h17v15m9 0V45h17v33m9 0V23h17v55" fill="#adc69a" stroke="#6f926b" strokeWidth="3"/><path d="m16 44 26-20 17 3 22-17" stroke="#cba65f" strokeWidth="4"/><path d="m71 9 11-1-2 12" stroke="#cba65f" strokeWidth="4"/></>}
    {kind === 'overview' && <><path d="M16 19h68v62H16Z" fill="#97ac85"/><path d="M21 24h58v52H21Z" fill="#e5edcf"/><path d="M40 24v52m20-52v52M21 41h58m-58 18h58" stroke="#c1d0a4" strokeWidth="3"/><path d="m30 50 10 10 28-29" stroke="#74946c" strokeWidth="7"/></>}
    {kind === 'clues' && <><path d="M15 25h19m-19 15h19m-19 15h19M45 25h19m-19 15h19" stroke="#d4ad57" strokeWidth="6"/><circle cx="69" cy="65" r="22" fill="#e2eaca" stroke="#779775" strokeWidth="4"/><path d="m58 66 8 8 15-18" stroke="#74946c" strokeWidth="5"/></>}
    {kind === 'rotate' && <><path d="M74 29a30 30 0 1 0 4 37" stroke="#a6b889" strokeWidth="7"/><path d="m72 12 7 21-22-3" fill="#e8c98e"/><path d="M36 35h14v14h14v14H36Z" fill="#d8b16c"/><path d="M40 39h6v13h14v7H40Z" fill="#f7e3ae"/></>}
    {kind === 'settings' && <><path d="M22 16v66m28-66v66m28-66v66" stroke="#a3b992" strokeWidth="6"/><rect x="11" y="29" width="22" height="14" rx="4" fill="#e9c88b"/><rect x="39" y="57" width="22" height="14" rx="4" fill="#7ca593"/><rect x="67" y="20" width="22" height="14" rx="4" fill="#d6b48c"/><path d="M17 34h10m18 28h10m18-37h10" stroke="#f7edc9" strokeWidth="2"/></>}
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
