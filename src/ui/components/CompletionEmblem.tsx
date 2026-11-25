import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export function CompletionEmblem({children}:{children?:ReactNode}) {
  return <div className="completion-stamp" aria-hidden="true">{children ?? <Check size={28} strokeWidth={3}/>}</div>;
}
