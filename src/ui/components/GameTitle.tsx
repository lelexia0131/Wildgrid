import { useState } from 'react';
import { useI18n } from '../../localization/LanguageContext';
import { art } from '../../assets/art';

export function GameTitle() {
  const { language, t } = useI18n();
  const [failed, setFailed] = useState<string>();
  return <h1 className={`camp-title camp-title-${language}`} aria-label={t('野格')}>
    <span className="title-sign">
      {failed === language ? <span className="title-fallback">{t('野格')}</span> : <img className="title-lettering" src={art.branding[language]} alt="" draggable={false} onError={() => setFailed(language)}/>}
    </span>
  </h1>;
}
