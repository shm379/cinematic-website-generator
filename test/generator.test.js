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
   Card photos: skeleton, shimmer, and never getting stuck
   ============================================================ */
const WITH_PHOTOS = {
  items: [
    { name: 'A', price: '1', image: 'https://cdn.example/a.jpg' },
    { name: 'B', price: '2', image: 'https://cdn.example/b.jpg' },
    { name: 'C', price: '3' } // no photo — keeps the generated glyph
  ]
};

test('a card with a photo gets a shimmering skeleton, one without does not', () => {
  const html = gen(WITH_PHOTOS);
  assert.equal((html.match(/<div class="card-media-wrap">/g) || []).length, 2);
  assert.equal((html.match(/<img class="card-media"/g) || []).length, 2);
  // the third card still uses the generated glyph, which needs no skeleton
  assert.match(html, /card-media-gen/);
  assert.match(html, /@keyframes cwg-shimmer\{/);
});

test('the skeleton is the card itself, so the geometry cannot drift', () => {
  const html = gen(WITH_PHOTOS);
  // only cards that actually wait on a photo carry the loading state
  assert.equal((html.match(/class="card card-\d is-loading"/g) || []).length, 2);
  // the placeholder restyles the REAL elements rather than mocking them
  assert.match(html, /html\.js \.card\.is-loading \.card-name[^{]*\{-webkit-text-fill-color:transparent/);
  // a multi-line paragraph gets line-rhythm bars, not one flat slab
  assert.match(html, /\.card-ingredients\{[^}]*repeating-linear-gradient\(to bottom,[^)]+\) 0 0\.95em,transparent 0\.95em 1\.7em\)/);
  // and the media box is reserved at its final aspect ratio
  assert.match(html, /\.card-media-wrap\{[^}]*aspect-ratio:16\/9/);
});

test('the skeleton is only ever shown where something will clear it', () => {
  const html = gen(WITH_PHOTOS);
  // gated on html.js, set by a head one-liner before the stylesheet parses
  assert.match(html, /<script>document\.documentElement\.className\+=" js"<\/script>/);
  for (const rule of html.match(/^html\.js \.card\.is-loading[^\n]*$/gm) || []) {
    assert.match(rule, /^html\.js /, 'skeleton rule not gated on html.js: ' + rule.slice(0, 60));
  }
  // hiding uses text-fill, never color, so currentColor can restore it
  assert.equal(/\.card\.is-loading [^{]*\{color:transparent/.test(html), false);
});

test('a photo that never loads still leaves the card readable', () => {
  const html = gen(WITH_PHOTOS);
  // engine: load, error and a timeout all clear the skeleton
  assert.match(html, /img\.addEventListener\('load', settle\)/);
  assert.match(html, /img\.addEventListener\('error', fail\)/);
  assert.match(html, /setTimeout\(settle, 8000\)/);
  assert.match(html, /card\.classList\.remove\('is-loading'\)/);
  // a dead URL degrades to the branded panel rather than the browser's
  // broken-image icon sitting in the middle of the card
  assert.match(html, /card\.classList\.add\('media-failed'\)/);
  assert.match(html, /<div class="card-media-fallback"[^>]*aria-hidden="true"/);
  assert.match(html, /\.card\.media-failed \.card-media\{display:none\}/);
  assert.match(html, /\.card\.media-failed \.card-media-fallback\{opacity:1\}/);
  // and a pure-CSS failsafe covers the engine never running at all
  assert.match(html, /animation:cwg-unskeleton 0s linear 8s forwards/);
  assert.match(html, /@keyframes cwg-unskeleton\{to\{-webkit-text-fill-color:currentColor;background-color:transparent;background-image:none\}\}/);
});

/* ============================================================
   Motion system
   ============================================================ */
test('motion uses named easing tokens in the documented bands', () => {
  const html = gen();
  assert.match(html, /--ease-standard:cubic-bezier\(0\.4,0,0\.2,1\)/);
  assert.match(html, /--ease-decel:cubic-bezier\(0,0,0\.2,1\)/);
  assert.match(html, /--ease-spring:cubic-bezier\(0\.34,1\.56,0\.64,1\)/);
  // micro-interactions 150-300ms, structural moves 400-600ms
  const root = html.match(/:root\{[^}]*\}/)[0];
  for (const [token, lo, hi] of [['--dur-micro', 150, 300], ['--dur-hover', 150, 300],
    ['--dur-enter', 400, 600], ['--dur-struct', 400, 600]]) {
    const ms = Number(root.match(new RegExp(token + ':(\\d+)ms'))[1]);
    assert.ok(ms >= lo && ms <= hi, token + ' = ' + ms + 'ms, outside ' + lo + '-' + hi);
  }
});

test('animation is composited — no painted properties in keyframes', () => {
  const html = gen(WITH_PHOTOS);
  const frames = html.match(/@keyframes [\s\S]*?\}\}/g) || [];
  assert.ok(frames.length >= 3);
  for (const f of frames) {
    // the shimmer sweep must move with transform, never background-position
    assert.equal(/background-position/.test(f), false, 'repaints every frame: ' + f.slice(0, 50));
  }
  assert.match(html, /@keyframes cwg-shimmer\{to\{transform:translateX\(100%\)\}\}/);
  assert.match(html, /will-change:transform/);
  // the entry moves on the compositor too
  assert.match(html, /@keyframes cwg-enter\{from\{opacity:0;transform:translate3d\(0,26px,0\)\}/);
});

test('entry staggers, and is declared only for people who want motion', () => {
  const html = gen(WITH_PHOTOS);
  // each card carries its queue position
  assert.match(html, /class="card card-0[^"]*" style="--i:0"/);
  assert.match(html, /class="card card-2[^"]*" style="--i:2"/);
  assert.match(html, /nl-reveal" style="--i:1"/);
  assert.match(html, /animation:cwg-enter var\(--dur-enter\) var\(--ease-decel\) calc\(var\(--i,0\) \* var\(--stagger\)\)/);
  // the hidden start state lives INSIDE no-preference, so a reduced-motion
  // visitor never gets a page that starts invisible
  const np = html.match(/@media \(prefers-reduced-motion:no-preference\)\{[\s\S]*?\n\}/);
  assert.ok(np, 'no no-preference block');
  assert.match(np[0], /html\.js \.card,html\.js \.nl-reveal\{opacity:0/);
  // …and the animation is cleared afterwards so hover gets its transition back
  assert.match(np[0], /\.is-done[^{]*\{animation:none;opacity:1\}/);
  assert.match(html, /e\.animationName === 'cwg-enter'/);
});

test('reveals survive a blocked animation CDN', () => {
  const html = gen(WITH_PHOTOS);
  // the cards are no longer revealed by GSAP at all
  assert.equal(/gsap\.from\('\.card'/.test(html), false);
  assert.equal(/gsap\.from\('\.nl-reveal'/.test(html), false);
  assert.match(html, /new IntersectionObserver/);
  // without the observer, or if it never fires, content still arrives
  assert.match(html, /if \(!\('IntersectionObserver' in window\)\)/);
  assert.match(html, /@keyframes cwg-fade-in\{to\{opacity:1\}\}/);
});

test('the page gives app-like touch feedback', () => {
  const html = gen();
  assert.match(html, /button,a,\.card\{touch-action:manipulation\}/);
  assert.match(html, /:active\{transform:scale\(\.94\);transition-duration:var\(--dur-micro\);transition-timing-function:var\(--ease-spring\)\}/);
});

/* ============================================================
   Themes
   ============================================================ */
test('every theme produces a distinct, complete stylesheet', () => {
  const names = Object.keys(CWG.themes).filter((n) => n[0] !== '_');
  assert.ok(names.length >= 6, 'expected a real catalogue of themes');
  const seen = new Set();
  for (const name of names) {
    const html = CWG.generate({ theme: name, brand: 'X' });
    assert.match(html, /^<!DOCTYPE html>/, name + ' produced no document');
    assert.match(html, /<h1/, name + ' lost its heading');
    seen.add(html);
  }
  assert.equal(seen.size, names.length, 'two themes render identically');
});

test('a theme sets palette, foreground and surface together', () => {
  const aurora = CWG.withDefaults({ theme: 'aurora' });
  assert.equal(aurora.theme.name, 'aurora');
  assert.equal(aurora.theme.surface, 'glass');
  assert.match(CWG.generate({ theme: 'aurora' }), /backdrop-filter:blur/);
  // sharp surfaces are square-cornered, soft ones are not
  assert.match(CWG.generate({ theme: 'noir' }), /\.card\{[^}]*border-radius:2px/);
  assert.match(CWG.generate({ theme: 'midnight' }), /\.card\{[^}]*border-radius:14px/);
  // the foreground is a token, so themes can move it off pure white
  assert.match(CWG.generate({ theme: 'sunset' }), /--fg:#fff3ee/);
  assert.match(CWG.generate({ theme: 'sunset' }), /body\{[^}]*color:var\(--fg\)/);
});

test('theme resolution survives a config round-trip', () => {
  // /api/generate-from-prompt returns the RESOLVED config and the builder
  // posts it straight back, so theme must accept its own object form
  const once = CWG.withDefaults({ theme: 'royal', field: 'tech' });
  const twice = CWG.withDefaults(once);
  assert.equal(twice.theme.name, 'royal');
  assert.equal(twice.theme.accent, once.theme.accent);
  assert.equal(twice.theme.surface, once.theme.surface);
  assert.deepEqual(twice.theme.motif, once.theme.motif);
});

test('an unknown theme falls back, and explicit values still win', () => {
  assert.equal(CWG.withDefaults({ theme: 'nope' }).theme.name, 'midnight');
  assert.equal(CWG.withDefaults({ theme: 'aurora', accent: '#ff0000' }).theme.accent, '#ff0000');
  assert.equal(CWG.withDefaults({ theme: 'aurora', surface: 'sharp' }).theme.surface, 'sharp');
  // a hostile surface cannot reach the stylesheet
  assert.equal(CWG.withDefaults({ surface: 'x;}body{display:none}' }).theme.surface, 'soft');
  assert.equal(CWG.generate({ fg: 'red;}body{display:none' }).includes('body{display:none'), false);
});

test('reduced motion neutralises the shimmer', () => {
  const block = gen(WITH_PHOTOS).match(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\n\}/)[0];
  // the blanket animation rule covers every keyframe animation on the page,
  // including the shimmer sweep and the failsafe
  assert.match(block, /animation-duration:\.001ms !important/);
  assert.match(block, /animation-iteration-count:1 !important/);
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

test('non-array overlays/items/footerLinks fall back to the preset', () => {
  // an LLM answering the mega-prompt can emit a string or object where the
  // schema says array; generate() must not throw on .map/.slice
  for (const bad of ['a string', { not: 'an array' }, 42]) {
    const cfg = CWG.withDefaults({ field: 'tea', overlays: bad, items: bad, footerLinks: bad });
    assert.ok(Array.isArray(cfg.items) && cfg.items.length === 3);
    assert.ok(Array.isArray(cfg.overlays) && cfg.overlays.length > 0);
    assert.ok(Array.isArray(cfg.footerLinks));
    assert.match(CWG.generate({ field: 'tea', items: bad, overlays: bad }), /^<!DOCTYPE html>/);
  }
});

test('short latin keywords only match as whole words', () => {
  // "ai" must not fire inside retail/email/domain and misclassify the field
  assert.equal(CWG.parsePrompt('a retail brand for email campaigns').field, '_default');
  assert.equal(CWG.parsePrompt('we build ai tools').field, 'tech');
  // longer keywords keep substring matching so stemmed variants still hit
  assert.equal(CWG.parsePrompt('our application platform').field, 'tech');
});

test('parsePrompt output flows through generate unchanged', () => {
  const html = CWG.generate(CWG.parsePrompt('رستوران «شمس» با رنگ قرمز'));
  assert.match(html, /شمس/);
  assert.match(html, /--accent:#e0613e/);
});
