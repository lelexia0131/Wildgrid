import type { Language } from './index';

export function formatDateTime(at: number | undefined, language: Language): string {
  if (at === undefined) return '—';
  // The device supplies the time zone; language only selects the display format.
  const formatter = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  if (language !== 'zh') return formatter.format(at);
  const parts = Object.fromEntries(formatter.formatToParts(at).map(({ type, value }) => [type, value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
