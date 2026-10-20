import { adjacent, occupied } from './boardGeometry';
import { boardCells, cellBit } from './placementDomains';
import { CAMP_REQUIREMENTS, campConnections } from './placementRules';
import type { SandboxDraft } from './mapBlueprint';
import type { Terrain, TerrainKind } from './types';

export const TERRAIN_LIMITS = {
  min: 7, normalMax: 13, max: 15, specialChance: .08,
  counts: { water: 4, forest: 5, mountain: 5 },
  component: 3, window3: 4, window4: 8,
  quadrantShare: .6, halfShare: .85, refinements: 1,
  omitChance: .08, reserveChance: .5,
  clusterBias: {min:-.2,range:1.8}, mixedAffinity:.8, jitter:{min:.8,range:1},
} as const;
const terrainWindows = [3,4].map(size => Array.from({length:(9-size)**2},(_,i) => {
  const r=Math.floor(i/(9-size)), c=i%(9-size);
  return Array.from({length:size*size},(_,j)=>(r+Math.floor(j/size))*8+c+j%size);
}));
const terrainBoard=boardCells(8);
const neighbors=terrainBoard.map(p=>terrainBoard.filter(q=>adjacent(p,q)).map(q=>q.r*8+q.c));
const memberships=terrainBoard.map((_,i)=>terrainWindows.map(group=>group.flatMap((cells,j)=>cells.includes(i)?[j]:[])));

// Build window counts once per frontier, not once per candidate or rejection.
// Used both by initial planning and the bounded answer-preserving refinement.
export function terrainPlacementScores(terrain: readonly Terrain[], kind: TerrainKind, budget: number) {
  if(terrain.length>=Math.min(budget,TERRAIN_LIMITS.max) || terrain.filter(t=>t.kind===kind).length>=TERRAIN_LIMITS.counts[kind]) return [];
  const grid:Array<TerrainKind|undefined>=Array(64).fill(undefined), quadrants=[0,0,0,0], halves=[0,0,0,0];
  for(const t of terrain) { grid[t.r*8+t.c]=t.kind; quadrants[(t.r>=4?2:0)+(t.c>=4?1:0)]++; halves[t.r<4?0:1]++; halves[t.c<4?2:3]++; }
  const counts=terrainWindows.map(group=>group.map(cells=>cells.reduce((n,c)=>n+Number(!!grid[c]),0)));
  return terrainBoard.flatMap(cell=>{
    const index=cell.r*8+cell.c, q=(cell.r>=4?2:0)+(cell.c>=4?1:0), h=cell.r<4?0:1, v=cell.c<4?2:3;
    if(grid[index] || quadrants[q]+1>Math.max(1,Math.floor(budget*TERRAIN_LIMITS.quadrantShare)) || halves[h]+1>Math.ceil(budget*TERRAIN_LIMITS.halfShare) || halves[v]+1>Math.ceil(budget*TERRAIN_LIMITS.halfShare)) return [];
    if(memberships[index].some((windows,w)=>windows.some(i=>counts[w][i]+1>(w===0?TERRAIN_LIMITS.window3:TERRAIN_LIMITS.window4)))) return [];
    const joined=new Set<number>(), queue=neighbors[index].filter(i=>grid[i]===kind);
    for(let i=0;i<queue.length;i++) {
      const next=queue[i]; if(joined.has(next)) continue; joined.add(next);
      if(joined.size>=TERRAIN_LIMITS.component) return [];
      queue.push(...neighbors[next].filter(j=>grid[j]===kind && !joined.has(j)));
    }
    const density=Math.max(...memberships[index][0].map(i=>counts[0][i]));
    return [{cell,score:-density*.35-quadrants[q]*.3-(halves[h]+halves[v])*.04+neighbors[index].filter(i=>!grid[i]).length*.15}];
  });
}

