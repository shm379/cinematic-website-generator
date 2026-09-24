#!/usr/bin/env node
/*
 * cinemate — build a cinematic, scroll-driven website from one command.
 *
 *   npx cinemate --brand "کافه نبات" --field coffee --theme aurora
 *   npx cinemate --prompt "a gym called IronHouse, green accent"
 *
 * Deliberately dependency-free: argument parsing is a few lines, and a CLI
 * people reach for through `npx` should not pull a tree to start up.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cinemate = require('../lib/index.js');

const pkg = require('../package.json');

const FLAG_ALIASES = {
  b: 'brand', f: 'field', t: 'theme', l: 'lang',
  a: 'accent', p: 'prompt', o: 'out', h: 'help', v: 'version'
};

// Options that take a value; anything else is a boolean switch.
const TAKES_VALUE = new Set([
  'brand', 'field', 'theme', 'surface', 'lang', 'accent', 'bg', 'fg',
  'prompt', 'url', 'image', 'out', 'config', 'title', 'description'
]);

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { rest.push(...argv.slice(i + 1)); break; }
    if (!arg.startsWith('-')) { rest.push(arg); continue; }

    let name = arg.replace(/^--?/, '');
    let value = null;
    const eq = name.indexOf('=');
    if (eq !== -1) { value = name.slice(eq + 1); name = name.slice(0, eq); }
    if (FLAG_ALIASES[name]) name = FLAG_ALIASES[name];

    if (TAKES_VALUE.has(name)) {
      if (value === null) {
        value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) {
          throw new Error('--' + name + ' needs a value');
        }
        i++;
      }
      opts[name] = value;
    } else {
      opts[name] = value === null ? true : value !== 'false';
    }
  }
  return { opts: opts, rest: rest };
}

function help() {
  const fields = cinemate.fields().join(', ');
  const themes = cinemate.themes().join(', ');
  return [
    '',
    '  cinemate — build a cinematic, scroll-driven website from one command',
    '',
    '  USAGE',
    '    cinemate [options]',
    '',
    '  CONTENT',
    '    -b, --brand <name>      brand name shown in the hero, header and footer',
    '    -f, --field <field>     what the business does; picks the copy and items',
    '                            ' + fields,
    '    -p, --prompt <text>     describe the business in a sentence and let it',
    '                            infer the field, brand, language and colour',
    '    -l, --lang <fa|en>      language and text direction (default: fa)',
    '        --config <file>     a JSON config file; CLI flags override it',
    '',
    '  LOOK',
    '    -t, --theme <theme>     ' + themes,
    '        --surface <kind>    soft | sharp | glass — the card treatment',
    '    -a, --accent <#hex>     override the theme accent colour',
    '        --bg <#hex>         override the background',
    '',
    '  SHARING (optional, must be absolute URLs)',
    '        --url <url>         canonical + og:url',
    '        --image <url>       og:image for link previews',
    '',
    '  OUTPUT',
    '    -o, --out <file>        where to write (default: cinematic-site.html)',
    '        --stdout            print the HTML instead of writing a file',
    '',
    '  INFO',
    '        --themes            list the themes and exit',
    '        --fields            list the fields and exit',
    '    -h, --help              this text',
    '    -v, --version           print the version',
    '',
    '  EXAMPLES',
    '    cinemate --brand "کافه نبات" --field coffee --theme aurora',
    '    cinemate --prompt "a gym called IronHouse, green accent" -o gym.html',
    '    cinemate -f jewelry -t noir --lang en --stdout > site.html',
    ''
  ].join('\n');
}

function listThemes() {
  const cat = cinemate.themeCatalogue;
  return cinemate.themes()
    .map((n) => '  ' + n.padEnd(10) + cat[n].accent + '  on ' + cat[n].bg + '  (' + cat[n].surface + ')')
    .join('\n');
}

function listFields() {
  const p = cinemate.presets;
  return cinemate.fields().map((n) => '  ' + n.padEnd(12) + p[n].label).join('\n');
}

function buildConfig(opts) {
  let config = {};

  if (opts.config) {
    let raw;
    try {
      raw = fs.readFileSync(opts.config, 'utf8');
    } catch (err) {
      throw new Error('could not read --config ' + opts.config + ': ' + err.message);
    }
    try {
      config = JSON.parse(raw);
    } catch (err) {
      throw new Error('--config ' + opts.config + ' is not valid JSON: ' + err.message);
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('--config must contain a JSON object');
    }
  }

  // A prompt seeds the config; explicit flags below still win over what it inferred.
  if (opts.prompt) config = Object.assign(config, cinemate.parsePrompt(opts.prompt));

  const direct = ['brand', 'field', 'theme', 'surface', 'lang', 'accent', 'bg', 'fg', 'url', 'title', 'description'];
  for (const key of direct) if (opts[key]) config[key] = opts[key];
  if (opts.image) config.ogImage = opts.image;

  return config;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write('cinemate: ' + err.message + '\n\nRun `cinemate --help`.\n');
    return 1;
  }
  const opts = parsed.opts;

  if (opts.help || argv.length === 0) { process.stdout.write(help() + '\n'); return 0; }
  if (opts.version) { process.stdout.write(pkg.version + '\n'); return 0; }
  if (opts.themes) { process.stdout.write(listThemes() + '\n'); return 0; }
  if (opts.fields) { process.stdout.write(listFields() + '\n'); return 0; }

  let config, html;
  try {
    config = buildConfig(opts);
    html = cinemate.generate(config);
  } catch (err) {
    process.stderr.write('cinemate: ' + (err && err.message ? err.message : err) + '\n');
    return 1;
  }

  if (opts.stdout) { process.stdout.write(html); return 0; }

  const out = opts.out || 'cinematic-site.html';
  try {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, html);
  } catch (err) {
    process.stderr.write('cinemate: could not write ' + out + ': ' + err.message + '\n');
    return 1;
  }

  // An unknown field or theme falls back silently inside the engine, which is
  // right for a library but confusing at a prompt — so say what was actually used.
  const full = cinemate.withDefaults(config);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  process.stdout.write(
    '\n  ✨ ' + out + '  (' + kb + ' KB, self-contained)\n' +
    '     brand   ' + full.brand + '\n' +
    '     field   ' + full.field + '\n' +
    '     theme   ' + (full.theme.name || 'midnight') + ' · ' + full.theme.surface + ' · ' + full.theme.accent + '\n' +
    '     lang    ' + full.lang + '\n\n' +
    '     Open it in a browser — there is nothing to build or serve.\n\n'
  );
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main: main, parseArgs: parseArgs, buildConfig: buildConfig };
