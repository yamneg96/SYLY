// Inlines module/i18n/{en,am,ar}.json into db-assistant.js between the
// I18N:BEGIN / I18N:END markers. Dev convenience only: the committed
// db-assistant.js is the shipped file; nothing is built on the judge's machine.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mod = join(here, '..');
const INLINE = ['en', 'am', 'ar'];

const dicts = Object.fromEntries(INLINE.map((l) => [l, JSON.parse(readFileSync(join(mod, 'i18n', `${l}.json`), 'utf8'))]));
const block = `/* I18N:BEGIN */\n  var I18N = ${JSON.stringify(dicts, null, 2).replace(/\n/g, '\n  ')};\n  /* I18N:END */`;

const file = join(mod, 'db-assistant.js');
const src = readFileSync(file, 'utf8');
const out = src.replace(/\/\* I18N:BEGIN \*\/[\s\S]*?\/\* I18N:END \*\//, block);
if (out === src) console.log('i18n already in sync');
else { writeFileSync(file, out); console.log('i18n inlined into db-assistant.js'); }
