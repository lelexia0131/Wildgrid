import { art } from '../../assets/art';
import { useI18n } from '../../localization/LanguageContext';
import { SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';


export function SurvivalBadge({ rank }: { rank: number }) {
  const { t, localize } = useI18n();
  return <div className={`survival-badge badge-rank-${rank}`} role="img" aria-label={localize(t("{0}徽章", SURVIVAL_RANKS[rank].name))}><img src={art.badges[rank]} alt=""/></div>;
}
