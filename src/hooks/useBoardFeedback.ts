import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Cell, Level, Placement } from '../game/types';
import { occupied } from '../game/rules';

// Animate artwork only: hit targets, grid tracks and saved placements never move.
export function useBoardFeedback(board: RefObject<HTMLElement | null>, level: Level, placements: Placement[], active: boolean) {
  const previous = useRef<{ level: Level; placements: Placement[]; nodes: Map<string, HTMLElement> } | null>(null);
  const animations = useRef(new Set<Animation>());
  const departures = useRef(new Set<HTMLElement>());
  const restoring = useRef(false);
  function animate(node: Element, frames: Keyframe[], duration: number) {
    if (document.hidden || !node.animate) return;
    node.getAnimations().forEach(animation => animation.cancel());
    const animation = node.animate(frames, { duration, easing: 'ease-out' });
    animations.current.add(animation);
    const done = () => animations.current.delete(animation);
    animation.onfinish = done; animation.oncancel = done;
    return animation;
  }
  function reject(cells: Cell[]) {
    cells.forEach(cell => {
      const tile = board.current?.querySelector(`[data-cell="${cell.r},${cell.c}"]`);
      if (tile) animate(tile, [{ backgroundColor: '#e3ab91' }, { backgroundColor: getComputedStyle(tile).backgroundColor }], 260);
    });
  }
  useLayoutEffect(() => {
    const clear = () => {
      animations.current.forEach(animation => animation.cancel()); animations.current.clear();
      departures.current.forEach(node => node.remove()); departures.current.clear();
    };
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const hide = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange', hide);
    preference.addEventListener('change', clear);
    return () => { clear(); document.removeEventListener('visibilitychange', hide); preference.removeEventListener('change', clear); };
  }, []);
  useLayoutEffect(() => {
    const old = previous.current;
    const nodes = new Map(Array.from(board.current?.querySelectorAll<HTMLElement>('[data-art-id]') || []).map(node => [node.dataset.artId!, node]));
    previous.current = active ? { level, placements, nodes } : null;
    departures.current.forEach(node => node.remove()); departures.current.clear();
    const restore = restoring.current; restoring.current = false;
    if (!active || !old || old.level.id !== level.id || old.level.size !== level.size) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    placements.forEach(at => {
      const before = old.placements.find(p => p.id === at.id), node = nodes.get(at.id);
      if (!node || before && before.r === at.r && before.c === at.c && before.rotation === at.rotation) return;
      animate(node, reduced || restore ? [{ opacity: .55 }, { opacity: 1 }] : before
        ? [{ transform: 'rotate(-8deg) scale(.97)' }, { transform: 'rotate(0) scale(1)' }]
        : [{ transform: 'translateY(-5px) scale(.96)' }, { transform: 'translateY(1px) scale(1.025)', offset: .7 }, { transform: 'none' }], 160);
    });
    if (reduced || document.hidden) return;
    old.placements.filter(at => !placements.some(p => p.id === at.id)).forEach(at => {
      const original = old.nodes.get(at.id), piece = old.level.pieces.find(p => p.id === at.id);
      if (!original || !piece) return;
      // Move a short-lived copy into a grid-relative layer, never pixel coordinates.
      const copy = original.cloneNode(true) as HTMLElement, cells = occupied(piece, at);
      const row = Math.min(...cells.map(c => c.r)), column = Math.min(...cells.map(c => c.c));
      copy.removeAttribute('data-art-id'); copy.className = 'departing-facility'; copy.setAttribute('aria-hidden', 'true');
      copy.style.gridRow = `${row + 1} / span ${Math.max(...cells.map(c => c.r)) - row + 1}`;
      copy.style.gridColumn = `${column + 1} / span ${Math.max(...cells.map(c => c.c)) - column + 1}`;
      copy.querySelector('.facility-footprint')?.remove();
      board.current?.querySelector('.departure-art-layer')?.append(copy); departures.current.add(copy);
      const animation = animate(copy, [{ opacity: .8, transform: 'none' }, { opacity: 0, transform: restore ? 'none' : 'translateY(-5px) scale(1.02)' }], 130);
      const remove = () => { copy.remove(); departures.current.delete(copy); if (animation) animations.current.delete(animation); };
      if (animation) { animation.onfinish = remove; animation.oncancel = remove; } else remove();
    });
  }, [active, level, placements, board]);
  return { reject, restoring };
}
