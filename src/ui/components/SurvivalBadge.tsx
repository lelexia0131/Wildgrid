import { art } from '../../assets/art';
import { useI18n } from '../../localization/LanguageContext';
import { SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';


export function SurvivalBadge({ rank, animate = false }: { rank: number; animate?: boolean }) {
  const { t, localize } = useI18n();
  return <div className={`survival-badge badge-rank-${rank}${animate ? ' is-upgrading' : ''}`} role="img" aria-label={localize(t("{0}徽章", SURVIVAL_RANKS[rank].name))}><img src={art.survivalBadge(SURVIVAL_RANKS[rank].icon)} alt=""/></div>;
}
