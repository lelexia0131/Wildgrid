import { Art, CampArt, FacilityArt, FootprintSurface } from './Art';
import { offsets } from '../game/rules';
import { survivalDifficulties, survivalRanks } from '../game/survival';
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
    <section className="manual-sandbox"><h3>模式选择与本地地图</h3><p>首页点击「开始冒险」进入「模式选择」，可以继续冒险、挑战荒野求生、进入沙盒模式，或打开本地地图。沙盒模式可以创造自己的地图，也可以导入朋友分享的地图代码。</p><div className="manual-cards">
      <article><header><Art kind="camp"/><h4>创造地图</h4></header><p>选择 6×6 或 8×8，开始规划营地。设施库提供全部现有设施，默认开启连续放置，放下一个仍保留类型和方向，可在设置中关闭。设施形状、地形要求和放置规则与冒险相同。</p><p>摆放设施后自动生成行列占格目标。导入游玩时，这些设施会回到待放区，由玩家重新求解。</p></article>
      <article><header><Art kind="water"/><h4>编辑地形与设施</h4></header><p>选择水源、森林或山地，点击空格放置，再次点击同一格移除。地形不能覆盖设施，先拿起设施再修改。</p><p>点击已放设施拿起，再点空地移动；切换地形按钮可收回拿起的设施。多格设施选中后点击旋转；撤销可以恢复地形、添加、收回、移动和旋转操作。</p></article>
      <article><header><Art kind="tower"/><h4>保存与营地质检</h4></header><p>创造地图的营地工具第一排是「旋转、撤销」，第二排是「保存、导出地图」。点击保存或导出地图后，会先自动检查设施是否合法，以及关卡是否只有唯一解。</p><p>质检通过后，保存会把地图加入本地地图，导出会生成分享代码。无解、多个解或设施不合法时，保存和导出都不会生效；修改地图后再次保存或导出会重新质检。</p></article>
      <article><header><Art kind="cabin"/><h4>分享与导入</h4></header><p>点击导出地图并通过质检后，WG1: 开头的地图代码会自动复制到剪贴板，也可以在弹窗中再次复制。</p><p>回到沙盒菜单选择导入地图，粘贴地图代码后点击开始游玩。导入后从空棋盘放置设施，不能继续编辑地图；营地工具中的「保存」可以把地图和当前游玩进度存入本地地图。完成或返回都不会改变冒险存档和解锁进度。</p></article>
      <article><header><Art kind="camp"/><h4>本地地图</h4></header><p>模式选择中，沙盒模式下方的「本地地图」会列出已保存的地图，依次命名为「本地地图1、2、3……」。选择一个存档，右侧可以查看地图的固定地形和待放物品，不会提前显示设施答案，再点击「进入地图」开始游玩。</p><p>创造地图保存后，从本地地图进入会从待放设施开始求解；导入地图游玩时保存的进度可以继续。普通沙盒地图进入后可以查看图纸；荒野求生收藏地图需先通关，才能查看图纸或编辑地图。重新进入已有本地地图后点击保存，会更新同一存档。可以重命名或删除地图；重命名时留空会恢复默认名称，删除前会提示确认。</p></article>
    </div><div className="manual-settings"><p><b>试着创造一张小地图</b>　在 6×6 地图第一行第一格放水源，第二格放单格营地。点击保存，质检通过后即可从本地地图进入游玩；也可以点击导出地图分享代码。</p><div className="manual-rotation"><Board map={['WC....','......','......','......','......','......']}/></div><p>编辑草稿暂不自动保存。返回时会提示「尚未保存的地图将丢失，确定返回吗？」；想保留作品，请先点击保存。</p></div></section>
    <section className="manual-survival"><h3>荒野求生 · 随机推理挑战</h3><p>在模式选择中点击「荒野求生」，选择 1难至10难。全部使用 8×8 地图，每次生成新的随机地图，并通过现有规则和唯一解验证。高难度增加多格设施、复杂地形和相互依赖，需要结合行列提示推理。</p><div className="manual-cards"><article><header><Art kind="camp"/><h4>自动保存与继续挑战</h4></header><p>每次放置、拿起、撤销和旋转后自动保存地图、操作历史和方向。刷新网页、关闭 Windows 或 Android 应用后，回到荒野求生点击「继续挑战」恢复。</p><p>只有一个未完成挑战。选择新难度或另一张荒野收藏地图时，会先确认是否放弃旧进度；生成失败或取消时仍保留旧挑战。</p></article><article><header><Art kind="tower"/><h4>挑战工具与图纸</h4></header><p>「重新游玩」清空操作，继续同一张地图；「保存」只收藏原始关卡，不把已放设施存成答案。</p><p>荒野求生挑战中不提供图纸。未通关的收藏可以进入挑战，在本地地图中图纸和地图编辑保持锁定。通关后，同一挑战 ID 的收藏永久解锁完整图纸和编辑。编辑后保存为普通沙盒地图。</p><p>「放弃」清除自动进度并返回难度选择，已有经验和收藏保留；左上角返回会保留进度。</p></article><article><header><Art kind="forest"/><h4>经验与身份</h4></header><p>每张随机地图有独立挑战 ID，仅首次通关发放经验、增加该难度和总通关次数。重复触发结算、重新挑战或收藏地图重玩都不会重复奖励。</p><p>经验永久累计，不消耗、不清零。达到门槛自动升级；结算展示获得经验、累计经验、该难度通关次数和当前徽章。</p></article></div><table><thead><tr><th>难度</th><th>设施数量</th><th>通关经验</th></tr></thead><tbody>{survivalDifficulties.map((spec, i) => <tr key={i}><td>{i + 1}难</td><td>{spec.min}–{spec.max} 处</td><td>+{spec.xp}</td></tr>)}</tbody></table><table><thead><tr><th>身份</th><th>累计经验</th></tr></thead><tbody>{survivalRanks.map((rank, i) => <tr key={rank.name}><td>{rank.name}</td><td>{survivalRanks[i + 1] ? `${rank.xp}–${survivalRanks[i + 1].xp - 1}` : `≥${rank.xp}`}</td></tr>)}</tbody></table></section>
    <section><h3>一张完成的营地图</h3><div className="manual-complete"><div className="manual-finished-cols"><span>✓</span><span>✓</span><span>✓</span></div><div className="manual-finished-row"><span className="manual-row-checks">✓<br/>✓<br/>✓</span><Board map={['WCB','...','FMT']}/></div><p>营地邻水、篝火邻营地、塔邻山；三行分别占 2 / 0 / 1 格，三列分别占 0 / 1 / 2 格。所有设施放完，行列提示全部变为 ✓。</p></div></section>
    <section><h3>黄色短杠：数格子，不数设施</h3><p>黄色短杠表示这一行或这一列还需要被设施占用多少格。放入一格就减少一条，超额则显示红色数字。行和列都要满足。</p><div className="manual-clue-demo"><span>还需 3 格 <i/><i/><i/></span><b>→ 放入双格营地 →</b><span>还需 1 格 <i/></span></div><div className="manual-column-demo"><span>列提示也一样：还需 3 格</span><span className="manual-column-dashes"><i/><i/><i/></span></div><div className="manual-examples"><Example map={['CCC']} good>要求 3 格：三格营地占用 3 格。</Example><Example map={['CCC']}>要求 2 格：占了 3 格，超出了这一行的占格要求。</Example></div><p>双格设施横放占同一行 2 格；竖放占同一列 2 格。</p></section>
    <section><h3>游玩时的固定地形 · 不能移动或覆盖</h3><div className="manual-cards">
      <article><header><Art kind="water"/><h4>水源</h4></header><p>营地至少一格要挨着水源。上下左右挨着才算，斜角不算。</p><div className="manual-examples"><Example good map={['WC']}>上下左右挨着水。</Example><Example map={['W.','.C']}>斜角不算邻水。</Example></div></article>
      <article><header><Art kind="forest"/><h4>森林</h4></header><p>篝火不能挨着森林，斜角也不行；木屋则需要至少一格挨着森林（上下左右）。</p><div className="manual-examples"><Example good map={['WCB','...','F..']}>篝火远离森林。</Example><Example map={['WCB','.F.']}>森林在篝火斜角，也不允许。</Example></div></article>
      <article><header><Art kind="mountain"/><h4>山地</h4></header><p>瞭望塔必须挨着山地（上下左右）。</p><div className="manual-examples"><Example good map={['MT']}>上下左右挨着山。</Example><Example map={['M.','.T']}>这里只是斜角邻山。</Example></div></article>
    </div></section>
    <section><h3>设施图鉴</h3><div className="manual-cards">{facilities.map(f=><article key={f.kind}><header><Art kind={f.kind}/><h4>{f.name}</h4></header><p><b>要求　</b>{f.require}</p><p><b>禁止　</b>{f.forbid}</p><div className="manual-shapes">{f.shapes.map(shape=><ShapeView key={shape} shape={shape}/>)}</div><div className="manual-examples"><Example good map={f.good}>{f.require}</Example><Example map={f.bad}>{f.why}</Example></div></article>)}</div></section>
    <section><h3>点击旋转</h3><p>只有多格设施需要旋转。选中设施后，点击旋转。</p><div className="manual-rotation"><CampArt shape="domino"/><span>→</span><CampArt shape="domino" rotation={1}/><ShapeView shape="el"/>{[1,2,3].map(r=><span key={r}> → <ShapeView shape="el" rotation={r}/></span>)}</div></section>
    <section><h3>操作与设置</h3><ol><li>选择设施：点击待放设施卡片；数量多时在列表内滑动或滚动。</li><li>放置设施：选中后，点击空地。多格设施从点击位置开始，按当前形状展开。</li><li>拿起设施：点击地图上的已放设施，再选择新的空地。</li><li>点击旋转：调整选中的多格设施方向。</li><li>撤销：回退上一步操作。</li><li>图纸：冒险中当前 day 通关后解锁；普通本地地图进入后即可使用，荒野求生收藏地图通关后永久解锁。点击可打开图纸弹窗，查看所有设施放置完成后的答案；重新游玩后仍可查看。</li><li>重新游玩：清空当前地图重新开始。每个 day 只有首次通关会弹出“规划完成”。</li><li>打开设置：点击右上角设置按钮。</li></ol><div className="manual-settings"><p><b>背景音乐</b>　调节背景音乐音量</p><p><b>交互音效</b>　调节操作音效音量</p><p><b>静音模式</b>　统一关闭声音</p><p><b>设施提示</b>　显示或隐藏设施区域内的规则卡，创造地图时也会即时生效</p><p><b>连续放置</b>　默认开启，放置后保留同类型、同形状设施的选择和方向，数量用完时取消选择；关闭后每次放置都会取消选择</p></div></section>
  </div>;
}
