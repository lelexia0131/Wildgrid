import type { FacilityKind, Piece, Shape, TerrainKind } from './types';
import { terrainRegistry } from './terrainRegistry';

export type FacilityDefinition = Readonly<{
  kind: FacilityKind;
  name: string;
  shapes: readonly Shape[];
  tips: readonly [string, string];
  require: string;
  forbid: string;
  good: readonly string[];
  bad: readonly string[];
  why: string;
  extra?: readonly { readonly map: readonly string[]; readonly why: string }[];
}>;

// Keep the editor and generator's existing template order. These stable IDs
// also identify facility/shape combinations in WG1 map codes.
const FACILITY_TEMPLATES: [FacilityKind, Shape][] = [
  ['camp', 'single'], ['fire', 'single'], ['tower', 'single'],
  ['camp', 'domino'], ['camp', 'long'], ['camp', 'el'],
  ['picnic', 'domino'], ['cabin', 'el'], ['foodTruck', 'single'],
  ['powerTower', 'single'], ['pool', 'single'],
];
export const facilityLibrary: readonly Piece[] = FACILITY_TEMPLATES.map(([kind, shape]) => ({ id: `${kind}_${shape}`, kind, shape }));
export const adventureFacilityLibrary: readonly Piece[] = [...facilityLibrary,
  { id: 'balloon_single', kind: 'balloon', shape: 'single' },
  { id: 'airship_domino', kind: 'airship', shape: 'domino' },
  { id: 'kite_long', kind: 'kite', shape: 'long' },
];

// These FACILITY_DESCRIPTIONS are presentation metadata. Actual legality belongs to
// placementRules.ts; the registry has no dependency on the rule evaluator.
const FACILITY_DESCRIPTIONS: Omit<FacilityDefinition, 'shapes'>[] = [
 {kind:'camp',name:'营地',tips:['至少一格挨着水源（上下左右）','覆盖地形、重叠、正交邻餐车或电塔'],require:'至少一格挨着水源（上下左右）。多格营地只需其中一格邻水。',forbid:'覆盖地形、重叠；上下左右挨着餐车或电塔。',good:['WCC'],bad:['W.','.C'],why:'这里只是斜角邻水。'},
 {kind:'fire',name:'篝火',tips:['上下左右挨着营地','邻森林、电塔（含斜角）'],require:'至少一侧挨着营地（上下左右）。',forbid:'挨着森林或电塔，包括斜角。',good:['WCB'],bad:['WCB','.F.'],why:'森林在篝火斜角，也不允许。'},
 {kind:'tower',name:'瞭望塔',tips:['上下左右挨着山地','邻其他瞭望塔（含斜角）'],require:'挨着山地（上下左右）。',forbid:'两座瞭望塔紧挨（包括斜角）。',good:['MT'],bad:['MT','.T'],why:'两座塔相邻，必须拉开距离。'},
 {kind:'picnic',name:'野餐桌',tips:['至少一格挨着营地（上下左右）','邻篝火（含斜角）'],require:'至少一格挨着营地（上下左右）。双格，可横放或竖放。',forbid:'任何一格挨着篝火，包括斜角。',good:['WCPP'],bad:['WCPP','..B.'],why:'野餐桌紧邻篝火，斜角也不允许。'},
 {kind:'cabin',name:'林间木屋',tips:['至少一格挨着森林（上下左右）','任意一格上下左右挨着水'],require:'至少一格挨着森林（上下左右）。拐角形三格，可四向旋转。',forbid:'任何一格挨着水源（上下左右）。',good:['FHH','.H.'],bad:['FHH','.HW'],why:'木屋的一格上下左右挨着水。'},
 {kind:'foodTruck',name:'餐车',tips:['与至少一个营地占格上下左右间隔一格空草地','上下左右直接挨着营地'],require:'与至少一个营地占格上下左右间隔一格空草地。多格营地按实际占格判断。',forbid:'上下左右直接挨着任何营地。',good:['WCC.V'],bad:['WCCV'],why:'餐车直接挨着营地，中间必须留一格。',extra:[{map:['WCBV'],why:'中间有篝火，不能作为空出的间隔格。'}]},
 {kind:'powerTower',name:'电塔',tips:['与篝火、营地保持距离','邻篝火（含斜角）、上下左右邻营地'],require:'与篝火、营地保持规定距离；可以斜角挨着营地。',forbid:'周围八格出现篝火；上下左右挨着营地。',good:['WC.','..E'],bad:['WCB.','...E'],why:'篝火在电塔斜角，仍然禁止。',extra:[{map:['WCE'],why:'电塔上下左右挨着营地，必须移开。'}]},
 {kind:'pool',name:'泳池',tips:['上下左右邻水，周围八格至少有一格营地','仅斜角邻水、周围没有营地'],require:'上下左右挨着至少一格水源，周围八格至少有一个营地占格。',forbid:'水源只有斜角相邻；周围八格没有营地。',good:['.WC','.S.'],bad:['WC.','.S.'],why:'营地虽然相邻，但水源只在泳池斜角。',extra:[{map:['WS..','...W','...C'],why:'泳池邻水，但周围八格没有营地。'}]},
 {kind:'balloon',name:'系留气球',tips:['地面投影上下左右邻系留桩','正下方有篝火或电塔'],require:'放在天空。地面投影需上下左右挨着系留桩，绳索才能固定；一个桩可系留多个气球。',forbid:'正下方有篝火或电塔；覆盖低云、同层重叠或越界。',good:[],bad:[],why:'斜角不算邻桩，桩正上方也不算。'},
 {kind:'airship',name:'补给飞艇',tips:['至少一格正下方是营地','任意一格正下方有篝火或电塔'],require:'放在天空，占双格，可旋转。至少一格正对营地的实际占格，才能投递补给。',forbid:'任意一格正下方有篝火或电塔；覆盖低云、同层重叠或越界。',good:[],bad:[],why:'飞艇可以先放，等地面的营地补齐。'},
 {kind:'kite',name:'气象风筝',tips:['至少一格正下方是山地','邻低云（含斜角），下方有篝火或电塔'],require:'放在天空，占直线三格，可旋转。至少一格正对山地，借山脊气流观测天气。',forbid:'任何一格邻近低云（包括斜角），以保持观测视野；正下方有篝火或电塔；同层重叠或越界。',good:[],bad:[],why:'风筝的全部占格都要远离低云，斜角也不行。'},
];

export const facilities: readonly FacilityDefinition[] = FACILITY_DESCRIPTIONS.map(facility => ({
  ...facility,
  shapes: adventureFacilityLibrary.filter(piece => piece.kind === facility.kind).map(piece => piece.shape),
}));
export const facilityNames = Object.fromEntries(facilities.map(facility => [facility.kind, facility.name])) as Readonly<Record<FacilityKind, string>>;
export const facilityTips = Object.fromEntries(facilities.map(facility => [facility.kind, facility.tips])) as Readonly<Record<FacilityKind, readonly [string, string]>>;
export const shapeNames: Readonly<Record<Shape, string>> = { single: '单格', domino: '双格', long: '三格', el: 'L 形' };
export const terrainNames = Object.fromEntries(terrainRegistry.map(t => [t.id,t.name])) as Readonly<Record<TerrainKind, string>>;
