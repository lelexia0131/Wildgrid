import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { facilityNames, shapeNames } from '../../engine/facilityRegistry';
import { occupied } from '../../engine/boardGeometry';
import type { Level } from '../../engine/types';
import type { useAdventureHints } from '../hooks/useAdventureHints';
import { useI18n } from '../../localization/LanguageContext';
import { CampToolIcon } from './CampToolIcon';

export function AdventureHintPanel({ hints, level }: { hints: ReturnType<typeof useAdventureHints>; level: Level }) {
  const { t, localize } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const { hint, stage } = hints;
  let content;
  if (hints.error || hint?.status === 'unknown') content = <><p>{t("暂未完成分析，请重试。")}</p><button className="secondary" onClick={hints.retry}>{t("重试")}</button></>;
  else if (!hint || hints.loading) content = <p className="hint-loading" role="status">{t("正在寻找推理线索…")}</p>;
  else if (hint.status === 'complete') content = <p>{t("营地已经规划完成，所有规则与行列目标均已满足。")}</p>;
  else if (hint.status === 'conflict') content = <>
    <p>{t("当前摆放无法完成关卡，先检查已有设施与行列目标。")}</p>
    {stage >= 2 && <p>{hint.reasons.length ? hint.reasons.map(localize).join(' / ') : t("这些放置组合无法同时满足全部规则，无法确定唯一错误来源。")}</p>}
    {stage === 3 && <p>{t("检查金色区域，尝试拿起或撤销相关放置后重新分析；这不代表区域内每个设施都有错误。")}</p>}
  </>;
  else if (hint.status === 'ready') {
    const piece = level.pieces.find(p => p.id === hint.placement.id)!;
    const name = `${localize(shapeNames[piece.shape])} ${localize(facilityNames[piece.kind])}`;
    const line = t(hint.axis === 'row' ? "第 {0} 行" : "第 {0} 列", hint.line + 1);
    const cells = occupied(piece, hint.placement).sort((a, b) => a.r - b.r || a.c - b.c);
    content = <>
      {stage === 1 && <p>{t("关注{0}的剩余占格数，并结合{1}的放置规则。", line, name)}</p>}
      {stage === 2 && <p>{hint.candidates === 1
        ? t("{0}还需 {1} 格。结合地形和周围设施，{2}只剩一个位置可以放。看看金色区域，试着找一找。", line, hint.remaining, name)
        : t("{0}还需 {1} 格。结合地形和周围设施，{2}还有 {3} 处可以考虑的位置。看看金色区域，比较一下这些位置。", line, hint.remaining, name, hint.candidates)}</p>}
      {stage === 3 && <><strong className="hint-certainty">{t(hint.forced ? "必然放置" : "一种可行放置")}</strong><p>{t("{0}：占用{1}。", name, cells.map(cell => t("第 {0} 行第 {1} 列", cell.r + 1, cell.c + 1)).join(' / '))}</p>{piece.shape !== 'single' && <p>{t("方向：从初始形状顺时针旋转 {0} 次。", hint.placement.rotation)}</p>}</>}
    </>;
  }
  return <section className="hint-panel" role="region" aria-label={t("探险指引")} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); hints.close(); } }}>
    <header><CampToolIcon kind="hint"/><h3>{t("探险指引")}</h3><button ref={closeRef} className="icon-button" aria-label={t("关闭指引")} onClick={hints.close}><X size={16}/></button></header>
    <div className="hint-progress" aria-label={t("提示等级 {0} / 3", stage)}>{[1, 2, 3].map(n => <i key={n} className={n <= stage ? 'unlocked' : ''} aria-hidden="true"/>)}<span>{t(stage === 1 ? "观察提示" : stage === 2 ? "区域提示" : "操作提示")}</span></div>
    <div className="hint-copy" aria-live="polite" aria-busy={hints.loading} key={stage}>{content}</div>
    {hint && (hint.status === 'ready' || hint.status === 'conflict') && <footer>{stage < 3 ? <button className="secondary" onClick={hints.next}>{t("再给我一点提示")}</button> : hint.status === 'ready' && <button className="secondary" onClick={hints.showPlacement}>{t("查看放置位置")}</button>}</footer>}
  </section>;
}
