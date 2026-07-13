import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceBundle = path.join(root, 'dist', 'apple-home-dashboard.js');
const labBundle = path.join(root, 'dist', 'apple-home-dashboard-lab.js');

export function transformBundle(source) {
  return source.replaceAll('apple-home-', 'apple-home-lab-');
}

function buildLab() {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'webpack', 'bin', 'webpack.js')], {
    cwd: root,
    stdio: 'inherit',
  });

  const source = readFileSync(sourceBundle, 'utf8');
  const transformed = transformBundle(source);
  const forbidden = [
    'customElements.define("apple-home-card"',
    'customElements.define("apple-home-view"',
    'll-strategy-apple-home-strategy',
    'custom:apple-home-strategy',
  ];
  const survivor = forbidden.find(value => transformed.includes(value));
  if (survivor) {
    throw new Error(`Lab isolation failed; original registration survived: ${survivor}`);
  }

  writeFileSync(labBundle, transformed);
  console.log(`Wrote isolated lab bundle: ${path.relative(root, labBundle)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildLab();
}
