import type { Cell, TerrainKind } from './types';

export type TerrainDefinition<K extends string = TerrainKind> = Readonly<{
  id: K;
  name: string;
  cells: readonly Cell[];
  diagonal: boolean;
  componentMax: number;
  clusterBias: number;
  compactnessBias: number;
}>;
export const terrainRegistry: readonly TerrainDefinition[] = [
  { id: 'water', name: '水源', cells: [{r:0,c:0}], diagonal: false, componentMax: 3, clusterBias: -.2, compactnessBias: -.2 },
  { id: 'mountain', name: '山地', cells: [{r:0,c:0}], diagonal: false, componentMax: 3, clusterBias: -.1, compactnessBias: -.3 },
  { id: 'forest', name: '森林', cells: [{r:0,c:0}], diagonal: false, componentMax: 3, clusterBias: .9, compactnessBias: .3 },
];
export const terrainLayout = { window3: 4, window4: 8, quadrantShare: .6, halfShare: .85 } as const;
