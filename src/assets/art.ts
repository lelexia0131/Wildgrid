// Local assets only. Vite emits files rather than Base64 strings.
const files = import.meta.glob<string>(['./objects/*.svg', './backgrounds/home-woodland*.webp', './icons/*.svg', './survival-ranks/*.svg', './achievements/challenge-*.svg', './progress/xp-leaf.svg', './panels/survival-facilities.webp', './branding/*.png', './3d/icons/*.webp', './3d/scenes/*.webp'], { eager: true, query: '?url', import: 'default' });
const asset = (path: string) => files[`./${path}`];
const svg = (path: string) => asset(`${path}.svg`);
const defaultModel: Record<string,string> = {forest:'forest_0',rock:'rock_0',water:'water',anchor:'anchor',cloud:'cloud_0',cabin:'cabin_el',picnic:'picnic_domino',airship:'airship_domino',kite:'kite_long'};

export const art = {
  modelIcon: (kind:string, shape?:string, rotation=0, plan=false) => {
    const id=defaultModel[kind] || kind+'_single';
    return asset(`3d/icons/${kind}_${shape}-${rotation%4}${plan && shape!=='single'?'-plan':''}.webp`) || asset(`3d/icons/${id}-0.webp`);
  },
  modelScene: (name:string) => asset(`3d/scenes/${name}.webp`),


  backgrounds:{home:asset('backgrounds/home-woodland.webp'),portrait:asset('backgrounds/home-woodland-portrait.webp')},
  branding: { zh: asset('branding/logo-zh.png'), en: asset('branding/logo-en.png') },
  object: (kind: string) => svg(`objects/${kind}`),
  menuIcon: (kind: string) => svg(`icons/menu-${kind}`),
  toolIcon: (kind: string) => svg(`icons/tool-${kind}`),
  survivalBadge: (path: string) => svg(path),
  survivalFacilities: asset('panels/survival-facilities.webp'),
  reward: { difficulty: svg('achievements/challenge-difficulty'), count: svg('achievements/challenge-count'), leaf: svg('progress/xp-leaf') },
};
