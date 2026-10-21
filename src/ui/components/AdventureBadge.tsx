import { useId } from 'react';
import { ADVENTURE_BADGES, adventureBadgeCounts } from '../../game-modes/adventure/adventureBadges';
import type { AdventureBadgeTier } from '../../game-modes/adventure/adventureBadges';
import type { HintBadgeConfirmation } from '../hooks/useAdventureHintAccess';
import { useI18n } from '../../localization/LanguageContext';

const materials = {
  gold: ['#fff1b2', '#e8bd56', '#a97935'], silver: ['#f3f7ed', '#b9c9c8', '#748b8d'],
  bronze: ['#f0c8a1', '#cc925d', '#875936'], wood: ['#e3c897', '#ba9160', '#7e6144'],
} as const;
export function AdventureBadgeIcon({ tier }: { tier: AdventureBadgeTier }) {
  const { t } = useI18n();
  const id = `medal-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [light, middle, dark] = materials[tier];
  return <svg className={`adventure-badge-icon badge-${tier}`} data-badge={tier} viewBox="0 0 96 104" fill="none" role="img" aria-label={t(ADVENTURE_BADGES[tier].name)}>
    <defs><linearGradient id={id} x1="20" y1="15" x2="77" y2="78" gradientUnits="userSpaceOnUse"><stop stopColor={light}/><stop offset=".55" stopColor={middle}/><stop offset="1" stopColor={dark}/></linearGradient></defs>
    <path d="m25 64-7 32 16-6 10 10 6-31m20-5 8 32-16-6-10 10-6-31" fill="#7b9670" stroke="#526f53" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="m27 73-4 16 10-4m34-12 5 16-10-4" stroke="#c0ce9a" strokeWidth="2" strokeLinecap="round"/>
    <path d="M48 6c8-1 10 5 17 5 6 1 8 8 13 12 6 5 4 12 7 18 3 7-2 13-3 20-1 7-9 10-13 15-5 6-13 4-21 7-7-2-15-1-20-7-5-5-13-8-14-15-1-7-6-13-3-20 3-6 1-13 7-18 5-4 7-11 13-12 7 0 10-6 17-5Z" fill={`url(#${id})`} stroke={dark} strokeWidth="3" strokeLinejoin="round"/>
    <circle cx="48" cy="45" r="29" fill={light} fillOpacity=".4" stroke={dark} strokeWidth="1.5"/>
    <path d="M26 34c3-9 11-14 20-14" stroke={light} strokeWidth="3" strokeLinecap="round"/>
    {tier === 'wood' ? <path d="m23 30 14-3m26 0 10 3m-51 28 12 4m29-3 10-3m-34 17 17-1" stroke={dark} strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round"/> : <path d="m24 28 5-5m39 38 5-6" stroke={light} strokeWidth="3" strokeLinecap="round"/>}
    <path d="M28 56c-6-3-8-8-8-13 6 0 10 3 11 8m-1 11c-6 0-11-3-12-8 6-2 11 0 14 4m36-2c6-3 8-8 8-13-6 0-10 3-11 8m1 11c6 0 11-3 12-8-6-2-11 0-14 4" fill="#78906a" stroke="#566d4d" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="m48 27-15 29h30L48 27Z" fill={dark} stroke={dark} strokeWidth="2" strokeLinejoin="round"/>
    <path d="m48 33-8 19h8V33Z" fill={light}/><path d="m48 33 8 19h-8V33Z" fill="#8eac79"/>
    <path d="M32 61h32" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/>
    <path d="m48 11 1.6 3.3 3.6.5-2.6 2.6.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.6 3.6-.5Z" fill={dark}/>
    {tier === 'gold' && <path d="m12 8 1.5 4.5L18 14l-4.5 1.5L12 20l-1.5-4.5L6 14l4.5-1.5ZM84 20l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#dfb247"/>}
  </svg>;
}

export function AdventureBadgeAward({ tier, first }: { tier: AdventureBadgeTier; first: boolean }) {
  const { t } = useI18n();
  if (!first) return null;
  const badge = ADVENTURE_BADGES[tier];
  return <div className={`adventure-badge-award badge-${tier} is-awarded`} data-first-award={first}>
    <div className="adventure-badge-display"><AdventureBadgeIcon tier={tier}/>{first && <div className="adventure-badge-particles" aria-hidden="true">{Array.from({ length: tier === 'gold' ? 8 : tier === 'silver' ? 4 : tier === 'bronze' ? 2 : 0 }, (_, i) => <i key={i} style={{ '--particle': i, left: `${10 + i * 31 % 85}%`, top: `${10 + i * 27 % 75}%` } as React.CSSProperties}>✦</i>)}</div>}</div>
    <div><strong>{t(badge.name)}</strong><p>{t(badge.review)}</p></div>
  </div>;
}

export function AdventureBadgeStats({ badges }: { badges: Readonly<Record<number, AdventureBadgeTier>> }) {
  const { t } = useI18n();
  const counts = adventureBadgeCounts(badges);
  return <div className="adventure-badge-stats" aria-label={t("首次通关徽章统计")}>{(Object.keys(ADVENTURE_BADGES) as AdventureBadgeTier[]).map(tier => <div key={tier}><AdventureBadgeIcon tier={tier}/><span><strong>{counts[tier]}</strong></span></div>)}</div>;
}

export function AdventureHintConfirmation({ pending, onConfirm, onCancel }: { pending: HintBadgeConfirmation; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return <div className="hint-badge-confirmation"><h2>{t("使用提示会影响首次徽章")}</h2><div className="hint-badge-change"><AdventureBadgeIcon tier={pending.from}/><span aria-hidden="true">→</span><AdventureBadgeIcon tier={pending.to}/></div><p>{t("本次提示增加 {0} 点，预计首次通关徽章将从「{1}」变为「{2}」。", pending.cost, t(ADVENTURE_BADGES[pending.from].name), t(ADVENTURE_BADGES[pending.to].name))}</p><p>{t("首次通关获得的徽章会永久保留。仍要查看这条提示吗？")}</p><div className="sandbox-modal-actions"><button className="secondary" onClick={onCancel}>{t("暂不查看")}</button><button className="primary" onClick={onConfirm}>{t("查看提示")}</button></div></div>;
}
