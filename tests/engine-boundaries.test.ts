import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src'), engine = path.join(root, 'engine');
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
});

test('Engine stays independent and consumers use its public entry', () => {
  const platformGlobals = new Set(['window', 'document', 'localStorage', 'navigator', 'Worker', 'HTMLElement', 'Capacitor', 'ipcRenderer', 'process']);
  const graph = new Map<string, string[]>();
  for (const file of files(root)) {
    const internal = path.dirname(file) === engine;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies: string[] = [];
    const visit = (node: ts.Node) => {
      if (internal && ts.isIdentifier(node)) assert.ok(!platformGlobals.has(node.text), `${file}: platform global ${node.text}`);
      if (internal && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require', `${file}: require dependency`);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text, target = path.resolve(path.dirname(file), specifier);
        if (internal) {
          assert.ok(specifier.startsWith('.'), `${file}: external dependency ${specifier}`);
          assert.ok(target.startsWith(engine + path.sep) || target.startsWith(path.join(root, 'data') + path.sep), `${file}: reverse dependency ${specifier}`);
          if (target.startsWith(engine + path.sep)) dependencies.push(target + '.ts');
        } else if (target.startsWith(engine + path.sep)) assert.equal(target, path.join(engine, 'index'), `${file}: private Engine import ${specifier}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (internal) graph.set(file, dependencies);
  }
  const visited = new Set<string>();
  const walk = (file: string, chain: string[]) => {
    assert.ok(!chain.includes(file), `Engine cycle: ${[...chain, file].join(' -> ')}`);
    if (visited.has(file)) return;
    for (const dependency of graph.get(file) || []) walk(dependency, [...chain, file]);
    visited.add(file);
  };
  for (const file of graph.keys()) walk(file, []);
});
