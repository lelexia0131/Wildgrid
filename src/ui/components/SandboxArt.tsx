import { art } from '../../assets/art';

export function SandboxArt({ variant }: { variant: 'adventure' | 'sandbox' }) {
  return <img className="sandbox-illustration" src={art.modelScene(variant==='sandbox'?'chapter-1':'home')} alt="" draggable={false} aria-hidden="true"/>;
}
