// Local assets only. Vite emits files rather than Base64 strings.
const files = import.meta.glob<string>(['./**/*.svg', '!./survival-badges/*.svg', './backgrounds/*.webp', './panels/*.webp', './branding/*.png'], { eager: true, query: '?url', import: 'default' });
const asset = (path: string) => files[`./${path}`];
const svg = (path: string) => asset(`${path}.svg`);

export const art = {
  branding: { zh: asset('branding/logo-zh.png'), en: asset('branding/logo-en.png') },
  backgrounds: {
    home: asset('backgrounds/home-woodland.webp'), portrait: asset('backgrounds/home-woodland-portrait.webp'),
    diary: asset('backgrounds/camp-diary.webp'), survival: asset('backgrounds/wilderness-survival.webp'),
    chapters: [0, 1, 2].map(i => svg(`backgrounds/chapter-${i}`)),
  },
  chapters: [0, 1, 2].map(i => ({ base: svg(`illustrations/chapter-${i}`), cloud: svg(`illustrations/chapter-${i}-cloud`), ripples: svg(`illustrations/chapter-${i}-ripples`) })),
  journal: Array.from({ length: 45 }, (_, i) => svg(`illustrations/journal-${String(i + 1).padStart(2, '0')}`)),
  illustration: (kind: 'adventure' | 'sandbox') => svg(`illustrations/${kind}`),
  object: (kind: string) => svg(`objects/${kind}`),
  menuIcon: (kind: string) => svg(`icons/menu-${kind}`),
  toolIcon: (kind: string) => svg(`icons/tool-${kind}`),
  survivalBadge: (path: string) => svg(path),
  hero: svg('illustrations/hero-island'),
  survivalFacilities: asset('panels/survival-facilities.webp'),
  decoration: (name: string) => svg(`decorations/${name}`),
  completion: svg('achievements/completion-landscape'),
  reward: { difficulty: svg('achievements/challenge-difficulty'), count: svg('achievements/challenge-count'), leaf: svg('progress/xp-leaf') },
};
