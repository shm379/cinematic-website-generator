/*
 * Tests for the generation engine (public/generator.js).
 *
 * The engine's whole contract is "config in, one self-contained HTML document
 * out", and that document is what every visitor actually receives — so these
 * tests assert against the generated STRING rather than internal helpers.
 * Pure `node --test`, no dependencies.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const CWG = require('../public/generator.js');

/** Generate with sensible defaults for the field under test. */
function gen(cfg) {
  return CWG.generate(Object.assign({ field: 'coffee', brand: 'کافه نبات', lang: 'fa' }, cfg || {}));
}

/* ============================================================
   Document shape
   ============================================================ */
test('generates a complete, self-contained HTML document', () => {
  const html = gen();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<canvas id="hero-canvas"/);
  assert.match(html, /<section class="collection"/);
  assert.match(html, /<footer class="site-footer"/);
  // the engine is inlined, not fetched
  assert.match(html, /window\.__SITE__/);
});

test('every preset generates without throwing, in both languages', () => {
  const fields = Object.keys(CWG.presets);
  assert.ok(fields.length >= 10, 'expected the full preset catalogue');
  for (const field of fields) {
    for (const lang of ['fa', 'en']) {
      const html = CWG.generate({ field, lang, brand: 'X' });
      assert.match(html, /^<!DOCTYPE html>/, field + '/' + lang + ' produced no document');
      assert.match(html, /<h1/, field + '/' + lang + ' produced no h1');
    }
  }
});

test('survives empty, partial and wrongly-typed config', () => {
  for (const cfg of [undefined, {}, { field: 'nope-not-a-field' }, { items: [] }, { overlays: [] },
    { brand: '' }, { items: [{}] }, { overlays: [['a'], ['b'], ['c'], ['d'], ['e'], ['f']] }]) {
    const html = CWG.generate(cfg);
    assert.match(html, /^<!DOCTYPE html>/, 'failed for ' + JSON.stringify(cfg));
  }
});

/* ============================================================
   Accessibility
   ============================================================ */
test('the hero word is the page h1 and names the brand for screen readers', () => {
  const html = gen({ brand: 'کافه نبات' });
  const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/);
  assert.ok(h1, 'no h1 in the generated page');
  assert.match(h1[0], /class="title-text"/);
  assert.match(h1[0], /sr-only[^>]*> — کافه نبات</);
  // exactly one h1, and it precedes the h2s
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.ok(html.indexOf('<h1') < html.indexOf('<h2'));
});

test('content sits in a main landmark, reachable by a skip link', () => {
  const html = gen();
  assert.match(html, /<a class="skip-link" href="#collection">/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /<\/main>/);
  // the footer is a sibling of main, not inside it
  assert.ok(html.indexOf('</main>') < html.indexOf('<footer'));
});

