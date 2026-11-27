import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { serviceWorkerPlugin } from './src/sw-plugin.ts';

/** package.json: its name is the app's id (the storage key and the service worker's cache prefix), its version the app's. */
function appPackage(): { name: string; version: string } {
  const pkg: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));
  if (
    typeof pkg === 'object' &&
    pkg !== null &&
    'name' in pkg &&
    typeof pkg.name === 'string' &&
    'version' in pkg &&
    typeof pkg.version === 'string'
  )
    return { name: pkg.name, version: pkg.version };
  throw new Error('package.json has no name or version');
}

/**
 * The date of the last commit that changed what ships (YYYY-MM-DD), not of the build: a rebuild
 * or a docs-only commit makes the same files, so phones keep their cache. CI needs the whole
 * history for it (a shallow clone gives the last commit's date). Today's date without git.
 */
function appDate(): string {
  const shipped = ['src', 'public', 'index.html', ':(exclude,glob)src/**/*.test.ts', ':(exclude)src/testing.ts'];
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...shipped], {
      cwd: import.meta.dirname,
      encoding: 'utf8',
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(date)) return date;
  } catch {
    // not a git checkout
  }
  return new Date().toISOString().slice(0, 10);
}

const APP = appPackage();

export default defineConfig({
  // Relative base lets the build work both on GitHub Pages (/<repo>/) and from any static folder.
  base: './',
  define: { __APP_ID__: JSON.stringify(APP.name), __APP_VERSION__: JSON.stringify(APP.version), __APP_DATE__: JSON.stringify(appDate()) },
  plugins: [serviceWorkerPlugin({ appId: APP.name, publicDir: resolve(import.meta.dirname, 'public') })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
