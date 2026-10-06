import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, writeFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  server: { watch: { ignored: ['**/release/**', '**/build/**', '**/.desktop-smoke/**'] } },
  plugins: [react(), {
    name: 'wildgrid-offline',
    closeBundle() {
      const assets = readdirSync('dist/assets').map(name => `./assets/${name}`);
      const version = `wildgrid-${Date.now()}`;
      writeFileSync('dist/sw.js', `const CACHE=${JSON.stringify(version)};const FILES=${JSON.stringify(['./', './index.html', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest', ...assets])};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wildgrid-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))});`);
    }
  }]
});
