import { cpSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import postcss from 'postcss';

import { source, logs, work, scripts } from './paths.mjs';
import { stageSource, json, sha256 } from './source-record.mjs';
const mode = process.argv[2];
const write = (file, value) => writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');

if (mode === 'stage') {
  stageSource();
  // Resolve the installed toolchain from the repository, never from the shipped game.
  const config = JSON.parse(readFileSync(path.join(source, 'tsconfig.json'), 'utf8'));
  config.compilerOptions.tsBuildInfoFile = path.join(work, 'tsconfig.tsbuildinfo');
  write(path.join(source, 'tsconfig.json'), config);
  console.log('Staged current working tree without changing shared game sources.');
} else if (mode === 'strip') {
  const changes = {};
  function transform(relative, expected, edit) {
    const filename = path.join(source, relative);
    const original = readFileSync(filename, 'utf8');
    const tree = ts.createSourceFile(filename, original, ts.ScriptTarget.Latest, true, relative.endsWith('tsx') ? ts.ScriptKind.TSX : relative.endsWith('cjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const hits = {};
    const hit = name => { hits[name] = (hits[name] || 0) + 1; };
    const result = ts.transform(tree, [context => {
      const visit = node => {
        const edited = edit(node, hit);
        if (edited !== node) return edited;
        return ts.visitEachChild(node, visit, context);
      };
      return node => ts.visitNode(node, visit);
    }]);
    assert.deepEqual(hits, expected, `Source structure changed; review Steam AST rules for ${relative}`);
    write(filename, ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false }).printFile(result.transformed[0]));
    result.dispose();
    changes[relative] = { removed: hits, originalSha256: createHash('sha256').update(original).digest('hex') };
  }
  const includesIdentifier = (node, name) => {
    if (ts.isIdentifier(node) && node.text === name) return true;
    return !!ts.forEachChild(node, child => includesIdentifier(child, name));
  };
  const variableName = node => ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 ? node.declarationList.declarations[0].name : undefined;
  const callFromStatement = node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) ? node.expression : undefined;

  transform('src/ui/App.tsx', { import: 1, state: 3, effect: 1, row: 1 }, (node, hit) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '../platform/playerId') { hit('import'); return undefined; }
    const name = variableName(node);
    if (name && ((ts.isArrayBindingPattern(name) && ['playerId', 'playerIdLoading'].includes(name.elements[0]?.name?.text)) || (ts.isIdentifier(name) && name.text === 'playerIdStarted'))) { hit('state'); return undefined; }
    const call = callFromStatement(node);
    if (call && ts.isIdentifier(call.expression) && call.expression.text === 'useEffect' && includesIdentifier(call, 'resolvePlayerId')) { hit('effect'); return undefined; }
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.text === 'className' && p.initializer?.text === 'player-id-setting')) { hit('row'); return undefined; }
    return node;
  });
  transform('src/localization/ui.ts', { text: 3 }, (node, hit) => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ['玩家 ID', '获取中…', '暂未获取'].includes(node.name.text)) { hit('text'); return undefined; }
    return node;
  });
  transform('electron/main.cjs', { import: 4, state: 2, function: 4, ipc: 1 }, (node, hit) => {
    const name = variableName(node);
    if (name) {
      const initializer = node.declarationList.declarations[0].initializer;
      if (initializer && ts.isCallExpression(initializer) && initializer.expression.text === 'require' && ['node:child_process', 'node:crypto', 'node:fs/promises', 'node:https'].includes(initializer.arguments[0]?.text)) { hit('import'); return undefined; }
      if (ts.isIdentifier(name) && ['PLAYER_ID_CACHE_VERSION', 'playerIdRequest'].includes(name.text)) { hit('state'); return undefined; }
    }
    if (ts.isFunctionDeclaration(node) && ['validPlayerId', 'getDeviceHash', 'requestPlayerId', 'resolvePlayerId'].includes(node.name?.text)) { hit('function'); return undefined; }
    const call = callFromStatement(node);
    if (call && ts.isPropertyAccessExpression(call.expression) && call.expression.expression.text === 'ipcMain' && call.expression.name.text === 'handle' && call.arguments[0]?.text === 'wildgrid:player-id-resolve') { hit('ipc'); return undefined; }
    return node;
  });
  transform('electron/preload.cjs', { bridge: 1 }, (node, hit) => {
    const call = callFromStatement(node);
    if (call && ts.isPropertyAccessExpression(call.expression) && call.expression.expression.text === 'contextBridge' && call.expression.name.text === 'exposeInMainWorld' && call.arguments[0]?.text === 'wildgridPlayerId') { hit('bridge'); return undefined; }
    return node;
  });
  for (const [relative, expected] of [['src/ui/styles/styles.css', 4], ['src/ui/styles/fonts.css', 1]]) {
    const filename = path.join(source, relative);
    const tree = postcss.parse(readFileSync(filename, 'utf8'));
    let count = 0;
    tree.walkRules(rule => {
      const kept = rule.selectors.filter(selector => !selector.includes('.player-id-'));
      if (kept.length === rule.selectors.length) return;
      count += rule.selectors.length - kept.length;
      if (kept.length) rule.selectors = kept; else rule.remove();
    });
    assert.equal(count, expected, `CSS structure changed: ${relative}`);
    write(filename, tree.toString());
    changes[relative] = { removedSelectors: count };
  }
  unlinkSync(path.join(source, 'src/platform/playerId.ts'));
  write(path.join(logs, 'source-pruning.json'), changes);
  // The adapter exists only in generated Steam sources; shared platform entries stay intact.
  const mainPath = path.join(source, 'electron/main.cjs');
  let main = readFileSync(mainPath, 'utf8');
  assert.equal(main.split('new BrowserWindow({').length, 2);
  assert.equal(main.split('window.loadURL(GAME_URL);').length, 2);
  main = "const { windowOptions, attachWindow } = require('./steam-window.cjs');\n" + main;
  // Options come last so the shared dimensions cannot overwrite display-aware bounds.
  main = main.replace('window.loadURL(GAME_URL);', 'attachWindow(window, GAME_URL);\n    window.loadURL(GAME_URL);');
  const tree = ts.createSourceFile('main.cjs', main, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edit = ts.transform(tree, [context => {
    const visit = node => {
      if (ts.isNewExpression(node) && node.expression.getText(tree) === 'BrowserWindow') {
        const options = node.arguments[0];
        return ts.factory.updateNewExpression(node, node.expression, node.typeArguments, [ts.factory.updateObjectLiteralExpression(options, [...options.properties, ts.factory.createSpreadAssignment(ts.factory.createCallExpression(ts.factory.createIdentifier('windowOptions'), undefined, []))])]);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  write(mainPath, ts.createPrinter().printFile(edit.transformed[0]));
  edit.dispose();
  cpSync(path.join(scripts, 'runtime/steam-window.cjs'), path.join(source, 'electron/steam-window.cjs'));
  const preloadPath = path.join(source, 'electron/preload.cjs');
  write(preloadPath, readFileSync(preloadPath, 'utf8') + '\n' + readFileSync(path.join(scripts, 'runtime/steam-preload.cjs'), 'utf8'));
  const appPath = path.join(source, 'src/ui/App.tsx');
  const app = readFileSync(appPath, 'utf8');
  assert.equal(app.split('<TutorialSettings ').length, 2);
  write(appPath, "import { SteamDisplaySettings } from './components/SteamDisplaySettings';\n" + app.replace(/(<TutorialSettings\b[^>]*\/>)/, '$1<SteamDisplaySettings/>'));
  for (const name of ['SteamDisplaySettings.tsx', 'steam-display.css']) cpSync(path.join(scripts, 'runtime', name), path.join(source, 'src/ui/components', name));
  const allowed = new Set([...Object.keys(changes), 'src/platform/playerId.ts']);
  const record = json(path.join(logs, 'source-record.json'));
  const shared = record.manifest.filter(item => item.path.startsWith('src/') && !allowed.has(item.path));
  for (const item of shared) assert.equal(sha256(readFileSync(path.join(source, item.path))), item.sha256, `Unexpected shared gameplay change: ${item.path}`);
  write(path.join(logs, 'shared-source-parity.json'), { passed: true, files: shared.length, unchanged: shared, intentionalChanges: [...allowed], added: ['electron/steam-window.cjs', 'src/ui/components/SteamDisplaySettings.tsx', 'src/ui/components/steam-display.css'] });
  console.log('Steam source pruning passed: ID module, device lookup, requests, cache, retry, IPC, bridge, UI, translations and CSS removed.');
} else {
  throw new Error('Usage: node prepare-source.mjs stage|strip');
}
