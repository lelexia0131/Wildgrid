import type { FacilityKind, TerrainKind } from '../engine';

export const journalChapters = [
  { name: '溪畔初营', theme: 'creek', sky: '#f8eac2', mist: '#dbe4bd', grass: '#cddd9b', edge: '#88a16c' },
  { name: '林间漫游', theme: 'woodland', sky: '#dbe8c9', mist: '#a7c3a6', grass: '#afc38a', edge: '#668568' },
  { name: '山野远行', theme: 'highland', sky: '#e5eddc', mist: '#aec8c2', grass: '#c5cba0', edge: '#7e9990' },
] as const;

export const getJournalChapterArt = (chapter: number) => journalChapters[chapter];

// Soft chapter-compatible palettes for the shared scene drawing system.
export const journalPalettes = {
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
  palette: keyof typeof journalPalettes;
};

// Art direction in level order; shared object geometry is combined by JournalLevelSceneArt.
export const journalLevelCovers: JournalLevelCover[] = [
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
