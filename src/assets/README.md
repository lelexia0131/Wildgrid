# Wildgrid art assets

Game art is loaded from the local package. The home cover uses the looping 3D render in `3d/scenes/home-motion.webp` and a still frame for reduced motion. The flat board and blueprint use their own glyphs. The journal, manual and facility tray use the model-derived artwork in both board views. Image component references are centralized in `art.ts`; CSS texture and nine-slice references are centralized in `art.css`. Vite's `assetsInlineLimit` is zero, so small SVGs remain separate files in the build.

See [audio credits and playback](audio/README.md), [font sources and licenses](fonts/README.md), and the [survival panel provenance](panels/survival-facilities.md). These records and bundled license files are required resources, not disposable build notes.

Replace an existing image **at the same path**, keeping its viewBox, transparent margins, and layer alignment. Rebuild the game; no business TSX change is needed. Do not add device fonts, linked images, Base64 data, scripts, or remote URLs inside SVGs.

| Folder | Use |
| --- | --- |
| `3d` | Playable GLB libraries, material textures, transparent model icons and level scenes. Authoring files, sources, controls and QA are documented in [the miniature camp guide](../../docs/3d/README.md). |
| `branding` | `logo-zh.png` (2079×756), `logo-en.png` (1774×887), and the title flame displacement map |
| `backgrounds` | Existing home/diary/survival WebPs, three chapter landscapes, quiet washes and vignettes |
| `illustrations` | 45 `journal-01`–`journal-45` covers, chapter layers, hero island, two mode illustrations |
| `objects` | Single-cell facility/terrain artwork and separated tree/fire animation parts |
| `icons` | Illustrated menu and camp tool icons |
| `survival-badges` | Five source badges used by `scripts/build-survival-badges.mjs`; excluded from the runtime registry |
| `survival-ranks` | Fifteen bronze, silver and gold rank badges used in the game |
| `achievements` | Completion scenery, check medallion, difficulty and clear-count marks |
| `progress` | XP frame/fills, cursor leaf, generation stripe |
| `panels` | Reusable panel skins, notebook cover/edge and ruled paper |
| `decorations` | Clouds, bird, sprigs, binding rings, ribbon, grass and completion animation layers |

Most panels use 96×96 SVGs with a **16-unit nine-slice margin**. Keep important corner/edge features within that margin; the plain center can stretch. `xp-frame.svg` uses 96×32 with a 12-unit slice. Ruled paper tiles at its natural 64×64 size. Icons, lettering and illustrations use `object-fit: contain`; backgrounds intentionally use `cover`.

The full-size animation overlays share their base's viewBox. Do not trim their transparent canvas. Tree trunks/logs remain still while crown/flame image layers animate. Water dashes, board geometry, tutorial focus, placement feedback, particles and XP growth remain in code because they respond to state or time.

Run `node scripts/audit-art.mjs` to decode every image, check SVG references and regenerate the ignored `.desktop-smoke/art-inventory.json`.
