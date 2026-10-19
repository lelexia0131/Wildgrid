import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

// Retain the original illustration and apply metal only to its own trim,
// engraving and hardware. No shared frame or whole-image colour transform.
const trims = {
  newcomer: ['#75563d', '#e9c493', '#805d42', '#674f37', '#c7a37a'],
  apprentice: ['#7a4d40', '#f0c4a0', '#5d6656', '#edcd9b', '#405b4c', '#e0dbad', '#8c684e'],
  explorer: ['#896846', '#9b774a', '#f2d498', '#f3dba6', '#e8d59e', '#765d3f'],
  veteran: ['#41626a', '#edf0dc', '#54777a', '#c3d3b8'],
  legend: ['#b4874a', '#9a7446', '#8b6847', '#a78452', '#947047', '#c6b394'],
};
const metals = {
  bronze: ['#f0c397', '#bc8052', '#f3d3ab', '#96603f', '#704a36'],
  silver: ['#f4f6ec', '#a5b8bc', '#ffffff', '#718b99', '#506774'],
  gold: ['#ffe8aa', '#d4a653', '#fff1c6', '#b27d37', '#815932'],
};
mkdirSync('src/assets/survival-ranks', { recursive: true });
for (const [identity, strokes] of Object.entries(trims)) for (const [metal, colors] of Object.entries(metals)) {
  let svg = readFileSync(`src/assets/survival-badges/${identity}.svg`, 'utf8');
  const stops = colors.slice(0, 4).map((color, i) => `<stop offset="${[0, .35, .51, 1][i]}" stop-color="${color}"/>`).join('');
  svg = svg.replace('<defs>', `<defs><linearGradient id="metal" x1="40" y1="30" x2="180" y2="190" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
  for (const color of strokes) svg = svg.replaceAll(`stroke="${color}"`, 'stroke="url(#metal)"');
  if (identity === 'explorer') svg = svg.replaceAll('url(#brass)', 'url(#metal)');
  if (identity === 'veteran') svg = svg.replaceAll('url(#silver)', 'url(#metal)').replace('fill="#bfd0c5"', 'fill="url(#metal)"');
  if (identity === 'legend') svg = svg.replaceAll('url(#gold)', 'url(#metal)');
  // Hardware and engraved acorn cap stay distinct from the leaves and seed.
  if (identity === 'newcomer') svg = svg.replace('fill="#947050"', 'fill="url(#metal)"');
  if (identity === 'apprentice') svg = svg.replaceAll('fill="#a5af80"', 'fill="url(#metal)"');
  svg = svg.replace('<svg ', `<svg data-identity="${identity}" data-metal="${metal}" `);
  writeFileSync(`src/assets/survival-ranks/${identity}-${metal}.svg`, svg);
}
