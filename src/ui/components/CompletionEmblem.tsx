import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Art } from './Art';
import { art } from '../../assets/art';

export function CompletionEmblem({ children }: { children: ReactNode }) {
  return <div className="completion-emblem">
    <img className="completion-landscape" src={art.completion} alt="" draggable={false} aria-hidden="true"/>
    <div className="completion-effects" aria-hidden="true">
      <img className="completion-overlay completion-sparkles" src={art.decoration('completion-0')} alt=""/>
      <img className="completion-overlay completion-leaf leaf-left" src={art.decoration('completion-1')} alt=""/>
      <img className="completion-overlay completion-leaf leaf-right" src={art.decoration('completion-2')} alt=""/>
    </div>
    <div className="completion-tree tree-left" aria-hidden="true"><Art kind="forest"/></div>
    <div className="completion-tree tree-right" aria-hidden="true"><Art kind="forest"/></div>
    <div className="completion-art">{children}</div>
    <span className="completion-check" aria-hidden="true"><Check size={23} strokeWidth={3}/></span>
  </div>;
}
