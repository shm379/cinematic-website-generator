/*
 * cinemate — public entry point for the npm package.
 *
 * The engine itself lives at public/generator.js because the browser loads it
 * from /generator.js on the demo site; this module is the single documented
 * surface for Node consumers, so the two can never drift apart.
 *
 *   const cinemate = require('cinemate');
 *   const html = cinemate.generate({ brand: 'نبات', field: 'coffee', theme: 'aurora' });
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CWG = require('../public/generator.js');

/**
 * Generate a site and write it to disk.
 * Creates the parent directory if it does not exist, so a caller can pass
 * `dist/index.html` without setting it up first.
 *
 * @param {object} config  the same config `generate()` takes
 * @param {string} file    destination path
 * @returns {{file: string, bytes: number, config: object}}
 */
function renderToFile(config, file) {
  if (!file) throw new Error('renderToFile(config, file): file is required');
  const html = CWG.generate(config);
  const dir = path.dirname(path.resolve(file));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, html);
  return { file: file, bytes: Buffer.byteLength(html), config: CWG.withDefaults(config) };
}

/** The field presets a site can be built from, as plain names. */
function fields() {
  return Object.keys(CWG.presets).filter((f) => f[0] !== '_');
}

/** The visual themes, as plain names. */
function themes() {
  return Object.keys(CWG.themes).filter((t) => t[0] !== '_');
}

module.exports = {
  // core
  generate: CWG.generate,
  withDefaults: CWG.withDefaults,
  parsePrompt: CWG.parsePrompt,
  // catalogues
  presets: CWG.presets,
  presetFor: CWG.presetFor,
  fields: fields,
  themes: themes,
  themeCatalogue: CWG.themes,
  themeFor: CWG.themeFor,
  // convenience
  renderToFile: renderToFile,
  util: CWG.util
};
