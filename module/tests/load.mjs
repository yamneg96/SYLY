// Loads db-assistant.js in Node with the smallest fake browser, and returns
// its test internals (search index, i18n, colour helpers).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = join(MODULE_DIR, '..');

export function loadModule() {
  let defined = null;
  const sandbox = {
    window: {},
    document: { currentScript: null },
    location: { href: 'http://localhost:8080/demo/blank.html' },
    HTMLElement: class {},
    CustomEvent: class {},
  };
  sandbox.window.customElements = { get: () => undefined, define: (n, c) => { defined = c; } };
  sandbox.customElements = sandbox.window.customElements;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(MODULE_DIR, 'db-assistant.js'), 'utf8'), sandbox);
  return defined._internals;
}

export function readJson(...parts) {
  return JSON.parse(readFileSync(join(ROOT, ...parts), 'utf8'));
}
