import { useEffect, useState } from 'react';

// CSS handles each frame; React only tracks page visibility and OS preferences.
export function useHeroMotion() {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRunning(!document.hidden && !preference.matches);
    sync();
    document.addEventListener('visibilitychange', sync);
    preference.addEventListener('change', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      preference.removeEventListener('change', sync);
    };
  }, []);
  return running;
}
