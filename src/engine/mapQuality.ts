import { adjacent, occupied } from './boardGeometry';
import { boardCells, cellBit } from './placementDomains';
import { CAMP_REQUIREMENTS, campConnections } from './placementRules';
import type { SandboxDraft } from './mapBlueprint';
import type { Terrain, TerrainKind } from './types';

export function terrainRegions(terrain: readonly Terrain[]) {
  return (['water', 'forest', 'mountain'] as TerrainKind[]).map(kind => {
    const cells = terrain.filter(t => t.kind === kind), remaining = new Set(cells.map(t => t.r * 8 + t.c));
    const sizes: number[] = [];
    while (remaining.size) {
      const queue = [remaining.values().next().value!]; remaining.delete(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const cell = { r: Math.floor(queue[i] / 8), c: queue[i] % 8 };
        for (const other of cells) if (remaining.has(other.r * 8 + other.c) && adjacent(cell, other)) { remaining.delete(other.r * 8 + other.c); queue.push(other.r * 8 + other.c); }
      }
      sizes.push(queue.length);
    }
    const height = Math.max(...cells.map(p => p.r)) - Math.min(...cells.map(p => p.r)) + 1;
    const width = Math.max(...cells.map(p => p.c)) - Math.min(...cells.map(p => p.c)) + 1;
    return { kind, compactness: cells.length ? cells.length / (height * width) : 0, count: cells.length, components: sizes.length, largest: Math.max(0, ...sizes), singletons: sizes.filter(v => v === 1).length };
  });
}

export function mapQuality(draft: SandboxDraft) {
  const { level, placements } = draft, board = boardCells(8), regions = terrainRegions(level.terrain);
  const entries = placements.map(at => { const piece = level.pieces.find(p => p.id === at.id)!; return { piece, cells: occupied(piece, at) }; });
  const used = entries.flatMap(e => e.cells), blocked = [...level.terrain, ...used];
  const mask = blocked.reduce((m, p) => m | cellBit(p), 0n);
  const grass = board.filter(p => !(mask & cellBit(p)));
  const effectiveGrass = grass.filter(p => grass.some(q => adjacent(p, q))).length;
  const dependencies = entries.filter(e => CAMP_REQUIREMENTS[e.piece.kind]);
  const linked = dependencies.filter(e => campConnections(e.piece.kind, e.cells, board, blocked).some(link => entries.some(c => c.piece.kind === 'camp' && c.cells.some(p => p.r === link.camp.r && p.c === link.camp.c)))).length;
  const quadrants = [0, 0, 0, 0];
  for (const p of used) quadrants[(p.r >= 4 ? 2 : 0) + (p.c >= 4 ? 1 : 0)]++;
  const terrainCount = level.terrain.length;
  return { regions, terrainCount, grass: grass.length, effectiveGrass,
    fragmentation: regions.reduce((s, r) => s + Math.max(0, r.components - 1), 0),
    concentration: Math.max(...[0, 1, 2, 3].map(q => level.terrain.filter(p => (p.r >= 4 ? 2 : 0) + (p.c >= 4 ? 1 : 0) === q).length)) / Math.max(1, terrainCount),
    maxSameKind: Math.max(...[...new Set(level.pieces.map(p => p.kind))].map(kind => level.pieces.filter(p => p.kind === kind).length)),
    maxLine: Math.max(...level.rows, ...level.cols), quadrants, linked, dependencies: dependencies.length,
    accepted: regions.every(r => r.components <= 2 && r.singletons === 0) && grass.length >= 8 && effectiveGrass >= 4
      && Math.max(...level.rows, ...level.cols) <= 7 && Math.max(...level.rows) / Math.max(1, used.length) <= .55
      && quadrants.filter(v => v > 0).length >= 3 && linked === dependencies.length,
  };
}
