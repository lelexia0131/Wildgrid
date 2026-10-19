# Wildgrid art assets

All art ships locally. Image component references are centralized in `art.ts`; CSS texture and nine-slice references are centralized in `art.css`. Vite's `assetsInlineLimit` is zero, so small SVGs remain separate files in the build.

Replace an existing image **at the same path**, keeping its viewBox, transparent margins, and layer alignment. Rebuild the game; no business TSX change is needed. Do not add device fonts, linked images, Base64 data, scripts, or remote URLs inside SVGs.

| Folder | Use |
| --- | --- |
| `branding` | `logo-zh.svg` (600×260), `logo-en.svg` (880×190), shared text-free `title-sign.svg` (720×330) |
| `backgrounds` | Existing home/diary/survival WebPs, three chapter landscapes, quiet washes and vignettes |
| `illustrations` | 45 `journal-01`–`journal-45` covers, chapter layers, hero island, two mode illustrations |
| `objects` | Single-cell facility/terrain artwork and separated tree/fire animation parts |
| `icons` | Illustrated menu and camp tool icons |
| `survival-badges` | Five existing rank badges, preserved |
| `achievements` | Completion scenery, check medallion, difficulty and clear-count marks |
| `progress` | XP frame/fills, cursor leaf, generation stripe |
| `panels` | Reusable panel skins, notebook cover/edge and ruled paper |
| `decorations` | Clouds, bird, sprigs, binding rings, ribbon, grass and completion animation layers |

Most panels use 96×96 SVGs with a **16-unit nine-slice margin**. Keep important corner/edge features within that margin; the plain center can stretch. `xp-frame.svg` uses 96×32 with a 12-unit slice. Ruled paper tiles at its natural 64×64 size. Icons, lettering and illustrations use `object-fit: contain`; backgrounds intentionally use `cover`.

The full-size animation overlays share their base's viewBox. Do not trim their transparent canvas. Tree trunks/logs remain still while crown/flame image layers animate. Water dashes, board geometry, tutorial focus, placement feedback, particles and XP growth remain in code because they respond to state or time.

`wildgrid-zh.webp` and `wildgrid-en.webp` are retained previous designs for comparison only. They are not registered or bundled. Existing backgrounds and rank badges are reused rather than redrawn.

Run `node scripts/audit-art.mjs` to decode every image, check SVG references and regenerate `reports/art-inventory.json`. See `reports/art-refactor.md` for the migration and validation record.
