Local display fonts for short labels and headings; paragraphs retain the existing body font.
`fonts.css` assigns Lilita One / ZCOOL KuaiLe to page headings, localized menu labels,
and legible display numbers. Small controls, settings and rules use the body stack.
The field notebook and Survival record sheet use locally bundled Ma Shan Zheng
for Chinese handwriting and Caveat for Latin handwriting.
The local LXGW WenKai supplement supplies characters missing from Ma Shan Zheng,
including 瞭. The Chinese font and supplement are stored as WOFF2.

The bilingual home logo uses the local `branding/logo-zh.png` and `branding/logo-en.png`
images. `ui/components/TitleArtwork.tsx` animates their decorations independently
of these fonts.

- ZCOOL KuaiLe: https://github.com/google/fonts/tree/main/ofl/zcoolkuaile
- Lilita One: https://github.com/google/fonts/tree/main/ofl/lilitaone
- Ma Shan Zheng: https://github.com/google/fonts/tree/main/ofl/mashanzheng
- Caveat: https://github.com/google/fonts/tree/main/ofl/caveat
- LXGW WenKai: https://github.com/lxgw/LxgwWenKai

Font files are bundled under SIL Open Font License 1.1. Ma Shan Zheng is converted
to WOFF2, and the LXGW WenKai supplement contains only the missing characters.
License files and the Lilita FONTLOG are in `public/font-licenses/` so they are
included in Web and native builds. No font service is contacted at runtime.
