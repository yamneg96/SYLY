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
  trash: 'trash-2', next: 'arrow-right', back: 'arrow-left', check: 'check',
  bot: 'bot', you: 'user', tutor: 'graduation-cap',
  job: 'briefcase', ai: 'sparkles', telegram: 'send', consent: 'shield-check'
};
const PAGE_ICONS = {
  copy: 'copy', code: 'code-xml', palette: 'palette', layout: 'layout-panel-left', position: 'map-pin',
  link: 'link', globe: 'globe', bell: 'bell', check: 'check', sparkles: 'sparkles', book: 'book-open', languages: 'languages',
  eye: 'eye', rocket: 'rocket', terminal: 'terminal', heart: 'heart-handshake', arrowUp: 'arrow-up', arrowRight: 'arrow-right',
  talk: 'headset', listen: 'volume-2', offline: 'wifi-off', shield: 'shield-check', a11y: 'accessibility', server: 'server',
  zap: 'zap', ok: 'circle-check', plug: 'plug', sun: 'sun', moon: 'moon', droplet: 'droplet', panel: 'panel-right',
  inline: 'text-cursor-input', toEnd: 'arrow-right-to-line', toStart: 'arrow-left-to-line', external: 'external-link', bot: 'bot'
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

// The SYLY logo (traced from .claude/assets/SYLY-voice-icon-bw.png; master: demo/assets/syly-logo.svg).
// Colours come from --logo-a (square, bars) and --logo-b (bubble, dot) on the <svg> that uses it.
const LOGO_SYMBOL = '  <symbol id="i-logo" viewBox="0 0 200 200">' +
  '<rect width="200" height="200" rx="46" style="fill:var(--logo-a,#000000)"/>' +
  '<rect x="28" y="52" width="143" height="83" rx="9" style="fill:var(--logo-b,#FFFFFF)"/>' +
  '<path d="M72 134H104L72 163Z" style="fill:var(--logo-b,#FFFFFF)"/>' +
  '<circle cx="164" cy="40" r="16" style="fill:var(--logo-a,#000000)"/><circle cx="164" cy="40" r="12" style="fill:var(--logo-b,#FFFFFF)"/>' +
  '<path d="M55.5 84V103M77.5 72V115M99.5 62V125M121.5 72V115M143.5 84V103" style="fill:none;stroke:var(--logo-a,#000000);stroke-width:12;stroke-linecap:round"/>' +
  '</symbol>';
const symbols = [LOGO_SYMBOL].concat(Object.entries(PAGE_ICONS).map(([k, f]) =>
  `  <symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner(f)}</symbol>`));
writeFileSync(join(mod, '..', 'demo', 'icons.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg">\n  <!-- Lucide ${version}, ISC licence, https://lucide.dev -->\n${symbols.join('\n')}\n</svg>\n`);
console.log(`icons: ${Object.keys(map).length} in module, ${symbols.length} in demo/icons.svg (Lucide ${version})`);