export function terrainDistribution(terrain: readonly Terrain[], regions = terrainRegions(terrain)) {
  const used=new Set(terrain.map(t=>t.r*8+t.c)), quadrants=[0,0,0,0], halves=[0,0,0,0];
  for (const t of terrain) { quadrants[(t.r>=4?2:0)+(t.c>=4?1:0)]++; halves[t.r<4?0:1]++; halves[t.c<4?2:3]++; }
  const windows=terrainWindows.map(group=>group.map(cells=>cells.reduce((n,c)=>n+Number(used.has(c)),0)));
  const violations:string[]=[];
  if (terrain.length>TERRAIN_LIMITS.max) violations.push('terrain total');
  if (regions.some(r=>r.count>TERRAIN_LIMITS.counts[r.kind] || r.largest>TERRAIN_LIMITS.component)) violations.push('terrain component or kind count');
  if (Math.max(...windows[0])>TERRAIN_LIMITS.window3 || Math.max(...windows[1])>TERRAIN_LIMITS.window4) violations.push('terrain local density');
  if (terrain.length>=TERRAIN_LIMITS.min && (Math.max(...quadrants)>Math.floor(terrain.length*TERRAIN_LIMITS.quadrantShare) || Math.max(...halves)>Math.ceil(terrain.length*TERRAIN_LIMITS.halfShare))) violations.push('terrain distribution');
  const imbalance=(Math.max(...quadrants)-Math.min(...quadrants))/Math.max(1,terrain.length);
  const halfImbalance=(Math.abs(halves[0]-halves[1])+Math.abs(halves[2]-halves[3]))/Math.max(1,terrain.length*2);
  return {quadrants,halves,max3:Math.max(...windows[0]),max4:Math.max(...windows[1]),imbalance,halfImbalance,violations};
}

export function terrainRegions(terrain: readonly Terrain[]) {
  return (['water', 'forest', 'mountain'] as TerrainKind[]).map(kind => {
    const cells = terrain.filter(t => t.kind === kind), remaining = new Set(cells.map(t => t.r * 8 + t.c));
    const sizes: number[] = [], compactness: number[] = [];
    while (remaining.size) {
      const queue = [remaining.values().next().value!]; remaining.delete(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const cell = { r: Math.floor(queue[i] / 8), c: queue[i] % 8 };
        for (const other of cells) if (remaining.has(other.r * 8 + other.c) && adjacent(cell, other)) { remaining.delete(other.r * 8 + other.c); queue.push(other.r * 8 + other.c); }
      }
      sizes.push(queue.length);
      const rows = queue.map(i => Math.floor(i / 8)), cols = queue.map(i => i % 8);
      compactness.push(queue.length / ((Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...cols) - Math.min(...cols) + 1)));
    }
    const height = Math.max(...cells.map(p => p.r)) - Math.min(...cells.map(p => p.r)) + 1;
    const width = Math.max(...cells.map(p => p.c)) - Math.min(...cells.map(p => p.c)) + 1;
    const branches = cells.filter(p => cells.filter(q => adjacent(p,q)).length > 2).length;
    const bends = cells.filter(p => { const neighbors = cells.filter(q => adjacent(p,q)); return neighbors.length === 2 && neighbors[0].r !== neighbors[1].r && neighbors[0].c !== neighbors[1].c; }).length;
    return { kind, compactness: cells.length ? cells.length / (height * width) : 0, patchCompactness: compactness.length ? compactness.reduce((s,v) => s+v,0) / compactness.length : 0, branches, bends,
      count: cells.length, components: sizes.length, largest: Math.max(0, ...sizes), singletons: sizes.filter(v => v === 1).length };
  });
}

type QualityConstraints = { disabled: readonly string[]; requireSingle: boolean; min: number; max: number; multi: number };
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
    const need = e.piece.kind === 'camp' || e.piece.kind === 'pool' ? 'water' : e.piece.kind === 'cabin' ? 'forest' : e.piece.kind === 'tower' ? 'mountain' : undefined;
    return need && e.cells.some(p => level.terrain.some(t => t.kind === need && adjacent(t, p)));
  }).length;
  const clueEntropy = clues.reduce((s,v) => { const frequency = clues.filter(c => c === v).length / clues.length; return s - Math.log2(frequency) / clues.length; }, 0);
  const naturalness = regions.reduce((s,r) => s + (r.kind === 'water' ? Math.min(2,r.bends) * .1 - r.branches * .25 : r.kind === 'forest' ? r.patchCompactness * .3 : (1-r.patchCompactness) * .3), 0);
  const violations: string[] = [];
  if (constraints) {
    violations.push(...distribution.violations);
    if (level.pieces.some(p => constraints.disabled.includes(`${p.kind}_${p.shape}`))) violations.push('disabled facility');
    if (constraints.requireSingle && !level.pieces.some(p => p.kind === 'camp' && p.shape === 'single')) violations.push('required single camp');
    if (level.pieces.length < constraints.min || level.pieces.length > constraints.max || level.pieces.filter(p => p.shape !== 'single').length < constraints.multi) violations.push('inventory');
  }
  if (grass.length < 8 || linked !== dependencies.length) violations.push('activity space or relationships');
  // Aesthetic metrics rank a fixed candidate batch. Legality, reasoning and
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
