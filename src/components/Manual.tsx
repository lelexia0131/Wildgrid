import { Art, CampArt, FacilityArt, FootprintSurface } from './Art';
import { offsets } from '../game/rules';
import type { FacilityKind, Shape, TerrainKind } from '../game/types';

type Kind = FacilityKind | TerrainKind;
const symbols: Record<string, Kind> = { W:'water', F:'forest', M:'mountain', C:'camp', B:'fire', T:'tower', P:'picnic', H:'cabin' };
function Board({ map }: { map: string[] }) {
  const cells = map.join('').split(''), width = map[0].length;
  const facilities = ['C','P','H'].flatMap(symbol => {
    const points = cells.flatMap((s,i) => s === symbol ? [{r:Math.floor(i/width),c:i%width}] : []);
    if (points.length < 2) return [];
    const r = Math.min(...points.map(p=>p.r)), c = Math.min(...points.map(p=>p.c));
    const shape: Shape = symbol === 'H' ? 'el' : points.length === 3 ? 'long' : 'domino';
    const rotation = [0,1,2,3].find(turn => offsets(shape,turn).every(p=>points.some(q=>q.r===p.r+r && q.c===p.c+c)))!;
    return [{symbol,kind:symbols[symbol] as FacilityKind,shape,rotation,r,c,width:Math.max(...points.map(p=>p.c))-c+1,height:Math.max(...points.map(p=>p.r))-r+1}];
  });
  return <div className="manual-board" style={{ gridTemplateColumns:`repeat(${width}, 32px)` }}>{cells.map((s,i)=><span key={i} style={{gridRow:Math.floor(i/width)+1,gridColumn:i%width+1}} className={`manual-cell ${symbols[s] || ''} ${facilities.some(f=>f.symbol===s) ? 'manual-multi' : ''}`}>{symbols[s] && !facilities.some(f=>f.symbol===s) && <Art kind={symbols[s]}/>}</span>)}{facilities.map(f=><span key={f.symbol} className="manual-facility-art" style={{gridRow:`${f.r+1} / span ${f.height}`,gridColumn:`${f.c+1} / span ${f.width}`}}><FootprintSurface shape={f.shape} rotation={f.rotation}/><FacilityArt kind={f.kind} shape={f.shape} rotation={f.rotation}/></span>)}</div>;
}
function Example({ map, good = false, children }: { map: string[]; good?: boolean; children: React.ReactNode }) {
  return <div className={`manual-example ${good ? 'good' : 'bad'}`}><Board map={map}/><strong>{good ? '✓ 可以这样放' : '× 不能这样放'}</strong><p>{children}</p></div>;
}
function ShapeView({ shape, rotation = 0 }: { shape: Shape; rotation?: number }) {
  const cells = offsets(shape,rotation), width=Math.max(...cells.map(p=>p.c))+1;
  return <span className="manual-shape" style={{gridTemplateColumns:`repeat(${width}, 12px)`}}>{cells.map(p=><i key={`${p.r},${p.c}`} style={{gridRow:p.r+1,gridColumn:p.c+1}}/>)}</span>;
}
const facilities: {kind:FacilityKind; name:string; require:string; forbid:string; good:string[]; bad:string[]; why:string; shapes:Shape[]}[] = [
 {kind:'camp',name:'营地',require:'至少一格挨着水源（上下左右）。多格营地只需其中一格邻水。',forbid:'覆盖固定地形、与其他设施重叠。',good:['WCC'],bad:['W.','.C'],why:'这里只是斜角邻水。',shapes:['single','domino','long','el']},
 {kind:'fire',name:'篝火',require:'至少一侧挨着营地（上下左右）。',forbid:'挨着森林，包括斜角。',good:['WCB'],bad:['WCB','.F.'],why:'森林在篝火斜角，也不允许。',shapes:['single']},
 {kind:'tower',name:'瞭望塔',require:'挨着山地（上下左右）。',forbid:'两座瞭望塔紧挨（包括斜角）。',good:['MT'],bad:['MT','.T'],why:'两座塔相邻，必须拉开距离。',shapes:['single']},
 {kind:'picnic',name:'野餐桌',require:'至少一格挨着营地（上下左右）。双格，可横放或竖放。',forbid:'任何一格挨着篝火，包括斜角。',good:['WCPP'],bad:['WCPP','..B.'],why:'野餐桌紧邻篝火，斜角也不允许。',shapes:['domino']},
 {kind:'cabin',name:'林间木屋',require:'至少一格挨着森林（上下左右）。拐角形三格，可四向旋转。',forbid:'任何一格挨着水源（上下左右）。',good:['FHH','.H.'],bad:['FHH','.HW'],why:'木屋的一格上下左右挨着水。',shapes:['el']},
];
export function Manual() {
  return <div className="manual-content">
    <div className="manual-intro"><h2>野外手册</h2></div>
    <section><h3>一张完成的营地图</h3><div className="manual-complete"><div className="manual-finished-cols"><span>✓</span><span>✓</span><span>✓</span></div><div className="manual-finished-row"><span className="manual-row-checks">✓<br/>✓<br/>✓</span><Board map={['WCB','...','FMT']}/></div><p>营地邻水、篝火邻营地、塔邻山；三行分别占 2 / 0 / 1 格，三列分别占 0 / 1 / 2 格。所有设施放完，行列提示全部变为 ✓。</p></div></section>
    <section><h3>黄色短杠：数格子，不数设施</h3><p>黄色短杠表示这一行或这一列还需要被设施占用多少格。放入一格就减少一条，超额则显示红色数字。行和列都要满足。</p><div className="manual-clue-demo"><span>还需 3 格 <i/><i/><i/></span><b>→ 放入双格营地 →</b><span>还需 1 格 <i/></span></div><div className="manual-column-demo"><span>列提示也一样：还需 3 格</span><span className="manual-column-dashes"><i/><i/><i/></span></div><div className="manual-examples"><Example map={['CCC']} good>要求 3 格：三格营地占用 3 格。</Example><Example map={['CCC']}>要求 2 格：占了 3 格，超出了这一行的占格要求。</Example></div><p>双格设施横放占同一行 2 格；竖放占同一列 2 格。</p></section>
    <section><h3>固定地形 · 不能移动或覆盖</h3><div className="manual-cards">
      <article><header><Art kind="water"/><h4>水源</h4></header><p>营地至少一格要挨着水源。上下左右挨着才算，斜角不算。</p><div className="manual-examples"><Example good map={['WC']}>上下左右挨着水。</Example><Example map={['W.','.C']}>斜角不算邻水。</Example></div></article>
      <article><header><Art kind="forest"/><h4>森林</h4></header><p>篝火不能挨着森林，斜角也不行；木屋则需要至少一格挨着森林（上下左右）。</p><div className="manual-examples"><Example good map={['WCB','...','F..']}>篝火远离森林。</Example><Example map={['WCB','.F.']}>森林在篝火斜角，也不允许。</Example></div></article>
      <article><header><Art kind="mountain"/><h4>山地</h4></header><p>瞭望塔必须挨着山地（上下左右）。</p><div className="manual-examples"><Example good map={['MT']}>上下左右挨着山。</Example><Example map={['M.','.T']}>这里只是斜角邻山。</Example></div></article>
    </div></section>
    <section><h3>设施图鉴</h3><div className="manual-cards">{facilities.map(f=><article key={f.kind}><header><Art kind={f.kind}/><h4>{f.name}</h4></header><p><b>要求　</b>{f.require}</p><p><b>禁止　</b>{f.forbid}</p><div className="manual-shapes">{f.shapes.map(shape=><ShapeView key={shape} shape={shape}/>)}</div><div className="manual-examples"><Example good map={f.good}>{f.require}</Example><Example map={f.bad}>{f.why}</Example></div></article>)}</div></section>
    <section><h3>点击旋转</h3><p>只有多格设施需要旋转。选中设施后，点击旋转。</p><div className="manual-rotation"><CampArt shape="domino"/><span>→</span><CampArt shape="domino" rotation={1}/><ShapeView shape="el"/>{[1,2,3].map(r=><span key={r}> → <ShapeView shape="el" rotation={r}/></span>)}</div></section>
    <section><h3>操作与设置</h3><ol><li>选择设施：点击待放设施卡片；数量多时在列表内滑动或滚动。</li><li>放置设施：选中后，点击空地。多格设施从点击位置开始，按当前形状展开。</li><li>拿起设施：点击地图上的已放设施，再选择新的空地。</li><li>点击旋转：调整选中的多格设施方向。</li><li>撤销：回退上一步操作。</li><li>图纸：当前 day 通关后解锁。点击可打开图纸弹窗，查看所有设施放置完成后的答案；重新游玩后仍可查看。</li><li>重新游玩：清空当前地图重新开始。每个 day 只有首次通关会弹出“规划完成”。</li><li>打开设置：点击右上角设置按钮。</li></ol><div className="manual-settings"><p><b>背景音乐</b>　调节背景音乐音量</p><p><b>交互音效</b>　调节操作音效音量</p><p><b>静音模式</b>　统一关闭声音</p><p><b>设施提示</b>　显示或隐藏设施区域内的规则卡</p></div></section>
  </div>;
}
