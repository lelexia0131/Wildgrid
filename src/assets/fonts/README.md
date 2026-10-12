Local display fonts for short labels and headings; paragraphs retain the existing body font.
`fonts.css` assigns Lilita One / ZCOOL KuaiLe to page headings, localized menu labels,
and legible display numbers. Small controls, settings and rules use the body stack.
No additional font files are needed for the visual refresh.

The bilingual home logo in `components/GameTitle.tsx` is original SVG path lettering,
drawn for Wildgrid (not outlines extracted from these or other fonts). Both versions
share carved edges, warm painted faces, wood-grain marks and a leaf sprig.

- ZCOOL KuaiLe: https://github.com/google/fonts/tree/main/ofl/zcoolkuaile
- Lilita One: https://github.com/google/fonts/tree/main/ofl/lilitaone

Unmodified font files are bundled under SIL Open Font License 1.1. License files and the Lilita FONTLOG are in `public/font-licenses/` so they are included in Web and native builds. No font service is contacted at runtime.
