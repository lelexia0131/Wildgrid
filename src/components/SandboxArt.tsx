export function SandboxArt({ variant }: { variant: 'adventure' | 'sandbox' }) {
  return <svg className="sandbox-illustration" viewBox="0 0 560 460" fill="none" aria-hidden="true">
    <ellipse cx="287" cy="391" rx="211" ry="29" fill="#dbe2cf"/>
    {variant === 'adventure' ? <>
      <path d="M104 315C48 232 101 117 198 96c87-19 102 42 175 40 69-3 123 71 88 153-36 85-287 111-357 26Z" fill="#e7ebd9"/>
      <circle cx="128" cy="106" r="24" fill="#ead5a0"/>
      <path d="m77 236 58-87 57 87Z" fill="#e7bb68"/><path d="m135 149 15 87h42Z" fill="#f4d995"/><path d="m135 182-28 54h42Z" fill="#61785a"/>
      <path d="m130 144 10 11m-11 0 9-11m-65 96h123" stroke="#9b8760" strokeWidth="4" strokeLinecap="round"/>
      <ellipse cx="328" cy="357" rx="85" ry="12" fill="#798d6b26"/>
      <path d="M293 118v-14c0-25 50-25 50 0v14" stroke="#a78c61" strokeWidth="12"/>
      <path d="M264 158c-15-15-28-4-27 21l6 119c1 18 12 26 24 21m110-161c15-15 28-4 27 21l-6 119c-1 18-12 26-24 21" stroke="#486b55" strokeWidth="11"/>
      <rect x="252" y="119" width="139" height="222" rx="42" fill="#718b62"/>
      <path d="M367 129c15 9 24 25 24 49v122c0 23-12 40-34 41V132Z" fill="#5b7954"/>
      <path d="M260 129c19-22 105-23 124 0l-8 72c-30 13-72 13-103 0Z" fill="#91a276"/>
      <path d="M280 200v-56m70 56v-56" stroke="#c3ba86" strokeWidth="11"/>
      <rect x="269" y="197" width="23" height="13" rx="4" fill="#d9c28c"/><rect x="338" y="197" width="23" height="13" rx="4" fill="#d9c28c"/>
      <rect x="271" y="238" width="100" height="76" rx="17" fill="#a0ad7c"/>
      <path d="M281 253h80" stroke="#cad0a0" strokeWidth="4" strokeLinecap="round"/>
      <path d="m318 270-14 22h28Z" fill="#ded49e"/>
      <g transform="rotate(-8 161 315)">
        <path d="m74 262 63-14 65 14 63-14v110l-63 14-65-14-63 14Z" fill="#d4c69d"/>
        <path d="m74 255 63-14 65 14 63-14v110l-63 14-65-14-63 14Z" fill="#f5edcf"/>
        <path d="m137 241 65 14v110l-65-14Z" fill="#e5dfbb"/>
        <path d="M84 280c34-31 46-3 65 5s55-29 78-16 21 55 5 76" stroke="#aac1a2" strokeWidth="13"/>
        <path d="M92 345c-4-25 29-37 52-32s19 23 39 17 14-35 42-35" stroke="#bd9b65" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round"/>
        <path d="m113 285-13 20h27m70 36-12 19h26" stroke="#7e9671" strokeWidth="3" strokeLinejoin="round"/>
        <circle cx="224" cy="294" r="7" fill="#cc9a63"/><circle cx="224" cy="294" r="3" fill="#f4e6bc"/>
      </g>
      <g transform="rotate(15 411 335)">
        <path d="M404 287v-13h15v13" stroke="#b49b67" strokeWidth="5"/>
        <circle cx="411" cy="335" r="50" fill="#b9a06d"/><circle cx="411" cy="332" r="46" fill="#e7cf92"/><circle cx="411" cy="332" r="36" fill="#f7edcb"/>
        <path d="m411 303 12 29-12 29-12-29Z" fill="#587b65"/><path d="m411 303 12 29h-12Z" fill="#86a38a"/><path d="m411 361-12-29h12Z" fill="#c0caae"/>
        <path d="M382 332h7m44 0h7m-29-30v7m0 45v7" stroke="#bcaf83" strokeWidth="2"/>
        <circle cx="411" cy="332" r="4" fill="#d1b36f"/>
      </g>
      <path d="M464 246v38m-30-24 30-64 30 64Zm5-28 25-58 25 58Z" fill="#597c61"/><path d="M460 252v27" stroke="#a98e5c" strokeWidth="8" strokeLinecap="round"/>
      <path d="m104 385 3-9m7 12 3-7m333 5 3-9" stroke="#95aa7e" strokeWidth="3" strokeLinecap="round"/>
    </> : <>
      <path d="M99 280c-23-81 30-178 128-183 72-4 100 44 146 36 84-15 151 86 94 174-52 81-321 112-368-27Z" fill="#e6ebd8"/>
      <g transform="rotate(-9 280 236)">
        <rect x="130" y="128" width="288" height="260" rx="19" fill="#b89462"/>
        <rect x="119" y="114" width="288" height="260" rx="19" fill="#d6b784"/>
        <path d="M134 128h258m-258 230h258" stroke="#ecd5aa" strokeWidth="4" strokeLinecap="round"/>
        <path d="M140 137h238m-233 104h21m164 105h55" stroke="#c4a372" strokeWidth="3" strokeLinecap="round"/>
        <rect x="141" y="140" width="244" height="210" rx="11" fill="#8da375"/>
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={149 + i % 3 * 77} y={148 + Math.floor(i / 3) * 66} width="70" height="59" rx="5" fill={i === 3 ? '#bad4cc' : i === 4 ? '#becfa3' : '#d3ddb5'}/>)}
        <path d="m164 192 20-35 22 35Z" fill="#adad91"/><path d="m184 157 22 35h-17Z" fill="#8d947d"/><path d="m177 169 7-12 8 13-8-4Z" fill="#efecd6"/>
        <path d="M165 230c-18 0-16 31 5 31 11 0 28 7 35-8 7-16-9-26-20-24-10 2-7 1-20 1Z" fill="#8cbabe"/><path d="m168 238 8 2m12 10 8-2" stroke="#dae7d9" strokeWidth="3" strokeLinecap="round"/>
        <path d="M260 255v12" stroke="#9d8456" strokeWidth="6"/><path d="m237 256 23-43 25 43Z" fill="#52785f"/><path d="m243 238 17-32 18 32Z" fill="#6e9172"/>
        <path d="m244 320 17-35 19 35Z" fill="#dfae59"/><path d="m261 285 19 35h-15Z" fill="#f4d48d"/><path d="m261 300-8 20h13Z" fill="#55765a"/>
        <path d="m244 322 37 1" stroke="#a38a5f" strokeWidth="3" strokeLinecap="round"/>
        <path d="M336 284v32m-22-16 23-33 22 33Z" fill="#779571"/><path d="M336 314v10" stroke="#a58d5d" strokeWidth="5"/>
      </g>
      <g transform="rotate(24 438 214)">
        <path d="M429 122h22v170l-11 29-11-29Z" fill="#e8c273"/><path d="M429 122h7v171h-7Z" fill="#f4d892"/><path d="M446 122h5v171h-5Z" fill="#bf9957"/>
        <path d="m429 293 11 28 11-28Z" fill="#ead6ae"/><path d="m436 310 4 11 4-11Z" fill="#5d7056"/>
        <rect x="429" y="113" width="22" height="19" rx="4" fill="#bdc8a4"/><path d="M429 133h22" stroke="#92a083" strokeWidth="5"/>
      </g>
      <g transform="rotate(10 100 333)">
        <rect x="62" y="274" width="87" height="110" rx="7" fill="#c7bd91"/><rect x="56" y="267" width="87" height="110" rx="7" fill="#f4edcf"/>
        <path d="M72 285h53m-53 18h22m15 0h17m-54 18h53m-53 18h33" stroke="#b9c59d" strokeWidth="3" strokeLinecap="round"/>
        <path d="m111 342 15 15-15 15" stroke="#8a9f77" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <g transform="rotate(14 397 352)">
        <rect x="356" y="331" width="121" height="28" rx="5" fill="#c9b27a"/><rect x="350" y="324" width="121" height="28" rx="5" fill="#ead29c"/>
        <path d="M363 325v10m15-10v6m15-6v10m15-10v6m15-6v10m15-10v6m15-6v10" stroke="#b39b63" strokeWidth="2"/>
      </g>
      <g transform="rotate(13 199 77)"><rect x="166" y="44" width="64" height="61" rx="8" fill="#8da276"/><rect x="166" y="38" width="64" height="61" rx="8" fill="#ccdab0"/><path d="m180 78 18-28 18 28Z" fill="#6f9170"/><path d="M198 78v10" stroke="#a58a56" strokeWidth="5" strokeLinecap="round"/></g>
      <circle cx="414" cy="83" r="11" fill="#e4ca86"/><path d="m448 361 7-6m-8 22 9-4m-282 8 3-9" stroke="#93a67e" strokeWidth="3" strokeLinecap="round"/>
    </>}
  </svg>;
}
