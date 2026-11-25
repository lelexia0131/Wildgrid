import { art } from '../../assets/art';
import { useHeroMotion } from '../hooks/useHeroMotion';

export function HeroArt() {
  const running = useHeroMotion();
  return <img className="landscape hero-art" data-motion={running ? 'running' : 'paused'}
    src={art.modelScene(running ? 'home-motion' : 'home')} width={720} height={468}
    alt="" aria-hidden="true" draggable={false}/>;
}
