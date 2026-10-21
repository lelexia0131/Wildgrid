import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '../../localization/LanguageContext';
import { Art, CampArt, FacilityArt, FootprintSurface } from './Art';
import { MenuIcon } from './MenuIcon';
import { CampToolIcon } from './CampToolIcon';
import { AdventureBadgeIcon } from './AdventureBadge';
import { ADVENTURE_BADGES } from '../../game-modes/adventure/adventureBadges';
import type { AdventureBadgeTier } from '../../game-modes/adventure/adventureBadges';
import { offsets } from '../../engine';
import { facilities } from '../../engine';
import { SURVIVAL_DIFFICULTIES, SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';
import { MIN_ALLOWED_FACILITIES, MAX_GENERATED_FACILITIES } from '../../game-modes/survival/survivalFacilities';
import { audio } from '../../platform/audio/WildernessAudio';
import type { FacilityKind, Shape, TerrainKind } from '../../engine';

type Kind = FacilityKind | TerrainKind;
const MAP_SYMBOLS: Record<string, Kind> = { W:'water', F:'forest', M:'mountain', C:'camp', B:'fire', T:'tower', P:'picnic', H:'cabin', V:'foodTruck', E:'powerTower', S:'pool' };
function Board({ map }: { map: readonly string[] }) {
  const cells = map.join('').split(''), width = map[0].length;
  const facilities = ['C','P','H'].flatMap(symbol => {
    const points = cells.flatMap((s,i) => s === symbol ? [{r:Math.floor(i/width),c:i%width}] : []);
    if (points.length < 2) return [];
    const r = Math.min(...points.map(p=>p.r)), c = Math.min(...points.map(p=>p.c));
    const shape: Shape = symbol === 'H' ? 'el' : points.length === 3 ? 'long' : 'domino';
    const rotation = [0,1,2,3].find(turn => offsets(shape,turn).every(p=>points.some(q=>q.r===p.r+r && q.c===p.c+c)))!;
    return [{symbol,kind:MAP_SYMBOLS[symbol] as FacilityKind,shape,rotation,r,c,width:Math.max(...points.map(p=>p.c))-c+1,height:Math.max(...points.map(p=>p.r))-r+1}];
  });
  return <div className="manual-board" style={{ gridTemplateColumns:`repeat(${width}, 32px)` }}>{cells.map((s,i)=><span key={i} style={{gridRow:Math.floor(i/width)+1,gridColumn:i%width+1}} className={`manual-cell ${MAP_SYMBOLS[s] || ''} ${facilities.some(f=>f.symbol===s) ? 'manual-multi' : ''}`}>{MAP_SYMBOLS[s] && !facilities.some(f=>f.symbol===s) && <Art kind={MAP_SYMBOLS[s]}/>}</span>)}{facilities.map(f=><span key={f.symbol} className="manual-facility-art" style={{gridRow:`${f.r+1} / span ${f.height}`,gridColumn:`${f.c+1} / span ${f.width}`}}><FootprintSurface shape={f.shape} rotation={f.rotation}/><FacilityArt kind={f.kind} shape={f.shape} rotation={f.rotation}/></span>)}</div>;
}
function Example({ map, good = false, children }: { map: readonly string[]; good?: boolean; children: React.ReactNode }) {
  const { t, localize } = useI18n();
  return <div className={`manual-example ${good ? 'good' : 'bad'}`}><Board map={map}/><strong>{localize(good ? t("✓ 可以这样放") : t("× 不能这样放"))}</strong><p>{children}</p></div>;
}
function ShapeView({ shape, rotation = 0 }: { shape: Shape; rotation?: number }) {
  const cells = offsets(shape,rotation), width=Math.max(...cells.map(p=>p.c))+1;
  return <span className="manual-shape" style={{gridTemplateColumns:`repeat(${width}, 12px)`}}>{cells.map(p=><i key={`${p.r},${p.c}`} style={{gridRow:p.r+1,gridColumn:p.c+1}}/>)}</span>;
}
type ManualPage = { id: string; title: string; icon: ComponentProps<typeof MenuIcon>['kind']; content: ReactNode };

export function Manual() {
  const { t, localize } = useI18n();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const pages: ManualPage[] = [
    { id: 'modes', title: t("模式选择与本地地图"), icon: 'boots', content: <><p>{t("首页点击「开始冒险」进入「模式选择」，可以继续冒险、挑战荒野求生、进入沙盒模式，或打开本地地图。沙盒模式可以创造自己的地图，也可以导入朋友分享的地图代码。")}</p><div className="manual-route"><span>{t("继续冒险")}</span><span>{t("荒野求生")}</span><span>{t("沙盒模式")}</span><span>{t("本地地图")}</span></div></> },
    { id: 'create', title: t("创造地图"), icon: 'lantern', content: <><p>{t("选择 6×6 或 8×8，开始规划营地。设施库提供全部设施，包括单格餐车、电塔、泳池，默认开启连续放置，放下一个仍保留类型和方向，可在设置中关闭。设施形状、地形要求和放置规则与冒险相同。")}</p><p>{t("摆放设施后自动生成行列占格目标。导入游玩时，这些设施会回到待放区，由玩家重新求解。")}</p></> },
    { id: 'adventure-hints', title: t("闯关模式与智能提示"), icon: 'adventure', content: <><p>{t("闯关时，通过游戏界面左上角返回箭头进入关卡选择界面，当前进度自动保存。")}</p><p>{t("智能提示根据当前棋盘、行列目标、地形和设施规则分析。观察提示指出推理线索；区域提示解释约束并以金色标记相关区域；操作提示提供经过验证的设施、占格与方向建议。")}</p><p>{t("提示优先寻找必然放置。存在多个解时，可显示「一种可行放置」。摆放导致无解时，指引会帮助排查矛盾，不能唯一归因时会明确说明。")}</p><p>{t("每关首次通关会按提示使用情况获得徽章，详情见「首次通关徽章」。")}</p></> },
    { id: 'adventure-badges', title: t("首次通关徽章"), icon: 'badge', content: <><p>{t("闯关徽章只在每关首次通关时授予，获得后永久保持原等级。重玩时使用或不使用提示，都不会改变历史徽章，也不影响通关资格、经验或其他模式的奖励。")}</p><table className="manual-badge-table"><thead><tr><th>{t("徽章")}</th><th>{t("获得条件")}</th></tr></thead><tbody>{(Object.keys(ADVENTURE_BADGES) as AdventureBadgeTier[]).map(tier => <tr key={tier}><td><AdventureBadgeIcon tier={tier}/>{t(ADVENTURE_BADGES[tier].name)}</td><td>{t(ADVENTURE_BADGES[tier].condition)}</td></tr>)}</tbody></table><p>{t("观察提示计 1 点，区域提示计 2 点，操作提示计 3 点；点击「查看放置位置」额外计 4 点。每一级分别计分，例如依次解锁三级共计 6 点，再查看位置共计 10 点。")}</p><p>{t("同一次挑战中，同一局面已经解锁的提示和预览重复查看不计分。局面变化后主动获取新提示，会记录新的使用量。提示尚未显示、加载失败或取消确认均不计分。")}</p><p>{t("提示记录随未完成的关卡进度保存，退出或撤销不会清除。点击「重新游玩」会从空棋盘开始一次新挑战，并清空该次未完成挑战的提示记录。")}</p><p>{t("提示会降低当前预计徽章时，会先显示确认弹窗；取消后不展示新内容，也不计分。已经通关的关卡无需确认，因为历史徽章不会改变。")}</p><p>{t("营地日记展示四类徽章的关卡数量，关卡卡片展示各关首次获得的徽章。")}</p></> },
    { id: 'camp-tools', title: t("营地工具"), icon: 'tools', content: <><div className="manual-tool-grid">{(['undo', 'blueprint', 'restart', 'hint'] as const).map((kind, i) => <span key={kind}><CampToolIcon kind={kind}/>{t((['撤销', '图纸', '重新游玩', '提示'] as const)[i])}</span>)}</div><p>{t("闯关营地工具按 2×2 排列：左上撤销，右上图纸，左下重新游玩，右下提示。鼠标悬停或键盘聚焦可查看名称，触屏直接点击使用。")}</p><p>{t("点击提示打开「探险指引」，从观察提示开始；点击「再给我一点提示」依次解锁区域提示和操作提示。第三级点击「查看放置位置」显示半透明预览，由你自行放置。")}</p><p>{t("关闭指引保留当前局面的提示等级；有效改变棋盘后，从观察提示重新分析。点击棋盘继续操作会退出指引与预览。")}</p></> },
    { id: 'sample', title: t("试着创造一张小地图"), icon: 'acorn', content: <><div className="manual-settings"><p><b>{t("试着创造一张小地图")}</b>　 {t("在 6×6 地图第一行第一格放水源，第二格放单格营地。点击保存，质检通过后即可从本地地图进入游玩；也可以点击导出地图分享代码。")}</p><div className="manual-rotation"><Board map={['WC....','......','......','......','......','......']}/></div><p>{t("编辑草稿暂不自动保存。返回时会提示「尚未保存的地图将丢失，确定返回吗？」；想保留作品，请先点击保存。")}</p></div></> },
    { id: 'edit', title: t("编辑地形与设施"), icon: 'edit', content: <><p>{t("选择水源、森林或山地，点击空格放置，再次点击同一格移除。地形不能覆盖设施，先拿起设施再修改。")}</p><p>{t("点击已放设施拿起，再点空地移动；切换地形按钮可收回拿起的设施。多格设施选中后，再点一次同一张卡片旋转；撤销可以恢复地形、添加、收回、移动和旋转操作。")}</p></> },
    { id: 'check', title: t("保存与营地质检"), icon: 'check', content: <><p>{t("创造地图的营地工具包括「撤销、保存、导出地图」。再次点击已选的多格设施卡片即可旋转。点击保存或导出地图后，会先自动检查设施是否合法，以及关卡是否只有唯一解。")}</p><p>{t("质检通过后，保存会把地图加入本地地图，导出会生成分享代码。无解、多个解或设施不合法时，保存和导出都不会生效；修改地图后再次保存或导出会重新质检。")}</p></> },
    { id: 'share', title: t("分享与导入"), icon: 'share', content: <><p>{t("点击导出地图并通过质检后，WG1: 开头的地图代码会自动复制到剪贴板，也可以在弹窗中再次复制。")}</p><p>{t("回到沙盒菜单选择导入地图，粘贴地图代码后点击开始游玩。导入后从空棋盘放置设施，不能继续编辑地图；营地工具中的「保存」可以把地图和当前游玩进度存入本地地图。完成或返回都不会改变冒险存档和解锁进度。")}</p></> },
    { id: 'local', title: t("本地地图"), icon: 'archive', content: <><p>{t("模式选择中，沙盒模式下方的「本地地图」会列出已保存的地图，依次命名为「本地地图1、2、3……」。选择一个存档，右侧可以查看地图的固定地形和待放物品，不会提前显示设施答案，再点击「进入地图」开始游玩。")}</p><p>{t("创造地图保存后，从本地地图进入会从待放设施开始求解；导入地图游玩时保存的进度可以继续。普通沙盒地图进入后可以查看图纸；荒野求生收藏地图需先通关或放弃，才能查看图纸或编辑地图。重新进入已有本地地图后点击保存，会更新同一存档。可以重命名或删除地图；重命名时留空会恢复默认名称，删除前会提示确认。")}</p></> },
    { id: 'survival', title: t("荒野求生 · 随机推理挑战"), icon: 'binoculars', content: <><p>{t("在模式选择中点击「荒野求生」，选择 1难至10难。全部使用 8×8 地图，每次生成新的随机地图，并通过统一规则和唯一解验证。餐车、电塔、泳池随难度逐渐加入；高难度增加多格设施、复杂地形和相互依赖，需要结合行列提示推理。")}</p></> },
    { id: 'disabled-facilities', title: t("禁用设施"), icon: 'tools', content: <><p>{t("在荒野求生菜单点击「禁用设施」，点击设施卡片切换允许或禁用。变暗并带红色斜线的设施已被禁用；同一种设施的不同形状可分别设置。")}</p><p>{t("设置会自动保存在本机，仅影响之后新生成的荒野求生地图，当前挑战和已收藏地图保持原样。点击「恢复默认」重新允许全部设施，点击右上角叉号关闭面板。")}</p><p>{t("至少保留一种营地，并满足所选难度要求的设施种类数（见难度表，同类型不同形状分别计算）。不符合要求时会提示调整；若生成超时或未找到唯一解地图，可减少禁用项或重试。")}</p></> },
    { id: 'resume', title: t("自动保存与继续挑战"), icon: 'resume', content: <><p>{t("每次放置、拿起、撤销和旋转后自动保存地图、操作历史和方向。刷新网页、关闭 Windows 或 Android 应用后，回到荒野求生点击「继续挑战」恢复。")}</p><p>{t("只有一个未完成挑战。选择新难度或另一张荒野收藏地图时，会先确认是否放弃旧进度；生成失败或取消时仍保留旧挑战。")}</p></> },
    { id: 'tools', title: t("挑战工具与图纸"), icon: 'tools', content: <><p>{t("「重新游玩」清空操作，继续同一张地图；「保存」只收藏原始关卡，不把已放设施存成答案。")}</p><p>{t("荒野求生挑战中不提供图纸。未通关的收藏可以进入挑战，在本地地图中图纸和地图编辑保持锁定。通关或放弃后，同一挑战 ID 的收藏永久解锁完整图纸和编辑。编辑后保存为普通沙盒地图。")}</p><p>{t("「放弃」清除自动进度并返回难度选择，已有经验和收藏保留；左上角返回会保留进度。")}</p></> },
    { id: 'xp', title: t("经验与身份"), icon: 'badge', content: <><p>{t("每张随机地图有独立挑战 ID，仅首次通关发放经验、增加该难度和总通关次数。重复触发结算、重新挑战或收藏地图重玩都不会重复奖励。")}</p><p>{t("经验永久累计，不消耗、不清零。达到门槛自动升级；结算展示获得经验、累计经验、该难度通关次数和当前徽章。")}</p></> },
    { id: 'difficulty', title: t("难度"), icon: 'difficulty', content: <><table><thead><tr><th>{t("难度")}</th><th>{t("设施数量")}</th><th>{t("至少保留种类")}</th><th>{t("通关经验")}</th></tr></thead><tbody>{SURVIVAL_DIFFICULTIES.map((spec, i) => <tr key={i}><td>{t("{0}难", i + 1)}</td><td>≤{MAX_GENERATED_FACILITIES[i]}  {t("处")}</td><td>{MIN_ALLOWED_FACILITIES[i]}</td><td>+{spec.xp}</td></tr>)}</tbody></table></> },
    { id: 'ranks', title: t("身份"), icon: 'flower', content: <><table><thead><tr><th>{t("身份")}</th><th>{t("累计经验")}</th></tr></thead><tbody>{SURVIVAL_RANKS.map((rank, i) => <tr key={rank.name}><td>{localize(rank.name)}</td><td>{localize(SURVIVAL_RANKS[i + 1] ? `${rank.xp}–${SURVIVAL_RANKS[i + 1].xp - 1}` : `≥${rank.xp}`)}</td></tr>)}</tbody></table></> },
    { id: 'review', title: t("通关记录与复盘"), icon: 'camera', content: <><p>{t("只有已完成或已放弃的荒野求生地图会进入通关记录。未完成的挑战保留在「继续挑战」中，返回菜单或关闭游戏不会把它加入记录。")}</p><p>{t("打开通关记录单，点击一条记录即可复盘，恢复结束时的设施布局；复盘中可以使用图纸查看完整答案，也可以拿起、放置、撤销或重新游玩。")}</p><p>{t("复盘不会改变原记录、当前挑战、经验或通关次数。旧记录若没有保存地图，只能查看时间，不能复盘。")}</p></> },
    { id: 'complete', title: t("一张完成的营地图"), icon: 'overview', content: <><div className="manual-complete"><div className="manual-finished-cols"><span>✓</span><span>✓</span><span>✓</span></div><div className="manual-finished-row"><span className="manual-row-checks">✓<br/>✓<br/>✓</span><Board map={['WCB','...','FMT']}/></div><p>{t("营地邻水、篝火邻营地、塔邻山；三行分别占 2 / 0 / 1 格，三列分别占 0 / 1 / 2 格。所有设施放完，行列提示全部变为 ✓。")}</p></div></> },
    { id: 'clues', title: t("黄色短杠：数格子，不数设施"), icon: 'clues', content: <><p>{t("行提示位于棋盘左侧，列提示位于棋盘上方，黄色短杠都竖向排列。每条短杠表示这一行或列还需被设施占用一格；占满后显示 ✓，超额则显示红色数字。行和列都要满足。")}</p><div className="manual-clue-demo"><span>{t("行或列还需 3 格")} <span className="manual-clue-dashes"><i/><i/><i/></span></span><b>{t("→ 在这一行或列占用 2 格 →")}</b><span>{t("行或列还需 1 格")} <span className="manual-clue-dashes"><i/></span></span></div><div className="manual-examples"><Example map={['CCC']} good>{t("要求 3 格：三格营地占用 3 格。")}</Example><Example map={['CCC']}>{t("要求 2 格：占了 3 格，超出了这一行的占格要求。")}</Example></div><p>{t("双格设施横放占同一行 2 格；竖放占同一列 2 格。")}</p></> },
    { id: 'water', title: t("水源"), icon: 'water', content: <><p className="manual-caption">{t("游玩时的固定地形 · 不能移动或覆盖")}</p><p>{t("营地至少一格要挨着水源。上下左右挨着才算，斜角不算。")}</p><div className="manual-examples"><Example good map={['WC']}>{t("上下左右挨着水。")}</Example><Example map={['W.','.C']}>{t("斜角不算邻水。")}</Example></div></> },
    { id: 'forest', title: t("森林"), icon: 'forest', content: <><p className="manual-caption">{t("游玩时的固定地形 · 不能移动或覆盖")}</p><p>{t("篝火不能挨着森林，斜角也不行；木屋则需要至少一格挨着森林（上下左右）。")}</p><div className="manual-examples"><Example good map={['WCB','...','F..']}>{t("篝火远离森林。")}</Example><Example map={['WCB','.F.']}>{t("森林在篝火斜角，也不允许。")}</Example></div></> },
    { id: 'mountain', title: t("山地"), icon: 'mountain', content: <><p className="manual-caption">{t("游玩时的固定地形 · 不能移动或覆盖")}</p><p>{t("瞭望塔必须挨着山地（上下左右）。")}</p><div className="manual-examples"><Example good map={['MT']}>{t("上下左右挨着山。")}</Example><Example map={['M.','.T']}>{t("这里只是斜角邻山。")}</Example></div></> },
    ...facilities.map(f => ({ id: f.kind, title: localize(f.name), icon: f.kind, content: <><p><b>{t("要求")} </b>{localize(f.require)}</p><p><b>{t("禁止")} </b>{localize(f.forbid)}</p><div className="manual-shapes">{f.shapes.map(shape=><ShapeView key={shape} shape={shape}/>)}</div><div className="manual-examples"><Example good map={f.good}>{localize(f.require)}</Example><Example map={f.bad}>{localize(f.why)}</Example>{f.extra?.map((example,i)=><Example key={i} map={example.map}>{localize(example.why)}</Example>)}</div></> })),
    { id: 'rotate', title: t("再次点击卡片旋转"), icon: 'rotate', content: <><p>{t("只有多格设施需要旋转。选中设施后，再次点击同一张卡片即可旋转。")}</p><div className="manual-rotation"><CampArt shape="domino"/><span>→</span><CampArt shape="domino" rotation={1}/><ShapeView shape="el"/>{[1,2,3].map(r=><span key={r}> → <ShapeView shape="el" rotation={r}/></span>)}</div></> },
    { id: 'controls', title: t("营地操作"), icon: 'mug', content: <><ol><li>{t("选择设施：点击待放设施卡片；数量多时在列表内滑动或滚动。")}</li><li>{t("放置设施：选中后，点击空地。多格设施从点击位置开始，按当前形状展开。")}</li><li>{t("拿起设施：点击地图上的已放设施，再选择新的空地。")}</li><li>{t("旋转设施：再次点击已选卡片，调整多格设施方向。")}</li><li>{t("撤销：回退上一步操作。")}</li><li>{t("图纸：冒险中当前 day 通关后解锁；普通本地地图进入后即可使用，荒野求生收藏地图通关或放弃后永久解锁。点击可打开图纸弹窗，查看所有设施放置完成后的答案；重新游玩后仍可查看。")}</li><li>{t("重新游玩：清空当前地图重新开始。闯关模式的首次徽章不会因重玩而改变。")}</li><li>{t("打开设置：点击右上角设置按钮。")}</li></ol></> },
    { id: 'settings', title: t("全局设置"), icon: 'settings', content: <><div className="manual-settings"><p><b>{t("背景音乐")}</b>　 {t("调节背景音乐音量")}</p><p><b>{t("交互音效")}</b>　 {t("调节操作音效音量")}</p><p><b>{t("静音模式")}</b>　 {t("统一关闭声音")}</p><p><b>{t("设施提示")}</b>　 {t("显示或隐藏设施区域内的规则卡，创造地图时也会即时生效")}</p><p><b>{t("连续放置")}</b>　 {t("默认开启，放置后保留同类型、同形状设施的选择和方向，数量用完时取消选择；关闭后每次放置都会取消选择")}</p><p><b>{t("设施名称显示")}</b>　 {t("默认关闭。开启后，鼠标悬停已放设施会显示名称与图标，适用于所有模式；水源、森林、山地的提示始终显示，不受此开关影响。")}</p><p><b>{t("语言与新手引导")}</b>　 {t("设置中可切换中英文、开启或关闭新手引导，也可以重播已完成的引导。")}</p></div></> }
  ];
  const current = pages[page];
  function turn(next: number) {
    if (next < 0 || next >= pages.length || next === page) return;
    audio.feedback('page');
    setDirection(next > page ? 1 : -1); setPage(next);
  }
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [page]);
  return <div className="manual-notebook" onKeyDown={event => {
    if ((event.target as HTMLElement).closest('select')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); turn(page + (event.key === 'ArrowRight' ? 1 : -1)); }
  }}>
    <div className="notebook-binding" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i}/>)}</div>
    <div className="notebook-ribbon" aria-hidden="true"/>
    <header className="notebook-heading"><h2>{t("野外手册")}</h2><label><span className="sr-only">{t("目录")}</span><select data-sound="handled" aria-label={t("目录")} value={page} onChange={event => turn(Number(event.target.value))}>{pages.map((entry,i)=><option key={entry.id} value={i}>{String(i+1).padStart(2,'0')} · {entry.title}</option>)}</select></label></header>
    <div key={current.id} className={`manual-content manual-page ${direction > 0 ? 'turn-forward' : 'turn-back'}`} ref={contentRef} data-page={current.id} onPointerDown={event => { swipeRef.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={event => {
      const start = swipeRef.current; swipeRef.current = null;
      if (start && Math.abs(event.clientX - start.x) > 60 && Math.abs(event.clientY - start.y) < 40) turn(page + (event.clientX < start.x ? 1 : -1));
    }} onPointerCancel={() => { swipeRef.current = null; }}>
      <div className="manual-page-heading"><MenuIcon kind={current.icon}/><h3>{current.title}</h3></div>
      {current.content}
    </div>
    <footer className="notebook-footer"><button data-sound="handled" disabled={page===0} aria-label={t("上一页")} onClick={() => turn(page-1)}><ArrowLeft size={18}/><span>{t("上一页")}</span></button><span aria-live="polite" aria-label={t("第 {0} 页，共 {1} 页", page+1, pages.length)}>{String(page+1).padStart(2,'0')} / {pages.length}</span><button data-sound="handled" disabled={page===pages.length-1} aria-label={t("下一页")} onClick={() => turn(page+1)}><span>{t("下一页")}</span><ArrowRight size={18}/></button></footer>
  </div>;
}
