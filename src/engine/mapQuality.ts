import { adjacent, occupied } from './boardGeometry';
import { boardCells, cellBit } from './placementDomains';
import { CAMP_REQUIREMENTS, campConnections } from './placementRules';
import type { SandboxDraft } from './mapBlueprint';

export { terrainRegions, terrainDistribution, terrainPlacementScores } from './terrainLayout';
import { terrainRegions, terrainDistribution } from './terrainLayout';
import { terrainRegistry } from './terrainRegistry';
import { TERRAIN_REQUIREMENTS } from './placementRules';
import { MAX_GENERATED_LINE_OCCUPANCY } from './generationConfig';

type QualityConstraints = { disabled: readonly string[]; requireSingle: boolean };
export function mapQuality(draft: SandboxDraft, constraints?: QualityConstraints) {
  const { level, placements } = draft, board = boardCells(8), regions = terrainRegions(level.terrain);
  const distribution=terrainDistribution(level.terrain,regions);
  const entries = placements.map(at => { const piece = level.pieces.find(p => p.id === at.id)!; return { piece, cells: occupied(piece, at) }; });
  const used = entries.flatMap(e => e.cells), blocked = [...level.terrain, ...used];
  const mask = blocked.reduce((m, p) => m | cellBit(p), 0n);
  const grass = board.filter(p => !(mask & cellBit(p)));
  const effectiveGrass = grass.filter(p => grass.some(q => adjacent(p, q))).length;
  const dependencies = entries.filter(e => CAMP_REQUIREMENTS[e.piece.kind]);
  const linked = dependencies.filter(e => campConnections(e.piece.kind, e.cells, board, blocked).some(link => entries.some(c => c.piece.kind === 'camp' && c.cells.some(p => p.r === link.camp.r && p.c === link.camp.c)))).length;
  const quadrants = [0, 0, 0, 0], grassQuadrants = [0, 0, 0, 0];
  const quadrant = (p: {r:number;c:number}) => (p.r >= 4 ? 2 : 0) + (p.c >= 4 ? 1 : 0);
  for (const p of used) quadrants[quadrant(p)]++;
  for (const p of grass) grassQuadrants[quadrant(p)]++;
  const terrainCount = level.terrain.length;
  const concentration = Math.max(...[0, 1, 2, 3].map(q => level.terrain.filter(p => quadrant(p) === q).length)) / Math.max(1, terrainCount);
  const kinds = new Set(level.pieces.map(p => p.kind)), shapes = new Set(level.pieces.map(p => `${p.kind}_${p.shape}`));
  const campShapes = new Set(level.pieces.filter(p => p.kind === 'camp').map(p => p.shape)).size;
  const maxSameKind = Math.max(0, ...[...kinds].map(kind => level.pieces.filter(p => p.kind === kind).length));
  const clues = [...level.rows, ...level.cols], clueVariety = new Set(clues).size;
  const terrainLinks = entries.filter(e => {
    const need = TERRAIN_REQUIREMENTS[e.piece.kind];
    return need && e.cells.some(p => level.terrain.some(t => t.kind === need && adjacent(t, p)));
  }).length;
  const clueEntropy = clues.reduce((s,v) => { const frequency = clues.filter(c => c === v).length / clues.length; return s - Math.log2(frequency) / clues.length; }, 0);
  const naturalness = regions.reduce((s,r) => s + r.patchCompactness * (terrainRegistry.find(t=>t.id===r.kind)?.compactnessBias??0) - r.branches*.2, 0);
  const violations: string[] = [...distribution.violations];
  if (clues.some(value => value > MAX_GENERATED_LINE_OCCUPANCY)) violations.push('line occupancy');
  if (constraints) {
    if (level.pieces.some(p => constraints.disabled.includes(`${p.kind}_${p.shape}`))) violations.push('disabled facility');
    if (constraints.requireSingle && !level.pieces.some(p => p.kind === 'camp' && p.shape === 'single')) violations.push('required single camp');
  }
  if (grass.length < 8 || linked !== dependencies.length) violations.push('activity space or relationships');
  // Aesthetic metrics rank available candidates. Legality, reasoning and
  // uniqueness are verified separately; they cannot be compensated by a score.
  const score = naturalness + clueEntropy * .2 + kinds.size * .7 + shapes.size * .3 + campShapes * .65 + clueVariety * .2 + terrainLinks / Math.max(1, entries.length)
    + grassQuadrants.filter(v => v > 0).length * .3 + effectiveGrass / Math.max(1, grass.length)
    - concentration * 2 - maxSameKind / Math.max(1, entries.length) * 3
    - distribution.imbalance - distribution.halfImbalance - Math.max(0,distribution.max3-3)*.2
    - Math.max(0,regions.reduce((s,r)=>s+r.singletons,0)/Math.max(1,terrainCount)-.75);
  return { regions, distribution, terrainCount, grass: grass.length, effectiveGrass,
    fragmentation: regions.reduce((s, r) => s + Math.max(0, r.components - 1), 0),
    concentration, maxSameKind, kinds: kinds.size, shapes: shapes.size, campShapes, terrainLinks, clueVariety,
    maxLine: Math.max(...clues), quadrants, grassQuadrants, linked, dependencies: dependencies.length,
    score, naturalness, clueEntropy, violations, accepted: !violations.length,
  };
}
