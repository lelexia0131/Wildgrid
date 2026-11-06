import type { FacilityKind, TerrainKind } from '../../engine';

export const JOURNAL_CHAPTERS = [
  { name: '溪畔初营', theme: 'creek', sky: '#f8eac2', mist: '#dbe4bd', grass: '#cddd9b', edge: '#88a16c' },
  { name: '林间漫游', theme: 'woodland', sky: '#dbe8c9', mist: '#a7c3a6', grass: '#afc38a', edge: '#668568' },
  { name: '山野远行', theme: 'highland', sky: '#e5eddc', mist: '#aec8c2', grass: '#c5cba0', edge: '#7e9990' },
  { name: '云海驻营', theme: 'cloudsea', sky: '#dcecf1', mist: '#b8d4d8', grass: '#b9cdb1', edge: '#83a8aa' },
] as const;


// Soft chapter-compatible palettes for the shared scene drawing system.
export const JOURNAL_PALETTES = {
  stream: { paper: '#D8EAF0', land: '#BDD9BC', sand: '#E7E6C9', shade: '#8CB6AD', leaf: '#719F86', deep: '#416E65', water: '#85BEC9', rock: '#9FB7B8', haze: '#B8D6D9' },
  meadow: { paper: '#E7EDD4', land: '#C5D7A8', sand: '#F0E8C4', shade: '#9BB68C', leaf: '#80A27B', deep: '#4D755F', water: '#96C8CB', rock: '#A9B6A1', haze: '#D3DEBC' },
  mint: { paper: '#E0EFE8', land: '#B9D5B9', sand: '#EAE7CC', shade: '#8DB4A0', leaf: '#729C83', deep: '#466E60', water: '#8FC3CD', rock: '#A5B8AF', haze: '#C6DED0' },
  creekDusk: { paper: '#EAE6D4', land: '#C6CEA9', sand: '#F0DCB3', shade: '#A8AE8E', leaf: '#849C7D', deep: '#586F60', water: '#9BBCC6', rock: '#ADB6AE', haze: '#D9D7BC' },
  linen: { paper: '#F1E6CC', land: '#D8CEA5', sand: '#F4E4BB', shade: '#B3B089', leaf: '#939D70', deep: '#66744F', water: '#9BBAB8', rock: '#B6B49B', haze: '#DFD6B3' },
  olive: { paper: '#E5E8D2', land: '#C8CDA6', sand: '#EDE1BB', shade: '#A2AE86', leaf: '#87996C', deep: '#5C7053', water: '#99BCB8', rock: '#ABB399', haze: '#D2D7B9' },
  honey: { paper: '#EFE0C6', land: '#D9C99D', sand: '#F3DAB1', shade: '#B6A67F', leaf: '#999B6B', deep: '#706F4F', water: '#A3BDB6', rock: '#BDB39C', haze: '#E0CEAB' },
  fog: { paper: '#DCE8ED', land: '#BFCBC4', sand: '#E9DFC6', shade: '#94ACA9', leaf: '#79978A', deep: '#506F6E', water: '#83B5C3', rock: '#92A8B2', haze: '#BFCFD8' },
  stone: { paper: '#E7E2D5', land: '#CBCAB9', sand: '#EEDFC2', shade: '#A7ADA4', leaf: '#8B9C88', deep: '#5C7471', water: '#91B7C1', rock: '#9EACB3', haze: '#CFD2CD' },
  gold: { paper: '#EFE2C8', land: '#D6CBA9', sand: '#F2DFB7', shade: '#B7AD94', leaf: '#999F80', deep: '#697C70', water: '#96BAC5', rock: '#ADB2AD', haze: '#DBD1BB' },
} as const;

type ArtKind = FacilityKind | TerrainKind;
export type JournalLevelCover = {
  theme: string;
  main: ArtKind;
  subjects: FacilityKind[];
  environment: TerrainKind[];
  composition: string;
  palette: keyof typeof JOURNAL_PALETTES;
};