test('keyboard focus is visible', () => {
  assert.match(gen(), /a:focus-visible,button:focus-visible,input:focus-visible\{outline:/);
});

test('reduced motion drops the scroll story instead of freezing it', () => {
  const html = gen();
  const block = html.match(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\n\}/);
  assert.ok(block, 'no prefers-reduced-motion block');
  // the pinned hero becomes a normal-flow poster with all copy visible
  assert.match(block[0], /\.hero\{height:auto/);
  assert.match(block[0], /\.overlay\{position:static/);
  assert.match(block[0], /opacity:1 !important/);
  // and the engine actually opts out, rather than only the CSS
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /if \(reduced\) \{ staticReveal\(\); return; \}/);
});

test('a page without JavaScript still shows the whole site', () => {
  const html = gen();
  const ns = html.match(/<noscript><style>[\s\S]*?<\/style><\/noscript>/);
  assert.ok(ns, 'no noscript fallback');
  // the loader is dismissed only by script, so CSS must undo it
  assert.match(ns[0], /#loader\{display:none !important\}/);
    assert.match(ns[0], /body\.loading\{overflow:auto !important;height:auto !important\}/);
  assert.match(ns[0], /\.overlay\{position:static/);
});

test('losing the animation CDN still yields a laid-out page', () => {
  const html = gen();
  // the engine flags it...
  assert.match(html, /document\.body\.classList\.add\('no-motion'\)/);
  // ...and the stylesheet has the matching scoped layout, with every selector
  // in the group prefixed (not just the first)
  assert.match(html, /body\.no-motion \.hero\{height:auto/);
  assert.match(html, /body\.no-motion \.title-text,body\.no-motion \.word/);
});

/* ============================================================
   Persian typography
   ============================================================ */
test('Persian text gets no letter-spacing, Latin keeps its tracking', () => {
  // letter-spacing forces apart the cursive joins of Arabic script, so a
  // Persian site must ship none of it at all
  const fa = gen({ lang: 'fa' });
  const en = gen({ lang: 'en', brand: 'Nabat' });
  assert.equal((fa.match(/letter-spacing/g) || []).length, 0, 'Persian output must not track letters');
  assert.ok((en.match(/letter-spacing/g) || []).length > 10, 'Latin output lost its tracking');
  assert.match(en, /\.title-text\{[^}]*letter-spacing:0\.28em/);
});

test('RTL output does not emit empty rules', () => {
  const css = (gen({ lang: 'fa' }).match(/<style>\n([\s\S]*?)\n<\/style>/) || [])[1] || '';
  assert.ok(css.length > 0);
  assert.equal(css.includes('{}'), false, 'stylesheet contains an empty rule');
});

/* ============================================================
   Injection safety — every one of these is reachable from
   GET /api/site?…, i.e. from a plain URL a stranger can send.
   ============================================================ */
test('brand cannot break out of the __SITE__ script element', () => {
  const evil = '</scr' + 'ipt><scr' + 'ipt>alert(1)</scr' + 'ipt>';
  const html = CWG.generate({ field: 'tea', brand: evil });
  assert.equal(html.includes('<scr' + 'ipt>alert(1)'), false, 'script breakout survived');
  assert.match(html, /\\u003c\/script\\u003e/);
  // still valid JSON once unescaped by the JS parser
  const payload = html.match(/window\.__SITE__ = (\{[\s\S]*?\});/)[1];
  assert.equal(JSON.parse(payload.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')).brand, evil);
});

test('accent and bg cannot inject CSS', () => {
  const html = CWG.generate({
    field: 'tea',
    accent: 'red;} body{display:none} .z{',
    bg: '#000;} html{background:url(https://evil.tld/x)'
  });
  assert.equal(html.includes('body{display:none}'), false, 'CSS injection survived');
  assert.equal(html.includes('evil.tld'), false, 'url() exfiltration survived');
  // invalid colours fall back to the preset rather than being emitted
  assert.match(html, /:root\{--bg:#030303;--accent:#f59e0b;/);
});

test('valid colours are still honoured', () => {
  assert.match(CWG.generate({ accent: '#ff0000', bg: '#123' }), /:root\{--bg:#123;--accent:#ff0000;/);
});

test('footer links cannot carry a javascript: payload', () => {
  const html = CWG.generate({ footerLinks: [{ label: 'x', href: 'javascript:alert(1)' }] });
  assert.equal(html.includes('javascript:alert'), false);
  assert.match(html, /<a href="#top">x<\/a>/);
  // ordinary links are untouched
  assert.match(
    CWG.generate({ footerLinks: [{ label: 'ig', href: 'https://instagram.com/x' }] }),
    /<a href="https:\/\/instagram\.com\/x">ig<\/a>/
  );
});

test('copy is HTML-escaped', () => {
  const html = CWG.generate({ brand: '<img src=x onerror=alert(1)>', field: 'tea' });
  assert.equal(html.includes('<img src=x onerror'), false);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

/* ============================================================
   Sharing / SEO
   ============================================================ */
test('emits Open Graph, Twitter and JSON-LD', () => {
  const html = gen();
  assert.match(html, /<meta property="og:type" content="website"/);
  assert.match(html, /<meta property="og:locale" content="fa_IR"/);
  assert.match(html, /<meta name="twitter:card" content="summary"/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'Organization');
  assert.equal(ld.name, 'کافه نبات');
  assert.equal(ld.makesOffer.length, 3);
  assert.equal(ld.makesOffer[0].itemOffered['@type'], 'Product');
});

test('url-dependent tags appear only for a real absolute URL', () => {
  const without = gen();
  assert.equal(/rel="canonical"/.test(without), false);
  assert.equal(/og:url/.test(without), false);
  assert.match(without, /twitter:card" content="summary"/);

  const withUrl = gen({ url: 'https://nabat.example/', ogImage: 'https://nabat.example/hero.jpg' });
  assert.match(withUrl, /<link rel="canonical" href="https:\/\/nabat\.example\/"/);
  assert.match(withUrl, /<meta property="og:image" content="https:\/\/nabat\.example\/hero\.jpg"/);
  assert.match(withUrl, /twitter:card" content="summary_large_image"/);

  // relative or hostile values are dropped, not emitted broken
  for (const bad of ['javascript:alert(1)', '/relative/path', 'not a url']) {
    assert.equal(/rel="canonical"/.test(gen({ url: bad })), false, 'accepted ' + bad);
  }
});

test('the JSON-LD payload cannot close its own script element', () => {
  const html = CWG.generate({ brand: '</scr' + 'ipt><h1>pwned</h1>', field: 'tea' });
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(ld.includes('</scr' + 'ipt>'), false);
  assert.equal(html.includes('<h1>pwned</h1>'), false);
});

/* ============================================================
   Config merging and prompt parsing
   ============================================================ */
test('withDefaults fills from the preset but user values always win', () => {
  const preset = CWG.withDefaults({ field: 'tea' });
  assert.equal(preset.theme.accent, '#f59e0b');
  assert.equal(preset.items.length, 3);

  const mine = CWG.withDefaults({ field: 'tea', brand: 'من', accent: '#010203', heroTitle: 'سلام' });
  assert.equal(mine.brand, 'من');
  assert.equal(mine.theme.accent, '#010203');
  assert.equal(mine.heroTitle, 'سلام');
  // untouched keys still come from the preset
  assert.equal(mine.footerNote, CWG.presets.tea.footerNote);
});

test('an unknown field falls back to the default preset', () => {
  assert.equal(CWG.presetFor('does-not-exist'), CWG.presets._default);
  assert.equal(CWG.presetFor(undefined), CWG.presets._default);
});

test('parsePrompt detects language, field, brand and accent', () => {
  const fa = CWG.parsePrompt('یک سایت برای کافه‌ی «نبات» با رنگ طلایی می‌خواهم');
  assert.equal(fa.lang, 'fa');
  assert.equal(fa.field, 'coffee');
  assert.equal(fa.brand, 'نبات');
  assert.equal(fa.accent, '#e7c873');

  const en = CWG.parsePrompt('a gym called IronHouse, green accent');
  assert.equal(en.lang, 'en');
  assert.equal(en.field, 'fitness');
  assert.equal(en.brand, 'IronHouse');
  assert.equal(en.accent, '#b6f24a');

  // no signal at all is still a usable config
  const bare = CWG.parsePrompt('');
  assert.equal(bare.field, '_default');
  assert.match(CWG.generate(bare), /^<!DOCTYPE html>/);
});

test('parsePrompt output flows through generate unchanged', () => {
  const html = CWG.generate(CWG.parsePrompt('رستوران «شمس» با رنگ قرمز'));
  assert.match(html, /شمس/);
  assert.match(html, /--accent:#e0613e/);
});
