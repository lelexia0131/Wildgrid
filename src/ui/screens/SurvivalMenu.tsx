import { SurvivalFacilityDialog } from '../components/SurvivalFacilityDialog';
import { SurvivalNotice } from '../components/SurvivalNotice';
import { useI18n } from '../../localization/LanguageContext';
import { formatDateTime } from '../../localization/dateTime';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, Flag, X } from 'lucide-react';
import { SurvivalBadge } from '../components/SurvivalBadge';
import { Art } from '../components/Art';
import { JournalChapterBackground } from '../components/JournalChapterBackground';
import { MenuLandscapeBackground } from '../components/MenuLandscapeBackground';
import { rankProgress, SURVIVAL_DIFFICULTIES, SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';
import { survivalTotals } from '../../game-modes/survival/survivalChallenge';
import type { SurvivalRecord, SurvivalSave } from '../../game-modes/survival/survivalChallenge';
import { audio } from '../../platform/audio/WildernessAudio';

export function SurvivalMenu({ save, generating, generationScene, error, onStart, onContinue, onBack, onCancel, onReview, canReview }: {
  save: SurvivalSave; generating: number | null; generationScene: number; error: string;
  onStart: (difficulty: number) => void; onContinue: () => void; onBack: () => void; onCancel: () => void;
  onReview: (record: SurvivalRecord) => void; canReview: (record: SurvivalRecord) => boolean;
}) {
  const { t, localize, language } = useI18n();
  const [facilities, setFacilities] = useState(false);
  const [noticeKey, setNoticeKey] = useState(0);
  const [records, setRecords] = useState(false);
  const recordsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (records) recordsRef.current?.showModal(); }, [records]);
  if (generating !== null) return <main className="survival-generation-page" data-scene={generationScene} aria-busy="true">
    <div className="generation-background" aria-hidden="true"><JournalChapterBackground chapter={generationScene}/></div>
    <div className="generation-map" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <span key={i} style={{ '--cell-delay': `${i * 45}ms` } as React.CSSProperties}>{i % 7 === 0 ? <Art kind="water"/> : i === 12 ? <Art kind="camp"/> : i === 13 ? <Art kind="fire"/> : i % 3 === 0 ? <Art kind="mountain"/> : i % 2 === 0 ? <Art kind="forest"/> : null}</span>)}</div>
    <h1 role="status">{t("地图生成中")}</h1><p>{t("难度 {0}", generating)}</p>
    <div className="generation-progress" role="progressbar" aria-label={t("地图生成进度")}><i/></div>
    <button className="secondary" data-sound="close" onClick={onCancel}><X size={18}/>{t("取消生成")}</button>
  </main>;
  const { counts, xp } = survivalTotals(save), { rank, next, fill: progress } = rankProgress(xp);
  const history = save.records.filter(record => record.id !== save.challenge?.id || record.finishedAt !== undefined).sort((a, b) => (b.startedAt ?? b.finishedAt ?? 0) - (a.startedAt ?? a.finishedAt ?? 0));
  return <><MenuLandscapeBackground scene="survival"/><main className="survival-page">
    <div className="survival-heading"><button className="back-link" data-sound="close" onClick={onBack} disabled={generating !== null}><ArrowLeft size={20}/>{t("返回")}</button><h1>{t("荒野求生")}</h1></div>
    <section className="survival-identity" aria-label={t("玩家身份")}>
      <SurvivalBadge rank={rank}/><div><div className="survival-identity-title"><h2>{localize(SURVIVAL_RANKS[rank].name)}</h2><p>{t("累计经验")} {xp}</p></div><div className="survival-xp-track" role="progressbar" aria-label={t("身份经验进度")} aria-valuemin={SURVIVAL_RANKS[rank].xp} aria-valuemax={next?.xp ?? xp} aria-valuenow={xp}><i style={{ width: `${progress * 100}%` }}/></div><p>{localize(next ? t("距离{0}还需 {1} 经验", next.name, next.xp - xp) : t("荒野传奇 · 继续积累经验"))}</p></div>
    </section>
    <div className="survival-bottom">
      <button className="primary survival-continue" data-sound="handled" disabled={generating !== null || !save.challenge} title={save.challenge ? undefined : t("暂无未完成挑战")} onClick={onContinue}>{save.challenge ? t("继续挑战 · {0}难", save.challenge.difficulty) : t("继续挑战")}<ArrowRight size={20}/></button>
      <button className="secondary survival-records-button" data-sound={records ? 'close' : 'click'} onClick={() => setRecords(!records)} aria-expanded={records}><Flag size={20}/>{t("通关记录 · 共 {0} 次", history.length)}</button>
      <button className="secondary survival-disabled-button" onClick={() => setFacilities(true)}><Ban size={20}/>{t("禁用设施")}</button>
    </div>
    {facilities && <SurvivalFacilityDialog onClose={() => setFacilities(false)}/>}
    <div className="survival-difficulties" aria-label={t("选择难度")}>{SURVIVAL_DIFFICULTIES.map((_, i) => <button key={i} className={`survival-difficulty difficulty-band-${Math.floor(i / 2)}`} data-sound="handled" disabled={generating !== null} onClick={() => { setNoticeKey(key => key + 1); onStart(i + 1); }}><strong>{t("{0}难", i + 1)}</strong><span>{t("通关 {0} 次", counts[i])}</span></button>)}</div>
    {records && <dialog ref={recordsRef} className="modal survival-records record-sheet" aria-label={t("通关记录")} onCancel={event => { event.preventDefault(); audio.feedback('close'); setRecords(false); }}><button className="modal-close icon-button" data-sound="close" aria-label={t("关闭通关记录")} onClick={() => setRecords(false)}><X size={20}/></button><div className="record-sheet-heading"><Flag size={27}/><h2>{t("通关记录")}</h2></div><div className="survival-record-table" role="table" aria-label={t("通关记录")}><div className="survival-record-head" role="row"><span role="columnheader">{t("难度")}</span><span role="columnheader">{t("开始时间")}</span><span role="columnheader">{t("完成时间")}</span></div><div role="rowgroup">{history.map(record => <button className="survival-record-row" data-sound="handled" role="row" key={record.id} disabled={!canReview(record)} title={canReview(record) ? t("复盘") : t("历史地图未保存")} onClick={() => { setRecords(false); onReview(record); }}><strong role="cell">{t("{0}难", record.difficulty)}</strong><span role="cell">{formatDateTime(record.startedAt, language)}</span><span role="cell" className={record.finishedAt === undefined ? 'record-unfinished' : ''}>{record.finishedAt === undefined ? t("已放弃") : formatDateTime(record.finishedAt, language)}</span></button>)}</div></div>{history.length === 0 && <p>{t("暂无记录")}</p>}</dialog>}
  </main><div className="survival-notice-region">{error && <SurvivalNotice key={`${noticeKey}:${error}`} message={error}/>}</div></>;
}
