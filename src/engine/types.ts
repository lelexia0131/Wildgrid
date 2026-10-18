export type TerrainKind = 'water' | 'forest' | 'mountain';
export type GameMode = 'adventure' | 'sandbox-editor' | 'sandbox-play' | 'survival';
export type FacilityKind = 'camp' | 'fire' | 'tower' | 'picnic' | 'cabin' | 'foodTruck' | 'powerTower' | 'pool';
export type Shape = 'single' | 'domino' | 'long' | 'el';
export type Status = 'VALID' | 'INCOMPLETE' | 'INVALID';
export type Cell = { readonly r: number; readonly c: number };
export type Terrain = Cell & { readonly kind: TerrainKind };
export type Piece = { readonly id: string; readonly kind: FacilityKind; readonly shape: Shape };
export type Placement = Cell & { readonly id: string; readonly rotation: number };
export type Level = { readonly id: number; readonly name: string; readonly chapter: string; readonly tip: string; readonly size: number; readonly terrain: readonly Terrain[]; readonly pieces: readonly Piece[]; readonly rows: readonly number[]; readonly cols: readonly number[] };
export type Snapshot = { readonly level: Level; readonly placements: readonly Placement[] };
// Only local blueprint builders and generator clones use writable data.
export type MutableData<T> = { -readonly [K in keyof T]: MutableData<T[K]> };
export type Issue = { status: Status; reasons: string[] };
export type Settings = { music: number; effects: number; muted: boolean; facilityTips: boolean; continuousPlacement: boolean; facilityNames: boolean; ruleDisplay: boolean };
