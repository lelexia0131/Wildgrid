import { art } from '../../assets/art';
import '../styles/menu-landscape.css';
import { useHeroMotion } from '../hooks/useHeroMotion';

export function MenuLandscapeBackground({ scene,chapter=0 }: { scene: 'home' | 'diary' | 'survival';chapter?:number }) {
  const running = useHeroMotion();
  if (scene === 'home') return <div className="menu-landscape-background home-landscape" data-motion={running ? 'running' : 'paused'} aria-hidden="true">
    <picture><source media="(orientation: portrait)" srcSet={art.backgrounds.portrait}/><img src={art.backgrounds.home} alt="" draggable={false}/></picture>
    <span className="home-mote mote-one"/><span className="home-mote mote-two"/><span className="home-mote mote-three"/>
  </div>;
  return <div className="menu-landscape-background journal-wash" data-scene={scene} aria-hidden="true"><img src={art.modelScene('chapter-'+chapter)} alt="" draggable={false}/></div>;
}
