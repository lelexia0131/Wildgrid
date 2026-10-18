import type { FacilityKind, Piece, Shape, TerrainKind } from './types';

export type FacilityDefinition = {
  kind: FacilityKind;
  name: string;
  shapes: Shape[];
  tips: [string, string];
  require: string;
  forbid: string;
  good: string[];
  bad: string[];
  why: string;
  extra?: { map: string[]; why: string }[];
};

// Keep the editor and generator's existing template order. These stable IDs
// also identify facility/shape combinations in WG1 map codes.
const templates: [FacilityKind, Shape][] = [
  ['camp', 'single'], ['fire', 'single'], ['tower', 'single'],
  ['camp', 'domino'], ['camp', 'long'], ['camp', 'el'],
  ['picnic', 'domino'], ['cabin', 'el'], ['foodTruck', 'single'],
  ['powerTower', 'single'], ['pool', 'single'],
];
export const facilityLibrary: Piece[] = templates.map(([kind, shape]) => ({ id: `${kind}_${shape}`, kind, shape }));

// These descriptions are presentation metadata. Actual legality belongs to
// rules.ts; the registry has no dependency on the rule evaluator.
const descriptions: Omit<FacilityDefinition, 'shapes'>[] = [
 {kind:'camp',name:'营地',tips:['至少一格挨着水源（上下左右）','覆盖地形、重叠、正交邻餐车或电塔'],require:'至少一格挨着水源（上下左右）。多格营地只需其中一格邻水。',forbid:'覆盖地形、重叠；上下左右挨着餐车或电塔。',good:['WCC'],bad:['W.','.C'],why:'这里只是斜角邻水。'},
 {kind:'fire',name:'篝火',tips:['上下左右挨着营地','邻森林、电塔（含斜角）'],require:'至少一侧挨着营地（上下左右）。',forbid:'挨着森林或电塔，包括斜角。',good:['WCB'],bad:['WCB','.F.'],why:'森林在篝火斜角，也不允许。'},
 {kind:'tower',name:'瞭望塔',tips:['上下左右挨着山地','邻其他瞭望塔（含斜角）'],require:'挨着山地（上下左右）。',forbid:'两座瞭望塔紧挨（包括斜角）。',good:['MT'],bad:['MT','.T'],why:'两座塔相邻，必须拉开距离。'},
 {kind:'picnic',name:'野餐桌',tips:['至少一格挨着营地（上下左右）','邻篝火（含斜角）'],require:'至少一格挨着营地（上下左右）。双格，可横放或竖放。',forbid:'任何一格挨着篝火，包括斜角。',good:['WCPP'],bad:['WCPP','..B.'],why:'野餐桌紧邻篝火，斜角也不允许。'},
 {kind:'cabin',name:'林间木屋',tips:['至少一格挨着森林（上下左右）','任意一格上下左右挨着水'],require:'至少一格挨着森林（上下左右）。拐角形三格，可四向旋转。',forbid:'任何一格挨着水源（上下左右）。',good:['FHH','.H.'],bad:['FHH','.HW'],why:'木屋的一格上下左右挨着水。'},
 {kind:'foodTruck',name:'餐车',tips:['与至少一个营地占格上下左右间隔一格空草地','上下左右直接挨着营地'],require:'与至少一个营地占格上下左右间隔一格空草地。多格营地按实际占格判断。',forbid:'上下左右直接挨着任何营地。',good:['WCC.V'],bad:['WCCV'],why:'餐车直接挨着营地，中间必须留一格。',extra:[{map:['WCBV'],why:'中间有篝火，不能作为空出的间隔格。'}]},
 {kind:'powerTower',name:'电塔',tips:['与篝火、营地保持距离','邻篝火（含斜角）、上下左右邻营地'],require:'与篝火、营地保持规定距离；可以斜角挨着营地。',forbid:'周围八格出现篝火；上下左右挨着营地。',good:['WC.','..E'],bad:['WCB.','...E'],why:'篝火在电塔斜角，仍然禁止。',extra:[{map:['WCE'],why:'电塔上下左右挨着营地，必须移开。'}]},
 {kind:'pool',name:'泳池',tips:['上下左右邻水，周围八格至少有一格营地','仅斜角邻水、周围没有营地'],require:'上下左右挨着至少一格水源，周围八格至少有一个营地占格。',forbid:'水源只有斜角相邻；周围八格没有营地。',good:['.WC','.S.'],bad:['WC.','.S.'],why:'营地虽然相邻，但水源只在泳池斜角。',extra:[{map:['WS..','...W','...C'],why:'泳池邻水，但周围八格没有营地。'}]},
];

export const facilities: FacilityDefinition[] = descriptions.map(facility => ({
  ...facility,
  shapes: facilityLibrary.filter(piece => piece.kind === facility.kind).map(piece => piece.shape),
}));
export const facilityRegistry = Object.fromEntries(facilities.map(facility => [facility.kind, facility])) as Record<FacilityKind, FacilityDefinition>;
export const facilityNames = Object.fromEntries(facilities.map(facility => [facility.kind, facility.name])) as Record<FacilityKind, string>;
export const facilityTips = Object.fromEntries(facilities.map(facility => [facility.kind, facility.tips])) as Record<FacilityKind, [string, string]>;
export const shapeNames: Record<Shape, string> = { single: '单格', domino: '双格', long: '三格', el: 'L 形' };
export const terrainNames: Record<TerrainKind, string> = { water: '水源', forest: '森林', mountain: '山地' };
