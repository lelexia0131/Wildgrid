import { useI18n } from '../../localization/LanguageContext';
import newcomer from '../../assets/survival-badges/newcomer.svg';
import apprentice from '../../assets/survival-badges/apprentice.svg';
import explorer from '../../assets/survival-badges/explorer.svg';
import veteran from '../../assets/survival-badges/veteran.svg';
import legend from '../../assets/survival-badges/legend.svg';
import { SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';

const SURVIVAL_BADGES = [newcomer, apprentice, explorer, veteran, legend];
export function SurvivalBadge({ rank }: { rank: number }) {
  const { t, localize } = useI18n();
  return <div className={`survival-badge badge-rank-${rank}`} role="img" aria-label={localize(t("{0}徽章", SURVIVAL_RANKS[rank].name))}><img src={SURVIVAL_BADGES[rank]} alt=""/></div>;
}
