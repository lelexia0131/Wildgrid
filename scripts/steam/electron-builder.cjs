const path = require('node:path');
const { existsSync, unlinkSync } = require('node:fs');
const root = path.resolve(__dirname, '../..');
const work = path.join(process.env.WILDGRID_STEAM_RUN, 'work');
const source = path.join(work, 'source');

module.exports = {
  extends: null,
  appId: 'com.wildgrid.game',
  productName: '野格',
  copyright: 'Copyright © 2026 野格',
  directories: { app: source, buildResources: path.join(source, 'build'), output: path.join(work, 'package') },
  electronDist: path.join(root, 'node_modules/electron/dist'),
  electronVersion: require(path.join(root, 'node_modules/electron/package.json')).version,
  asar: true,
  npmRebuild: false,
  files: ['dist/**/*', 'electron/main.cjs', 'electron/preload.cjs', 'electron/steam-window.cjs', 'build/icon.ico', 'package.json', '!node_modules/**/*', '!**/*.map'],
  win: { executableName: 'Wildgrid', icon: path.join(source, 'build/icon.ico'), signAndEditExecutable: true },
  afterPack(context) {
    if (path.resolve(context.appOutDir) !== path.join(work, 'package/win-unpacked')) throw new Error('Unexpected Steam package directory');
    for (const relative of ['resources/default_app.asar', 'version']) {
      const file = path.join(context.appOutDir, relative);
      if (existsSync(file)) unlinkSync(file);
    }
  },
};
