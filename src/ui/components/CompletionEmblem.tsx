import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Art } from './Art';

export function CompletionEmblem({ children }: { children: ReactNode }) {
  return <div className="completion-emblem">
    <svg className="completion-landscape" viewBox="0 0 280 210" fill="none" aria-hidden="true">
      <circle cx="140" cy="98" r="86" fill="#f9edc5" stroke="#e4cc8b" strokeWidth="2"/>
      <circle cx="140" cy="98" r="78" stroke="#fffbea" strokeWidth="3"/>
      <circle cx="180" cy="54" r="16" fill="#efd58b"/>
      <path d="m61 124 51-63 48 57 33-39 38 45" fill="#d1ddbd"/>
      <path d="M55 145q40-42 88-8t82-5v23q-82 44-170 0Z" fill="#b8cd9f"/>
      <ellipse cx="140" cy="163" rx="85" ry="18" fill="#91b184"/>
      <path d="M67 184Q25 152 36 96m177 88q42-32 31-88" stroke="#759166" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#9db77f" stroke="#759166" strokeWidth="1.5">
        <path d="M39 138q-26-1-24-22 24 0 24 22Zm7 21q-27 1-29-17 24-3 29 17Zm15 18q-27 9-31-11 23-8 31 11ZM36 118q18-2 20-21-21 1-20 21Zm7 29q19-7 18-25-20 5-18 25Zm13 21q19-9 16-26-19 5-16 26Z"/>
        <path d="M241 138q26-1 24-22-24 0-24 22Zm-7 21q27 1 29-17-24-3-29 17Zm-15 18q27 9 31-11-23-8-31 11ZM244 118q-18-2-20-21 21 1 20 21Zm-7 29q-19-7-18-25 20 5 18 25Zm-13 21q-19-9-16-26 19 5 16 26Z"/>
      </g>
      <g stroke="#759166" strokeWidth="2" strokeLinecap="round"><path d="m79 166 3-9 3 8m104 1 3-8 4 6m-83 13 2-7m54 6 2-7"/></g>
      <g fill="#fff1bd"><circle cx="115" cy="169" r="3"/><circle cx="171" cy="169" r="3"/></g>
      <g className="completion-sparkles" fill="#e2ba59" stroke="#fff7d8" strokeWidth="1">
        <path d="m48 48 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/>
        <path d="m226 59 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>
        <path d="m207 23 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>
      </g>
      <path className="completion-leaf leaf-left" d="M23 72q19-17 23 1-17 13-23-1Z" fill="#a6bc83"/>
      <path className="completion-leaf leaf-right" d="M250 91q-18-17-22 1 17 13 22-1Z" fill="#c7c17e"/>
    </svg>
    <div className="completion-tree tree-left" aria-hidden="true"><Art kind="forest"/></div>
    <div className="completion-tree tree-right" aria-hidden="true"><Art kind="forest"/></div>
    <div className="completion-art">{children}</div>
    <span className="completion-check" aria-hidden="true"><Check size={23} strokeWidth={3}/></span>
  </div>;
}
