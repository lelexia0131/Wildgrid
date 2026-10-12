import { useEffect, useState } from 'react';

// App stays mounted across navigation, so this state lasts for the current run.
export function useHomeEntrance(onHome: boolean) {
  const [entering, setEntering] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!entering) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setEntering(false);
    if (!onHome || preference.matches) { finish(); return; }

    const onPreference = () => { if (preference.matches) finish(); };
    const timeout = window.setTimeout(finish, 2200);
    // Observe input without consuming it; the same gesture still works normally.
    window.addEventListener('pointerdown', finish, { capture: true, passive: true });
    window.addEventListener('click', finish, true);
    window.addEventListener('keydown', finish, true);
    preference.addEventListener('change', onPreference);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', finish, true);
      window.removeEventListener('click', finish, true);
      window.removeEventListener('keydown', finish, true);
      preference.removeEventListener('change', onPreference);
    };
  }, [onHome, entering]);

  return onHome && entering;
}
