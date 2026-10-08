import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Flag, X } from 'lucide-react';
import { SurvivalBadge } from './SurvivalBadge';
import { rankFor, survivalDifficulties, survivalRanks, survivalTotals } from '../game/survival';
import type { SurvivalSave } from '../game/survival';

export function SurvivalMenu({ save, generating, error, onStart, onContinue, onBack, onCancel }: {
  save: SurvivalSave; generating: number | null; error: string;
  onStart: (difficulty: number) => void; onContinue: () => void; onBack: () => void; onCancel: () => void;
}) {
  const [records, setRecords] = useState(false);
  const recordsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (records) recordsRef.current?.showModal(); }, [records]);
  const { counts, total, xp } = survivalTotals(save), rank = rankFor(xp), next = survivalRanks[rank + 1];
  const progress = next ? (xp - survivalRanks[rank].xp) / (next.xp - survivalRanks[rank].xp) : 1;
  return <main className="survival-page">
    <div className="survival-heading"><button className="back-link" onClick={onBack} disabled={generating !== null}><ArrowLeft size={20}/>返回</button><h1>荒野求生</h1></div>
    <section className="survival-identity" aria-label="玩家身份">
      <SurvivalBadge rank={rank}/><div><div className="survival-identity-title"><h2>{survivalRanks[rank].name}</h2><p>累计经验 {xp}</p></div><div className="survival-xp-track" role="progressbar" aria-label="身份经验进度" aria-valuemin={survivalRanks[rank].xp} aria-valuemax={next?.xp ?? xp} aria-valuenow={xp}><i style={{ width: `${progress * 100}%` }}/></div><p>{next ? `距离${next.name}还需 ${next.xp - xp} 经验` : '荒野传奇 · 继续积累经验'}</p></div>
    </section>
    <div className="survival-difficulties" aria-label="选择难度">{survivalDifficulties.map((_, i) => <button key={i} className={`survival-difficulty difficulty-band-${Math.floor(i / 2)}`} disabled={generating !== null} onClick={() => onStart(i + 1)}><strong>{i + 1}难</strong><span>通关 {counts[i]} 次</span></button>)}</div>
    <div className="survival-bottom">
      {save.challenge && <button className="primary" disabled={generating !== null} onClick={onContinue}>继续挑战 · {save.challenge.difficulty}难<ArrowRight size={20}/></button>}
      <button className="secondary" onClick={() => setRecords(!records)} aria-expanded={records}><Flag size={20}/>通关记录 · 共 {total} 次</button>
    </div>
    {records && <dialog ref={recordsRef} className="modal survival-records" aria-label="通关记录" onCancel={event => { event.preventDefault(); setRecords(false); }}><button className="modal-close icon-button" aria-label="关闭通关记录" onClick={() => setRecords(false)}><X size={20}/></button><h2>通关记录</h2><p>总通关 {total} 次 · 累计经验 {xp}</p><div>{counts.map((count, i) => <p key={i}><strong>{i + 1}难 · {count} 次</strong><span>每次 +{survivalDifficulties[i].xp} 经验</span></p>)}</div></dialog>}
    {generating !== null && <div className="survival-generating" role="status"><span className="survival-spinner"/><p>正在生成 {generating}难地图并验证唯一解…</p><button className="secondary" onClick={onCancel}><X size={18}/>取消生成</button></div>}
    {error && <p className="survival-error" role="alert">{error}</p>}
  </main>;
}
