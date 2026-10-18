import { useI18n } from '../i18n/context';
import newcomer from '../assets/survival-badges/newcomer.svg';
import apprentice from '../assets/survival-badges/apprentice.svg';
import explorer from '../assets/survival-badges/explorer.svg';
import veteran from '../assets/survival-badges/veteran.svg';
import legend from '../assets/survival-badges/legend.svg';
import { survivalRanks } from '../engine';

const badges = [newcomer, apprentice, explorer, veteran, legend];
export function SurvivalBadge({ rank }: { rank: number }) {
  const { t, localize } = useI18n();
  return <div className={`survival-badge badge-rank-${rank}`} role="img" aria-label={localize(t("{0}徽章", survivalRanks[rank].name))}><img src={badges[rank]} alt=""/></div>;
}
