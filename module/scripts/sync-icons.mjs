// Copies the few Lucide icons we use (ISC licence, https://lucide.dev) into db-assistant.js
// between ICONS:BEGIN / ICONS:END, and writes demo/icons.svg (a sprite for our demo pages).
// Dev convenience only: the shipped module stays one file with no runtime dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const mod = join(here, '..');
const dir = dirname(require.resolve('lucide-static/package.json'));
const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;

// name used in our code -> Lucide icon file
export const MODULE_ICONS = {
  close: 'x', language: 'languages', simple: 'text', online: 'globe', data: 'shield-check',
  send: 'send', mic: 'mic', stop: 'square', talk: 'headset', listen: 'volume-2', sources: 'book-open',
  share: 'screen-share', shareOff: 'screen-share-off', screenshot: 'image', download: 'download',
  trash: 'trash-2', next: 'arrow-right', back: 'arrow-left', check: 'check', idea: 'lightbulb',
  notFound: 'search-x', bot: 'bot', you: 'user', tutor: 'graduation-cap', wifi: 'wifi', wifiOff: 'wifi-off',
  support: 'hand-heart', bell: 'bell', job: 'briefcase', ai: 'sparkles', telegram: 'send', consent: 'shield-check'
};
const PAGE_ICONS = {
  copy: 'copy', code: 'code-xml', palette: 'palette', layout: 'layout-panel-left', position: 'map-pin',
  link: 'link', globe: 'globe', bell: 'bell', check: 'check', sparkles: 'sparkles', book: 'book-open', languages: 'languages',
  eye: 'eye', rocket: 'rocket', terminal: 'terminal', heart: 'heart-handshake', arrowUp: 'arrow-up', arrowRight: 'arrow-right'
};

function inner(file) {
  const svg = readFileSync(join(dir, 'icons', `${file}.svg`), 'utf8');
  return svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}

const map = Object.fromEntries(Object.entries(MODULE_ICONS).map(([k, f]) => [k, inner(f)]));
const block = `/* ICONS:BEGIN */\n  // Lucide ${version} (ISC licence, https://lucide.dev), copied by scripts/sync-icons.mjs.\n  var ICONS = ${JSON.stringify(map, null, 2).replace(/\n/g, '\n  ')};\n  /* ICONS:END */`;
const file = join(mod, 'db-assistant.js');
const src = readFileSync(file, 'utf8');
const out = src.replace(/\/\* ICONS:BEGIN \*\/[\s\S]*?\/\* ICONS:END \*\//, block);
writeFileSync(file, out);

const symbols = Object.entries(PAGE_ICONS).map(([k, f]) =>
  `  <symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner(f)}</symbol>`);
writeFileSync(join(mod, '..', 'demo', 'icons.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg">\n  <!-- Lucide ${version}, ISC licence, https://lucide.dev -->\n${symbols.join('\n')}\n</svg>\n`);
console.log(`icons: ${Object.keys(map).length} in module, ${symbols.length} in demo/icons.svg (Lucide ${version})`);
