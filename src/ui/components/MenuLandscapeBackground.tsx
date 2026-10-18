import diaryBackground from '../../assets/backgrounds/camp-diary.webp';
import survivalBackground from '../../assets/backgrounds/wilderness-survival.webp';
import '../styles/menu-landscape.css';

export function MenuLandscapeBackground({ scene }: { scene: 'diary' | 'survival' }) {
  return <div className="menu-landscape-background" data-scene={scene} aria-hidden="true"><img src={scene === 'diary' ? diaryBackground : survivalBackground} alt="" draggable={false}/></div>;
}
