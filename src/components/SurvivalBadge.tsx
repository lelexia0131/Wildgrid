import newcomer from '../assets/survival-badges/newcomer.svg';
import apprentice from '../assets/survival-badges/apprentice.svg';
import explorer from '../assets/survival-badges/explorer.svg';
import veteran from '../assets/survival-badges/veteran.svg';
import legend from '../assets/survival-badges/legend.svg';
import { survivalRanks } from '../game/survival';

const badges = [newcomer, apprentice, explorer, veteran, legend];
export function SurvivalBadge({ rank }: { rank: number }) {
  return <div className={`survival-badge badge-rank-${rank}`} role="img" aria-label={`${survivalRanks[rank].name}徽章`}><img src={badges[rank]} alt=""/></div>;
}
