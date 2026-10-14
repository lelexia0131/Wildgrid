import { useI18n } from '../i18n/context';
import { formatDateTime } from '../i18n/dateTime';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Flag, X } from 'lucide-react';
import { SurvivalBadge } from './SurvivalBadge';
import { rankFor, survivalDifficulties, survivalRanks, survivalTotals } from '../game/survival';
import type { SurvivalRecord, SurvivalSave } from '../game/survival';
import { audio } from '../game/audio';

export function SurvivalMenu({ save, generating, error, onStart, onContinue, onBack, onCancel, onReview, canReview }: {
  save: SurvivalSave; generating: number | null; error: string;
  onStart: (difficulty: number) => void; onContinue: () => void; onBack: () => void; onCancel: () => void;
  onReview: (record: SurvivalRecord) => void; canReview: (record: SurvivalRecord) => boolean;
}) {
  const { t, localize, language } = useI18n();
  const [records, setRecords] = useState(false);
  const recordsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (records) recordsRef.current?.showModal(); }, [records]);
  const { counts, xp } = survivalTotals(save), rank = rankFor(xp), next = survivalRanks[rank + 1];
  const progress = next ? (xp - survivalRanks[rank].xp) / (next.xp - survivalRanks[rank].xp) : 1;
  const history = save.records.filter(record => record.id !== save.challenge?.id || record.finishedAt !== undefined).sort((a, b) => (b.startedAt ?? b.finishedAt ?? 0) - (a.startedAt ?? a.finishedAt ?? 0));
  return <main className="survival-page">
    <div className="survival-heading"><button className="back-link" data-sound="close" onClick={onBack} disabled={generating !== null}><ArrowLeft size={20}/>{t("返回")}</button><h1>{t("荒野求生")}</h1></div>
    <section className="survival-identity" aria-label={t("玩家身份")}>
      <SurvivalBadge rank={rank}/><div><div className="survival-identity-title"><h2>{localize(survivalRanks[rank].name)}</h2><p>{t("累计经验")} {xp}</p></div><div className="survival-xp-track" role="progressbar" aria-label={t("身份经验进度")} aria-valuemin={survivalRanks[rank].xp} aria-valuemax={next?.xp ?? xp} aria-valuenow={xp}><i style={{ width: `${progress * 100}%` }}/></div><p>{localize(next ? t("距离{0}还需 {1} 经验", next.name, next.xp - xp) : t("荒野传奇 · 继续积累经验"))}</p></div>
    </section>
    <div className="survival-bottom">
      <button className="primary survival-continue" data-sound="handled" disabled={generating !== null || !save.challenge} title={save.challenge ? undefined : t("暂无未完成挑战")} onClick={onContinue}>{save.challenge ? t("继续挑战 · {0}难", save.challenge.difficulty) : t("继续挑战")}<ArrowRight size={20}/></button>
      <button className="secondary survival-records-button" data-sound={records ? 'close' : 'click'} onClick={() => setRecords(!records)} aria-expanded={records}><Flag size={20}/>{t("通关记录 · 共 {0} 次", history.length)}</button>
    </div>
    <div className="survival-difficulties" aria-label={t("选择难度")}>{survivalDifficulties.map((_, i) => <button key={i} className={`survival-difficulty difficulty-band-${Math.floor(i / 2)}`} data-sound="handled" disabled={generating !== null} onClick={() => onStart(i + 1)}><strong>{t("{0}难", i + 1)}</strong><span>{t("通关 {0} 次", counts[i])}</span></button>)}</div>
    {records && <dialog ref={recordsRef} className="modal survival-records record-sheet" aria-label={t("通关记录")} onCancel={event => { event.preventDefault(); audio.feedback('close'); setRecords(false); }}><button className="modal-close icon-button" data-sound="close" aria-label={t("关闭通关记录")} onClick={() => setRecords(false)}><X size={20}/></button><div className="record-sheet-heading"><Flag size={27}/><h2>{t("通关记录")}</h2></div><div className="survival-record-table" role="table" aria-label={t("通关记录")}><div className="survival-record-head" role="row"><span role="columnheader">{t("难度")}</span><span role="columnheader">{t("开始时间")}</span><span role="columnheader">{t("完成时间")}</span></div><div role="rowgroup">{history.map(record => <button className="survival-record-row" data-sound="handled" role="row" key={record.id} disabled={!canReview(record)} title={canReview(record) ? t("复盘") : t("历史地图未保存")} onClick={() => { setRecords(false); onReview(record); }}><strong role="cell">{t("{0}难", record.difficulty)}</strong><span role="cell">{formatDateTime(record.startedAt, language)}</span><span role="cell" className={record.finishedAt === undefined ? 'record-unfinished' : ''}>{record.finishedAt === undefined ? t("已放弃") : formatDateTime(record.finishedAt, language)}</span></button>)}</div></div>{history.length === 0 && <p>{t("暂无记录")}</p>}</dialog>}
    {generating !== null && <div className="survival-generating" role="status"><span className="survival-spinner"/><p>{t("正在生成 {0}难地图并验证唯一解…", generating)}</p><button className="secondary" data-sound="close" onClick={onCancel}><X size={18}/>{t("取消生成")}</button></div>}
    {error && <p className="survival-error" role="alert">{localize(error)}</p>}
  </main>;
}