// Art direction in level order; shared object geometry is combined by JournalLevelSceneArt.
export const JOURNAL_LEVEL_COVERS: JournalLevelCover[] = [
  { theme: '初见浅滩', main: 'camp', subjects: ['camp'], environment: ['water'], composition: '近景侧帐与横向浅滩', palette: 'stream' },
  { theme: '两处清泉', main: 'water', subjects: ['camp', 'camp'], environment: ['water'], composition: '双水湾沿对角线呼应', palette: 'mint' },
  { theme: '草甸三营', main: 'camp', subjects: ['camp', 'camp', 'camp'], environment: ['water'], composition: '俯瞰三角形营地与弯曲岸线', palette: 'meadow' },
  { theme: '松林之窗', main: 'forest', subjects: ['camp'], environment: ['water', 'forest'], composition: '近景树干框住水畔小帐', palette: 'mint' },
  { theme: '第一缕火光', main: 'fire', subjects: ['fire', 'camp'], environment: ['water', 'forest'], composition: '低视角火堆与受光帐门', palette: 'creekDusk' },
  { theme: '林缘留白', main: 'fire', subjects: ['fire', 'camp'], environment: ['water', 'forest'], composition: '左侧密林与右侧开阔炉边', palette: 'meadow' },
  { theme: '山脚泊营', main: 'mountain', subjects: ['camp'], environment: ['water', 'mountain'], composition: '岩壁斜切与山脚窄水湾', palette: 'stream' },
  { theme: '双峰瞭望', main: 'tower', subjects: ['tower', 'tower'], environment: ['mountain'], composition: '两座山脊分层托起瞭望塔', palette: 'mint' },
  { theme: '隔谷相望', main: 'tower', subjects: ['tower', 'tower', 'camp'], environment: ['mountain', 'water'], composition: '近塔框景与远山小塔', palette: 'creekDusk' },
  { theme: '沿岸长帐', main: 'camp', subjects: ['camp'], environment: ['water'], composition: '长边侧写与贴岸双开间帐篷', palette: 'stream' },
  { theme: '转弯的营地', main: 'camp', subjects: ['camp', 'camp', 'fire'], environment: ['water', 'forest'], composition: '纵深帐篷与横向帐篷围合水弯', palette: 'mint' },
  { theme: '水天之间', main: 'camp', subjects: ['camp', 'camp'], environment: ['water', 'mountain'], composition: '横向全景长帐与远岸单帐', palette: 'meadow' },
  { theme: '转角晨光', main: 'camp', subjects: ['camp', 'fire'], environment: ['water'], composition: '溪弯旁的长帐与炉边小院', palette: 'stream' },
  { theme: '坡上的灯火', main: 'tower', subjects: ['tower', 'camp', 'fire'], environment: ['mountain', 'water'], composition: '高台瞭望与低处围炉两层空间', palette: 'creekDusk' },
  { theme: '初营全景', main: 'camp', subjects: ['camp', 'camp', 'tower', 'fire'], environment: ['water', 'mountain', 'forest'], composition: '近景双帐与炉火看向远山小塔', palette: 'mint' },
  { theme: '泉眼间的小径', main: 'water', subjects: ['camp', 'camp'], environment: ['water', 'forest'], composition: '高视角双泉与连接的留白草径', palette: 'olive' },
  { theme: '同一湾水', main: 'camp', subjects: ['camp', 'camp', 'camp'], environment: ['water'], composition: '环湾扇形展开三处营地', palette: 'linen' },
  { theme: '林山之间', main: 'tower', subjects: ['tower', 'camp', 'fire'], environment: ['forest', 'mountain', 'water'], composition: '密林到山脊的横向长景', palette: 'olive' },
  { theme: '午餐时分', main: 'picnic', subjects: ['picnic', 'camp'], environment: ['forest', 'water'], composition: '近景大桌与水边帐篷景深', palette: 'linen' },
  { theme: '转向林间', main: 'picnic', subjects: ['picnic', 'camp', 'fire'], environment: ['forest', 'water'], composition: '端面餐桌沿纵深接向长帐', palette: 'honey' },
  { theme: '两岸营位', main: 'camp', subjects: ['camp', 'camp', 'picnic'], environment: ['water', 'forest'], composition: '两条不同走向的帐脊分置溪岸', palette: 'olive' },
  { theme: '高地与水洼', main: 'mountain', subjects: ['tower', 'camp'], environment: ['mountain', 'water'], composition: '右侧高岩台对照左侧湿地', palette: 'linen' },
  { theme: '林中双席', main: 'picnic', subjects: ['picnic', 'picnic', 'camp', 'fire'], environment: ['forest', 'water'], composition: '前后两桌沿林间空地错开', palette: 'honey' },
  { theme: '木屋的转角', main: 'cabin', subjects: ['cabin'], environment: ['forest'], composition: '林中小屋与绕过门前的步道', palette: 'olive' },
  { theme: '廊下野餐', main: 'cabin', subjects: ['cabin', 'picnic', 'camp'], environment: ['forest', 'water'], composition: '木屋侧廊延伸至营地餐桌', palette: 'linen' },
  { theme: '窄溪回转', main: 'water', subjects: ['camp', 'camp'], environment: ['water', 'forest'], composition: '纵贯S弯水道与两岸窄营地', palette: 'olive' },
  { theme: '空地拼合', main: 'camp', subjects: ['camp', 'camp', 'cabin'], environment: ['water', 'forest'], composition: '俯看长短帐顶与木屋保留的通路', palette: 'linen' },
  { theme: '炉边远眺', main: 'fire', subjects: ['fire', 'camp', 'picnic', 'tower'], environment: ['mountain', 'water'], composition: '近景炉火向远山瞭望塔递进', palette: 'honey' },
  { theme: '三层山居', main: 'tower', subjects: ['tower', 'cabin', 'camp'], environment: ['mountain', 'forest', 'water'], composition: '山顶塔、林中屋、水边帐的折线', palette: 'olive' },
  { theme: '林居长卷', main: 'camp', subjects: ['camp', 'cabin', 'picnic', 'fire'], environment: ['forest', 'water'], composition: '近景长帐与餐桌对照远处木屋', palette: 'honey' },
  { theme: '湖边餐车', main: 'foodTruck', subjects: ['foodTruck', 'camp'], environment: ['water'], composition: '餐车侧面近景与隔草坪的小帐', palette: 'gold' },
  { theme: '盘山补给', main: 'foodTruck', subjects: ['foodTruck', 'camp', 'tower'], environment: ['mountain', 'water'], composition: '三分之二车头视角与斜坡长帐', palette: 'stone' },
  { theme: '两站之间', main: 'foodTruck', subjects: ['foodTruck', 'foodTruck', 'camp'], environment: ['water', 'mountain', 'forest'], composition: '两辆补给餐车之间的林缘长帐', palette: 'gold' },
  { theme: '远处的电塔', main: 'powerTower', subjects: ['powerTower', 'camp', 'fire'], environment: ['forest', 'water'], composition: '近景炉火、空旷坡面、远塔', palette: 'fog' },
  { theme: '穿过原野', main: 'powerTower', subjects: ['powerTower', 'powerTower', 'camp'], environment: ['forest', 'water'], composition: '近景电塔跨线引向远塔与水岸', palette: 'stone' },
  { theme: '两种塔影', main: 'tower', subjects: ['tower', 'powerTower', 'camp', 'fire'], environment: ['mountain', 'water'], composition: '木塔贴山与钢塔隔谷的对照', palette: 'fog' },
  { theme: '山路停靠', main: 'foodTruck', subjects: ['foodTruck', 'camp', 'powerTower'], environment: ['mountain', 'water'], composition: '近车、弧形草道、远处长帐与电塔', palette: 'gold' },
  { theme: '水边泳池', main: 'pool', subjects: ['pool', 'camp'], environment: ['water'], composition: '低视角池沿与天然水岸相接', palette: 'fog' },
  { theme: '树影入水', main: 'pool', subjects: ['pool', 'camp'], environment: ['water', 'forest'], composition: '俯视池面、斜角帐篷与倒影', palette: 'stone' },
  { theme: '双池山湾', main: 'pool', subjects: ['pool', 'pool', 'camp', 'camp', 'tower'], environment: ['water', 'mountain'], composition: '沿两层水岸展开不同透视的双池', palette: 'fog' },
  { theme: '远行营地', main: 'camp', subjects: ['camp', 'foodTruck', 'powerTower', 'pool'], environment: ['water', 'mountain'], composition: '大长帐前景与环湖配套的全景', palette: 'gold' },
  { theme: '屋后的留白', main: 'cabin', subjects: ['cabin', 'picnic', 'foodTruck', 'camp'], environment: ['forest', 'water'], composition: '树荫木屋与草道隔开的餐车', palette: 'stone' },
  { theme: '水岸的斜角', main: 'pool', subjects: ['pool', 'camp', 'tower'], environment: ['water', 'mountain'], composition: '菱形池面与错角帐顶，远处山塔', palette: 'fog' },
  { theme: '暮色的间隔', main: 'powerTower', subjects: ['powerTower', 'fire', 'camp', 'foodTruck'], environment: ['water', 'forest'], composition: '暖炉近景与隔水远塔的长纵深', palette: 'gold' },
  { theme: '山野归处', main: 'camp', subjects: ['camp', 'pool', 'foodTruck', 'tower'], environment: ['water', 'mountain', 'forest'], composition: '长帐与岸边泳池，层叠群山中的终章', palette: 'stone' },
];

