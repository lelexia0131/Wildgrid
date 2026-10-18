import { createContext, useContext } from 'react';
import type { Language } from './index';
import { UI_CHINESE_OVERRIDES, UI_ENGLISH } from './ui';
import type { UIKey } from './ui';

export const LanguageContext = createContext<Language>('zh');
const TRANSLATION_TEMPLATES = Object.entries(UI_ENGLISH).filter(([key]) => /\{\d+\}/.test(key)).map(([key, translation]) => {
  const parts = key.split(/(\{\d+\})/);
  const indexes: number[] = [];
  const pattern = parts.map(part => {
    if (/^\{\d+\}$/.test(part)) { indexes.push(Number(part.slice(1, -1))); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { regex: new RegExp(`^${pattern}$`), translation, indexes };
});
export function createTranslator(language: Language) {
  const localize = (text: string): string => {
    if (language === 'zh' || !text) return UI_CHINESE_OVERRIDES[text as UIKey] || text;
    const exact = UI_ENGLISH[text as UIKey];
    if (exact) return exact;
    for (const { regex, translation, indexes } of TRANSLATION_TEMPLATES) {
      const match = regex.exec(text);
      if (match) return translation.replace(/\{(\d+)\}/g, (_, i: string) => localize(match[indexes.indexOf(Number(i)) + 1] || ''));
    }
    return text.includes('；') ? text.split('；').map(localize).join('; ') : text;
  };
  const t = (key: UIKey, ...values: (string | number | undefined | null)[]): string => (language === 'zh' ? key : UI_ENGLISH[key]).replace(/\{(\d+)\}/g, (_, i: string) => localize(String(values[Number(i)] ?? '')));
  return { t, localize, language };
}
export function useI18n() { return createTranslator(useContext(LanguageContext)); }
