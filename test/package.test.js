/*
 * Tests for the published surface: the library entry point (lib/index.js) and
 * the CLI (bin/cinemate.js).
 *
 * These pin the things a consumer depends on and that are easy to break from
 * inside the repo without noticing — the export list, the `files` allowlist,
 * and the CLI's argument handling.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const cinemate = require('../lib/index.js');
const cli = require('../bin/cinemate.js');
const pkg = require('../package.json');

const BIN = path.join(__dirname, '..', 'bin', 'cinemate.js');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cinemate-test-'));
}

function run(args, opts) {
  return execFileSync(process.execPath, [BIN].concat(args), Object.assign({ encoding: 'utf8' }, opts));
}

/* ============================================================
   Package metadata — what npm will actually publish
   ============================================================ */
test('the package ships only what a consumer needs', () => {
  // the repo carries ~33MB of demo frames and source assets; none of it
  // belongs in the tarball, which the files allowlist is what guarantees
  assert.deepEqual(pkg.files, ['lib/', 'bin/', 'public/generator.js', 'README.md', 'LICENSE']);
  for (const f of ['lib/index.js', 'bin/cinemate.js', 'public/generator.js', 'LICENSE', 'README.md']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', f)), 'missing from the repo: ' + f);
  }
  assert.equal(pkg.main, 'lib/index.js');
  assert.equal(pkg.bin.cinemate, 'bin/cinemate.js');
});

test('the published package has no runtime dependencies', () => {
  // express and the Anthropic SDK belong to the demo server, which is not in
  // `files`. Shipping them would make `npx cinemate` install ~75 packages to
  // render one HTML file.
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.optionalDependencies, undefined);
  assert.ok(pkg.devDependencies.express, 'the demo server still needs express');
});

test('the CLI is executable and declares a shebang', () => {
  const src = fs.readFileSync(BIN, 'utf8');
  assert.match(src, /^#!\/usr\/bin\/env node\n/);
  // npm sets the bit on install, but a non-executable file in git is a common
  // way for `npx` to break on some setups
  assert.ok(fs.statSync(BIN).mode & 0o111, 'bin/cinemate.js is not executable');
});

/* ============================================================
   Library surface
   ============================================================ */
test('lib exports the documented surface', () => {
  for (const key of ['generate', 'withDefaults', 'parsePrompt', 'presetFor', 'themeFor', 'renderToFile']) {
    assert.equal(typeof cinemate[key], 'function', key + ' is not exported');
  }
  assert.ok(cinemate.themes().includes('aurora'));
  assert.ok(cinemate.fields().includes('coffee'));
  // the catalogues exclude the internal _default entry
  assert.equal(cinemate.themes().some((t) => t[0] === '_'), false);
  assert.equal(cinemate.fields().some((f) => f[0] === '_'), false);
});

test('renderToFile writes the site and creates missing directories', () => {
  const dir = tmpdir();
  const out = path.join(dir, 'deep', 'nested', 'index.html');
  const res = cinemate.renderToFile({ brand: 'X', field: 'tech', theme: 'royal' }, out);
  assert.equal(res.file, out);
  assert.ok(res.bytes > 10000);
  assert.equal(res.config.theme.name, 'royal');
  assert.match(fs.readFileSync(out, 'utf8'), /^<!DOCTYPE html>/);
  assert.throws(() => cinemate.renderToFile({}), /file is required/);
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ============================================================
   CLI argument handling
   ============================================================ */
test('parseArgs handles aliases, = form and missing values', () => {
  assert.deepEqual(cli.parseArgs(['-b', 'Nabat', '--field=coffee', '--stdout']).opts,
    { brand: 'Nabat', field: 'coffee', stdout: true });
  assert.deepEqual(cli.parseArgs(['-t', 'noir', '-l', 'en']).opts, { theme: 'noir', lang: 'en' });
  // a value flag with nothing after it is a user error, not a silent `true`
  assert.throws(() => cli.parseArgs(['--brand']), /--brand needs a value/);
  assert.throws(() => cli.parseArgs(['--brand', '--field', 'x']), /--brand needs a value/);
});

test('a prompt seeds the config and explicit flags still win', () => {
  const inferred = cli.buildConfig({ prompt: 'a gym called IronHouse, green accent' });
  assert.equal(inferred.field, 'fitness');
  assert.equal(inferred.brand, 'IronHouse');

  const overridden = cli.buildConfig({ prompt: 'a gym called IronHouse', brand: 'Other', theme: 'noir' });
  assert.equal(overridden.brand, 'Other');
  assert.equal(overridden.field, 'fitness');
  assert.equal(overridden.theme, 'noir');
});

test('--config reads a JSON file and reports bad input clearly', () => {
  const dir = tmpdir();
  const good = path.join(dir, 'c.json');
  fs.writeFileSync(good, JSON.stringify({ brand: 'FromFile', field: 'tea' }));
  assert.equal(cli.buildConfig({ config: good }).brand, 'FromFile');
  // flags beat the file
  assert.equal(cli.buildConfig({ config: good, brand: 'FromFlag' }).brand, 'FromFlag');

  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  assert.throws(() => cli.buildConfig({ config: bad }), /not valid JSON/);
  fs.writeFileSync(bad, '["an","array"]');
  assert.throws(() => cli.buildConfig({ config: bad }), /must contain a JSON object/);
  assert.throws(() => cli.buildConfig({ config: path.join(dir, 'nope.json') }), /could not read/);
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ============================================================
   CLI end to end
   ============================================================ */
test('cinemate --help, --version and the catalogues', () => {
  assert.match(run(['--help']), /build a cinematic, scroll-driven website/);
  assert.equal(run(['--version']).trim(), pkg.version);
  // run with no arguments should help, not fail
  assert.match(run([]), /USAGE/);
  const themes = run(['--themes']);
  for (const t of cinemate.themes()) assert.match(themes, new RegExp('\\b' + t + '\\b'));
  assert.match(run(['--fields']), /coffee/);
});

test('cinemate writes a complete site and reports what it used', () => {
  const dir = tmpdir();
  const out = path.join(dir, 'site.html');
  const stdout = run(['--brand', 'کافه نبات', '--field', 'coffee', '--theme', 'aurora', '-o', out]);
  assert.match(stdout, /کافه نبات/);
  assert.match(stdout, /aurora · glass/);

  const html = fs.readFileSync(out, 'utf8');
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<h1/);
  assert.match(html, /--accent:#5fd3c4/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--stdout emits the document and nothing else', () => {
  const html = run(['-f', 'jewelry', '-t', 'noir', '--lang', 'en', '--stdout']);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html.trim(), /<\/html>$/);
});

test('the CLI fails loudly rather than writing a broken file', () => {
  assert.throws(
    () => run(['--brand'], { stdio: 'pipe' }),
    (err) => /needs a value/.test(String(err.stderr)) && err.status === 1
  );
});
