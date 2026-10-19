import { useState } from 'react';
import { useI18n } from '../../localization/LanguageContext';
import { art } from '../../assets/art';
import { useHeroMotion } from '../hooks/useHeroMotion';
import { useTitleMotion } from '../hooks/useTitleMotion';

export function GameTitle({ entering = false }: { entering?: boolean }) {
  const { language, t } = useI18n();
  const [failed, setFailed] = useState<string>();
  const [entered, setEntered] = useState(!entering);
  const ready = !entering || entered;
  const running = useHeroMotion();
  const { signRef, motionRef, imageRef } = useTitleMotion(ready && running, language);
  return <h1 className={`camp-title camp-title-${language}`} aria-label={t('野格')} onAnimationEnd={event => {
    if (event.target === event.currentTarget && event.animationName === 'home-title') setEntered(true);
  }}>
    <span ref={signRef} className="title-sign" data-ready={ready} data-motion={running ? 'running' : 'paused'}>
      <span ref={motionRef} className="title-interaction"><span className="title-float">
        {failed === language ? <span className="title-fallback">{t('野格')}</span> : <img ref={imageRef} className="title-lettering" src={art.branding[language]} alt="" draggable={false} onError={() => setFailed(language)}/>}
      </span></span>
    </span>
  </h1>;
}
