import { useEffect, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { art } from '../../assets/art';
import { SurvivalNotice } from './SurvivalNotice';
import { FacilityArt } from './Art';
import { useI18n } from '../../localization/LanguageContext';
import { facilityNames, shapeNames } from '../../engine';
import { facilityKey, SURVIVAL_FACILITIES, facilityRestrictionError } from '../../game-modes/survival/survivalFacilities';
import { readDisabledFacilities, writeDisabledFacilities } from '../../save-system/survivalFacilityStorage';

export function SurvivalFacilityDialog({ onClose }: { onClose: () => void }) {
  const { t, localize, language } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [disabled, setDisabled] = useState(readDisabledFacilities);
  const [error, setError] = useState({ message: '', key: 0 });
  useEffect(() => { ref.current?.showModal(); }, []);
  function update(next: string[]) {
    const restriction = facilityRestrictionError(1, next);
    if (restriction) { setError(e => ({ message: restriction, key: e.key + 1 })); return; }
    try { writeDisabledFacilities(next); setDisabled(next); setError(e => ({ message: '', key: e.key + 1 })); }
    catch (cause) { setError(e => ({ message: (cause as Error).message, key: e.key + 1 })); }
  }
  return <dialog ref={ref} className="modal survival-facilities" aria-labelledby="disabled-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="survival-facility-panel">
    <img className="survival-facility-frame" src={art.survivalFacilities} width={1448} height={1086} alt="" aria-hidden="true"/>
    <button className="modal-close icon-button" data-sound="close" aria-label={t('关闭')} onClick={onClose}><X size={24}/></button>
    <h2 id="disabled-title">{t('禁用设施')}</h2>
    <div className="survival-facility-grid">{SURVIVAL_FACILITIES.map(piece => {
      const id = facilityKey(piece), banned = disabled.includes(id);
      return <button key={id} aria-pressed={banned} aria-label={`${piece.kind === 'camp' ? localize(shapeNames[piece.shape]) : ''}${localize(facilityNames[piece.kind])} · ${banned ? t('已禁用') : t('允许出现')}`} className={banned ? 'is-disabled' : ''} onClick={() => update(banned ? disabled.filter(key => key !== id) : [...disabled, id])}>
        <span className="disabled-facility-art"><FacilityArt kind={piece.kind} shape={piece.shape}/></span><strong>{piece.kind === 'camp' ? localize(`营地（${shapeNames[piece.shape]}）`) : piece.kind === 'cabin' && language === 'en' ? t('木屋') : piece.kind === 'tower' && language === 'en' ? t('瞭望') : piece.kind === 'powerTower' && language === 'en' ? t('输电塔') : localize(facilityNames[piece.kind])}</strong></button>;
    })}<button className="survival-facility-reset" onClick={() => update([])}><RotateCcw aria-hidden="true"/><strong>{t('恢复默认')}</strong></button></div>
    {error.message && <SurvivalNotice key={error.key} message={error.message}/>}
    </div>
  </dialog>;
}
