import { useEffect, useState } from 'react';
import { useI18n } from '../../localization/LanguageContext';

export function SurvivalNotice({ message }: { message: string }) {
  const { localize } = useI18n();
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 4200); return () => clearTimeout(timer); }, []);
  return visible ? <div className="survival-notice" role="alert"><span>{localize(message)}</span></div> : null;
}