type CloudseaProp = readonly [FacilityKind | 'anchor', number, number, number, number?];
export type CloudseaScene = {
  composition: string; palette: 'fog' | 'gold' | 'mint'; sun: readonly [number, number, number];
  ridge: string; land: string; water?: string; trail?: string; props: readonly CloudseaProp[];
  trees: readonly (readonly [number, number, number])[]; frame: 'grass' | 'pine' | 'rock';
};
// Individual compositions: silhouettes, viewpoint, light and subjects vary by day.
export const CLOUDSEA_SCENES: readonly CloudseaScene[] = [
  {composition:'近景系留气球与晨光浅湾',palette:'gold',sun:[247,39,22],ridge:'M0 123Q37 78 65 99T129 92 193 78 257 100 320 84',land:'M0 158Q44 129 90 155T173 169Q226 136 320 151V220H0Z',water:'M146 164Q192 144 235 153T320 154V188Q261 169 219 176T146 164Z',trail:'M28 220Q58 175 132 187',props:[['anchor',84,194,.4],['camp',245,196,.71],['balloon',79,123,.88]],trees:[],frame:'grass'},
  {composition:'湖岸倒影与斜向系留绳',palette:'mint',sun:[76,37,19],ridge:'M0 119Q58 58 108 106T206 73 320 108',land:'M0 174Q43 157 69 178L133 209 320 198V220H0Z',water:'M78 153Q166 130 267 153L320 174Q210 201 122 183Z',trail:'M0 192Q43 183 80 220',props:[['camp',57,184,.63],['camp',258,204,.46],['balloon',203,128,.91]],trees:[[20,176,.67],[298,203,.45]],frame:'pine'},
  {composition:'双峰之间的两只气球与远塔',palette:'fog',sun:[250,47,17],ridge:'M0 132L58 47 108 117 169 62 223 123 270 85 320 104',land:'M0 168Q64 123 119 162T201 179L264 156 320 178V220H0Z',water:'M0 194Q49 182 88 198L105 220H0Z',trail:'M104 220Q148 193 236 187',props:[['tower',259,173,.46],['camp',164,206,.65],['balloon',82,124,.83],['balloon',210,99,.55],['anchor',57,181,.32]],trees:[[29,181,.48]],frame:'rock'},
  {composition:'飞艇掠过水湾投递补给',palette:'gold',sun:[249,43,23],ridge:'M0 130Q53 96 89 116T174 96 248 117 320 91',land:'M0 181Q62 150 110 172T184 172Q244 143 320 168V220H0Z',water:'M0 151Q73 133 135 155T231 143L226 159Q168 183 125 170T0 176Z',trail:'M181 220Q193 192 259 198',props:[['camp',104,194,.85],['airship',132,97,.9,-7],['balloon',279,141,.43]],trees:[],frame:'grass'},
  {composition:'峡谷云隙中的竖向航迹',palette:'fog',sun:[162,45,22],ridge:'M0 110L34 65 72 119 145 80 213 129 274 65 320 105',land:'M0 150L45 127 91 155 128 220H0ZM220 220 253 169 293 140 320 149V220Z',water:'M117 157Q143 165 164 153T203 149L175 172 167 220H143L142 183Z',trail:'M0 194Q28 169 73 176',props:[['camp',54,181,.64],['camp',281,196,.49],['airship',163,133,.76,-32],['balloon',260,97,.41]],trees:[[304,180,.64],[17,153,.46]],frame:'rock'},
  {composition:'俯看两岸营地与交错飞艇',palette:'mint',sun:[60,34,18],ridge:'M0 126Q48 91 90 110T185 90 255 112 320 96',land:'M0 147Q75 132 132 167L180 220H0ZM204 220 230 157Q278 147 320 168V220Z',water:'M139 144Q187 153 203 172T231 220H185Q185 181 157 172T139 144Z',trail:'M0 174Q55 158 113 196',props:[['camp',87,187,.69],['camp',264,205,.59],['airship',86,109,.61,7],['airship',235,103,.67,-9],['balloon',172,64,.33]],trees:[[24,173,.5],[309,194,.7]],frame:'grass'},
  {composition:'草坡补给车与遥远的低空航线',palette:'gold',sun:[263,48,22],ridge:'M0 133Q34 108 79 118L125 68 175 121Q258 82 320 119',land:'M0 170Q100 137 157 159T248 182L320 157V220H0Z',water:'M178 181Q219 163 265 177L320 191 303 206Q230 185 178 194Z',trail:'M0 214Q63 181 139 206',props:[['foodTruck',73,201,.86],['camp',160,187,.66],['airship',199,111,.7,4],['balloon',57,107,.51]],trees:[[19,174,.49],[289,180,.51]],frame:'pine'},
  {composition:'山脊气流托起近景观测风筝',palette:'fog',sun:[243,39,19],ridge:'M0 147L65 91 105 135 172 54 229 130 281 94 320 124',land:'M0 197L53 167 95 186 158 163 214 196 275 171 320 184V220H0Z',water:'M0 206Q45 189 80 205L105 220H0Z',props:[['camp',249,206,.44],['fire',214,212,.3],['kite',171,115,.86,-17]],trees:[],frame:'rock'},
  {composition:'湖上风筝与近远两层飞行器',palette:'mint',sun:[73,41,22],ridge:'M0 127Q47 74 94 104L152 59 207 112 260 84 320 119',land:'M0 181Q72 159 120 187T228 189 320 174V220H0Z',water:'M65 156Q143 128 234 152L287 175Q194 195 107 179Z',props:[['camp',48,198,.55],['camp',277,210,.48],['airship',220,168,.56,-7],['balloon',64,132,.58],['kite',211,86,.55,14]],trees:[[10,186,.66],[308,195,.42]],frame:'grass'},
  {composition:'高台木塔下的云间营地',palette:'gold',sun:[270,41,17],ridge:'M0 133L42 83 95 121 167 81 224 134 284 93 320 104',land:'M0 189L63 156 105 178 160 145 226 163 270 191 320 170V220H0Z',water:'M0 213Q67 189 119 213L132 220H0Z',trail:'M143 220Q180 186 245 201',props:[['tower',75,174,.56],['picnic',180,215,.48],['camp',213,191,.64],['balloon',51,104,.5],['airship',226,121,.56,-6],['kite',173,61,.5,11]],trees:[[289,207,.62],[18,195,.4]],frame:'pine'},
  {composition:'两级草甸上方错落的系留气球',palette:'mint',sun:[251,34,20],ridge:'M0 129Q49 89 87 110L146 77 214 122 273 88 320 115',land:'M0 157Q51 133 106 156L153 170Q225 146 320 169V220H0Z',water:'M0 181Q51 159 111 182L176 220H137Q76 185 0 204Z',trail:'M176 220Q229 182 320 196',props:[['camp',71,172,.6],['camp',235,200,.69],['tower',300,176,.34],['balloon',81,117,.66],['balloon',258,95,.49],['airship',173,157,.53],['kite',164,61,.5,-8]],trees:[[10,158,.42],[301,218,.48]],frame:'grass'},
  {composition:'夕照山湾中的飞艇与炉火',palette:'gold',sun:[166,53,31],ridge:'M0 132Q37 100 78 124L134 91 187 131 251 78 320 120',land:'M0 180Q71 148 136 181T253 175L320 163V220H0Z',water:'M167 182Q206 166 260 178L320 202Q235 188 198 202Z',props:[['camp',86,199,.77],['fire',148,209,.45],['camp',271,198,.44],['balloon',52,110,.54],['balloon',256,102,.4],['airship',157,119,.69,5],['kite',209,65,.4,-14]],trees:[[22,194,.72],[311,188,.51]],frame:'pine'},
  {composition:'岩壁前横穿云海的观测风筝',palette:'fog',sun:[84,35,17],ridge:'M0 133L68 53 111 117 191 71 246 122 290 89 320 102',land:'M0 163L54 146 93 168 109 220H0ZM207 220 240 174 294 150 320 166V220Z',water:'M127 176Q164 157 196 173L182 190 170 220H140Z',props:[['cabin',55,198,.72],['camp',274,199,.53],['balloon',277,108,.47],['balloon',116,124,.4],['airship',191,160,.52,-11],['kite',163,75,.8,-5]],trees:[[14,173,.54],[303,193,.63]],frame:'rock'},
  {composition:'穿过晨雾的双飞艇与林缘帐篷',palette:'mint',sun:[254,36,23],ridge:'M0 130Q68 78 121 114L178 73 221 111 273 84 320 127',land:'M0 178Q59 154 116 174L181 208Q264 164 320 187V220H0Z',water:'M113 161Q166 145 213 159L258 175Q186 186 145 172Z',trail:'M11 220Q60 190 119 211',props:[['camp',58,198,.75],['cabin',279,205,.52],['airship',107,117,.68,-9],['airship',262,145,.54,9],['balloon',43,88,.36],['balloon',204,83,.35],['kite',183,53,.46,5]],trees:[[21,172,.42],[306,197,.6]],frame:'pine'},
  {composition:'云海全景中地面与天空的共同营地',palette:'gold',sun:[250,39,25],ridge:'M0 132L49 82 97 124 161 61 216 117 271 83 320 117',land:'M0 169Q55 139 111 164T207 178Q268 145 320 171V220H0Z',water:'M0 192Q60 172 125 194T224 197L229 212Q148 218 94 202T0 211Z',trail:'M214 220Q241 186 310 206',props:[['camp',78,181,.63],['camp',259,207,.67],['tower',290,173,.37],['fire',209,211,.3],['balloon',44,115,.59],['balloon',262,108,.46],['airship',139,109,.71,-8],['airship',176,169,.46,7],['kite',184,56,.47,-3]],trees:[[21,161,.4],[312,210,.54]],frame:'grass'},
];
for (const [i, scene] of CLOUDSEA_SCENES.entries()) {
  const main = i < 3 ? 'balloon' : i < 7 ? 'airship' : 'kite';
  JOURNAL_LEVEL_COVERS.push({ theme: '', main, subjects: [main], environment: [], composition: scene.composition, palette: scene.palette });
}
