import { Capacitor } from '@capacitor/core';

export function isAndroidPlatform() {
  return Capacitor.getPlatform() === 'android' || /Android/i.test(navigator.userAgent);
}

export function registerOfflineCache() {
  if (import.meta.env.PROD && !Capacitor.isNativePlatform() && ['http:', 'https:'].includes(location.protocol) && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); });
  }
}
