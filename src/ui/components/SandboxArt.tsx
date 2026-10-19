import { art } from '../../assets/art';

export function SandboxArt({ variant }: { variant: 'adventure' | 'sandbox' }) {
  return <img className="sandbox-illustration" src={art.illustration(variant)} alt="" draggable={false} aria-hidden="true"/>;
}
