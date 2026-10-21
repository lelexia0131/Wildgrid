import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src'), engine = path.join(root, 'engine');
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
});
const layerOf = (file: string) => path.relative(root, file).split(path.sep)[0];
const allowed: Record<string, string[]> = {
  engine: ['engine', 'game-data'],
  'game-modes': ['engine', 'game-modes'],
  'save-system': ['engine', 'game-modes', 'save-system', 'localization'],
  platform: ['engine', 'platform'],
  workers: ['engine', 'game-modes', 'workers'],
  localization: ['engine', 'localization'],
};

test('Engine stays independent; every layer uses public APIs without reverse dependencies or cycles', () => {
  const platformGlobals = new Set(['window', 'document', 'localStorage', 'navigator', 'Worker', 'HTMLElement', 'Capacitor', 'ipcRenderer', 'process']);
  const graph = new Map<string, string[]>();
  for (const file of files(root)) {
    const layer = layerOf(file), internal = layer === 'engine';
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies: string[] = [];
    function inspect(specifier: string) {
      if (!specifier.startsWith('.')) {
        if (['engine', 'game-modes', 'save-system', 'workers'].includes(layer)) assert.fail(`${file}: external dependency ${specifier}`);
        return;
      }
      // Vite asset queries such as .svg?url refer to the same source file.
      const target = path.resolve(path.dirname(file), specifier.replace(/[?#].*$/, ''));
      const resolved = [target, target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(resolved, `${file}: missing import ${specifier}`);
      const targetLayer = layerOf(target);
      if (allowed[layer]) assert.ok(allowed[layer].includes(targetLayer), `${file}: reverse dependency ${specifier}`);
      if (!internal && targetLayer === 'engine') assert.ok(target === engine || target === path.join(engine, 'index'), `${file}: private Engine import ${specifier}`);
      if (internal) assert.notEqual(target, path.join(engine, 'index'), `${file}: Engine imports its public barrel`);
      if (/\.tsx?$/.test(resolved)) dependencies.push(resolved);
    }
    const visit = (node: ts.Node) => {
      if (internal && ts.isIdentifier(node)) assert.ok(!platformGlobals.has(node.text), `${file}: platform global ${node.text}`);
      if (internal && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require', `${file}: require dependency`);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) inspect(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) inspect(node.arguments[0].text);
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.[0] && ts.isStringLiteral(node.arguments[0])) inspect(node.arguments[0].text);
      if (layer === 'ui' && ts.isNewExpression(node) && ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'Worker', `${file}: Worker lifecycle belongs in workers`);
      ts.forEachChild(node, visit);
    };
    visit(source); graph.set(file, dependencies);
  }
  const visited = new Set<string>();
  const walk = (file: string, chain: string[]) => {
    assert.ok(!chain.includes(file), `Module cycle: ${[...chain, file].join(' -> ')}`);
    if (visited.has(file)) return;
    for (const dependency of graph.get(file) || []) walk(dependency, [...chain, file]);
    visited.add(file);
  };
  for (const file of graph.keys()) walk(file, []);
});
