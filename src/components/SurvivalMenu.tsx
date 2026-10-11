import { useI18n } from '../i18n/context';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Flag, X } from 'lucide-react';
import { SurvivalBadge } from './SurvivalBadge';
import { rankFor, survivalDifficulties, survivalRanks, survivalTotals } from '../game/survival';
import type { SurvivalSave } from '../game/survival';

export function SurvivalMenu({ save, generating, error, onStart, onContinue, onBack, onCancel }: {
  save: SurvivalSave; generating: number | null; error: string;
  onStart: (difficulty: number) => void; onContinue: () => void; onBack: () => void; onCancel: () => void;
}) {
  const { t, localize } = useI18n();
  const [records, setRecords] = useState(false);
  const recordsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (records) recordsRef.current?.showModal(); }, [records]);
  const { counts, total, xp } = survivalTotals(save), rank = rankFor(xp), next = survivalRanks[rank + 1];
  const progress = next ? (xp - survivalRanks[rank].xp) / (next.xp - survivalRanks[rank].xp) : 1;
  return <main className="survival-page">
    <div className="survival-heading"><button className="back-link" onClick={onBack} disabled={generating !== null}><ArrowLeft size={20}/>{t("返回")}</button><h1>{t("荒野求生")}</h1></div>
    <section className="survival-identity" aria-label={t("玩家身份")}>
      <SurvivalBadge rank={rank}/><div><div className="survival-identity-title"><h2>{localize(survivalRanks[rank].name)}</h2><p>{t("累计经验")} {xp}</p></div><div className="survival-xp-track" role="progressbar" aria-label={t("身份经验进度")} aria-valuemin={survivalRanks[rank].xp} aria-valuemax={next?.xp ?? xp} aria-valuenow={xp}><i style={{ width: `${progress * 100}%` }}/></div><p>{localize(next ? t("距离{0}还需 {1} 经验", next.name, next.xp - xp) : t("荒野传奇 · 继续积累经验"))}</p></div>
    </section>
    <div className="survival-difficulties" aria-label={t("选择难度")}>{survivalDifficulties.map((_, i) => <button key={i} className={`survival-difficulty difficulty-band-${Math.floor(i / 2)}`} disabled={generating !== null} onClick={() => onStart(i + 1)}><strong>{t("{0}难", i + 1)}</strong><span>{t("通关 {0} 次", counts[i])}</span></button>)}</div>
    <div className="survival-bottom">
      {save.challenge && <button className="primary" disabled={generating !== null} onClick={onContinue}>{t("继续挑战 · {0}难", save.challenge.difficulty)}<ArrowRight size={20}/></button>}
      <button className="secondary" onClick={() => setRecords(!records)} aria-expanded={records}><Flag size={20}/>{t("通关记录 · 共 {0} 次", total)}</button>
    </div>
    {records && <dialog ref={recordsRef} className="modal survival-records" aria-label={t("通关记录")} onCancel={event => { event.preventDefault(); setRecords(false); }}><button className="modal-close icon-button" aria-label={t("关闭通关记录")} onClick={() => setRecords(false)}><X size={20}/></button><h2>{t("通关记录")}</h2><p>{t("总通关 {0} 次 · 累计经验 {1}", total, xp)}</p><div>{counts.map((count, i) => <p key={i}><strong>{t("{0}难 · {1} 次", i + 1, count)}</strong><span>{t("每次 +{0} 经验", survivalDifficulties[i].xp)}</span></p>)}</div></dialog>}
    {generating !== null && <div className="survival-generating" role="status"><span className="survival-spinner"/><p>{t("正在生成 {0}难地图并验证唯一解…", generating)}</p><button className="secondary" onClick={onCancel}><X size={18}/>{t("取消生成")}</button></div>}
    {error && <p className="survival-error" role="alert">{localize(error)}</p>}
  </main>;
}
