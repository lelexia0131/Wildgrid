import { useEffect, useRef } from 'react';
import type { Language } from '../../localization';

export function useTitleMotion(enabled: boolean, language: Language) {
  const signRef = useRef<HTMLSpanElement>(null);
  const motionRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const sign = signRef.current, motion = motionRef.current, image = imageRef.current;
    if (!enabled || !sign || !motion || !image) return;
    const preference = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
    let mask: ImageData | undefined;
    let frame = 0, previousTime = 0;
    const position = [0, 0, 0], velocity = [0, 0, 0], target = [0, 0, 0];

    // Sample the original alpha once; transparent PNG padding is not a hover target.
    const readMask = () => {
      if (!image.naturalWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = Math.round(512 * image.naturalHeight / image.naturalWidth);
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      mask = context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const tick = (time: number) => {
      const dt = previousTime ? Math.min((time - previousTime) / 1000, .032) : 1 / 60;
      previousTime = time;
      let settled = true;
      // A near-critically damped spring gives the board weight and a tiny return rebound.
      for (let i = 0; i < position.length; i++) {
        velocity[i] += ((target[i] - position[i]) * 150 - velocity[i] * 21) * dt;
        position[i] += velocity[i] * dt;
        if (Math.abs(target[i] - position[i]) > .0001 || Math.abs(velocity[i]) > .0001) settled = false;
      }
      if (settled) position.splice(0, 3, ...target);
      const [x, y, lift] = position;
      motion.style.transform = `perspective(900px) translate3d(${x * 5}px, ${y * 3 - lift * 2}px, 0) rotateX(${-y * 3}deg) rotateY(${x * 3}deg) scale(${1 + lift * .03})`;
      if (!settled) frame = requestAnimationFrame(tick);
      else { frame = 0; previousTime = 0; }
    };
    const animate = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const leave = () => {
      target.fill(0);
      delete sign.dataset.hovered;
      animate();
    };
    const move = (event: PointerEvent) => {
      if (!preference.matches || event.pointerType !== 'mouse' || !mask) return;
      const rect = sign.getBoundingClientRect();
      const scale = language === 'en' ? rect.width / image.naturalWidth : Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      const x = (event.clientX - rect.left - (rect.width - width) / 2) / width;
      const y = (event.clientY - rect.top - (rect.height - height) / 2) / height;
      // Stable layout bounds avoid feedback jitter as the visual layer floats and tilts.
      if (x < 0 || x >= 1 || y < 0 || y >= 1 || mask.data[(Math.floor(y * mask.height) * mask.width + Math.floor(x * mask.width)) * 4 + 3] < 32) {
        if (target[2]) leave();
        return;
      }
      target[0] = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      target[1] = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      target[2] = 1;
      sign.dataset.hovered = 'true';
      animate();
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0; previousTime = 0;
      position.fill(0); velocity.fill(0); target.fill(0);
      delete sign.dataset.hovered;
      motion.style.removeProperty('transform');
    };
    readMask();
    image.addEventListener('load', readMask);
    sign.addEventListener('pointerenter', move);
    sign.addEventListener('pointermove', move);
    sign.addEventListener('pointerleave', leave);
    sign.addEventListener('pointercancel', leave);
    window.addEventListener('blur', leave);
    preference.addEventListener('change', reset);
    return () => {
      reset();
      image.removeEventListener('load', readMask);
      sign.removeEventListener('pointerenter', move);
      sign.removeEventListener('pointermove', move);
      sign.removeEventListener('pointerleave', leave);
      sign.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
      preference.removeEventListener('change', reset);
    };
  }, [enabled, language]);

  return { signRef, motionRef, imageRef };
}
