export const mapIconChoices = [
  { id: 'adventure', name: '旅途罗盘' }, { id: 'survival', name: '远行背包' },
  { id: 'sandbox', name: '绘图工具' }, { id: 'maps', name: '地图册' },
  { id: 'lantern', name: '露营灯' }, { id: 'boots', name: '登山靴' },
  { id: 'camera', name: '相机' }, { id: 'mug', name: '热饮' },
  { id: 'acorn', name: '橡果' }, { id: 'flower', name: '野花' },
  { id: 'moon', name: '月夜' }, { id: 'binoculars', name: '望远镜' },
  { id: 'camp', name: '营地' }, { id: 'fire', name: '篝火' },
  { id: 'tower', name: '瞭望塔' }, { id: 'picnic', name: '野餐桌' },
  { id: 'cabin', name: '林间木屋' }, { id: 'foodTruck', name: '餐车' },
  { id: 'powerTower', name: '电塔' }, { id: 'pool', name: '泳池' },
  { id: 'water', name: '水源' }, { id: 'forest', name: '森林' }, { id: 'mountain', name: '山地' },
] as const;
export type MapIconId = typeof mapIconChoices[number]['id'];
export const isMapIcon = (value: unknown): value is MapIconId => mapIconChoices.some(icon => icon.id === value);
