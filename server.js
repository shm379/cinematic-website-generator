/*
 * Cinematic Website Generator — Express server
 * --------------------------------------------
 * Serves:
 *   /            → the BUILDER PANEL (public/index.html). Enter a brand + field
 *                  of work and it generates a cinematic scroll-driven site live,
 *                  fully client-side (so it also works on a static host).
 *   /demo        → a real, polished example built from the same design system
 *                  (public/demo/index.html — the "خشخاش" brand). This one uses
 *                  the original ~227 video frames in public/frames/.
 *   /generator.js → the generation engine (shared by the panel and the API).
 *
 * Optional API (handy for programmatic / server-side generation):
 *   POST /api/generate   body: a config object (see public/generator.js)
 *                        → { html }  the full single-file site
 *   GET  /api/site?...   same, but returns the rendered HTML directly so you
 *                        can preview a generated site at a real URL, e.g.
 *                        /api/site?field=coffee&brand=My%20Cafe
 *
 * The demo's hero frames were pre-extracted once from a source video. If
 * public/frames/ is ever emptied, regenerate them with ffmpeg:
 *   ffmpeg -i resourcess-assets/video-01.mp4 -vf "fps=7.5,scale=1600:-2" -q:v 3 \
 *          public/frames/frame_%04d.jpg
 *   ffmpeg -ss 24.9 -i resourcess-assets/video-01.mp4 -frames:v 1 -q:v 3 public/newsletter-bg.jpg
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const CWG = require('./public/generator.js');

const app = express();
app.use(express.json({ limit: '256kb' }));

// --- Asset sanity check for the /demo example (runs once at startup) -------
function checkAssets() {
  const framesDir = path.join(__dirname, 'public', 'frames');
  let count = 0;
  try {
    count = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).length;
  } catch (_) {
    /* frames folder missing */
  }
  if (count < 200) {
    console.warn(`\n⚠  public/frames/ has ${count} frames — the /demo example expects ~227.`);
    console.warn('   See the ffmpeg commands at the top of server.js to regenerate them.\n');
  } else {
    console.log(`✓ ${count} demo hero frames ready.`);
  }
}

// --- API: generate a site from a config ----------------------------------
app.post('/api/generate', (req, res) => {
  try {
    const html = CWG.generate(req.body || {});
    res.json({ html });
  } catch (err) {
    res.status(400).json({ error: String(err && err.message ? err.message : err) });
  }
});

// --- API: render a generated site directly (query → site) ----------------
app.get('/api/site', (req, res) => {
  try {
    const q = req.query || {};
    const cfg = { field: q.field, brand: q.brand, lang: q.lang, accent: q.accent };
    res.type('html').send(CWG.generate(cfg));
  } catch (err) {
    res.status(400).type('text').send('Could not generate: ' + (err && err.message));
  }
});

// --- API: mega-prompt → site ---------------------------------------------
// Turns a free-text description into a full config + HTML. Resolution order:
//   1. NabuGate — the org's OpenAI-compatible AI gateway (when NABU_BASE_URL is
//      set), so this project never talks to a model provider directly.
//   2. Claude via the Anthropic SDK (when ANTHROPIC_API_KEY is set).
//   3. the keyless heuristic parser in generator.js.
// It always returns a result.

// buildConfigSystemPrompt is the shared instruction that makes the model emit a
// strict JSON config the generator understands. Kept in one place so every AI
// path (NabuGate, Anthropic) produces the same shape.
function buildConfigSystemPrompt() {
  const fields = Object.keys(CWG.presets).join(', ');
  return (
    'You convert a business description into a JSON config for a cinematic website generator. ' +
    'Return ONLY a JSON object — no prose, no markdown fences. Keys: ' +
    'brand (string), field (one of: ' + fields + '), lang ("fa" or "en", inferred from the description language), ' +
    'accent (a hex colour fitting the brand), heroTitle (1-2 words for the big hero word, in the chosen language), ' +
    'eyebrow, collectionTitle, overlays (array of 2-4 entries, each an array of 1-2 short poetic lines), ' +
    'items (array of EXACTLY 3 objects: {name, blend, desc, price, meta, badge?}), ' +
    'newsletterTitle, newsletterSub, footerNote. Write ALL copy in the chosen language. Keep it elegant and on-brand.'
  );
}

// extractJSON pulls the first {...} object out of a model's text response.
function extractJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON in model response');
  return JSON.parse(text.slice(a, b + 1));
}

// configFromPromptNabu routes the mega-prompt through NabuGate's OpenAI-wire
// /v1/chat/completions. Returns null (skip) when NABU_BASE_URL is not set.
async function configFromPromptNabu(prompt) {
  const base = process.env.NABU_BASE_URL;
  if (!base) return null;
  if (typeof fetch !== 'function') return null; // Node 18+ (global fetch) required
  const r = await fetch(base.replace(/\/+$/, '') + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (process.env.NABU_API_KEY || '')
    },
    body: JSON.stringify({
      model: process.env.NABU_MODEL || 'nabu-smart',
      temperature: 0.7,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: buildConfigSystemPrompt() },
        { role: 'user', content: String(prompt || '') }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || ('NabuGate error ' + r.status));
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  return extractJSON(text);
}

async function configFromPromptLLM(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  let Mod;
  try { Mod = require('@anthropic-ai/sdk'); } catch (_) { return null; } // optional dep
  const Anthropic = Mod && Mod.default ? Mod.default : Mod;
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-8';
  const msg = await client.messages.create({
    model: model,
    max_tokens: 2000,
    system: buildConfigSystemPrompt(),
    messages: [{ role: 'user', content: String(prompt || '') }]
  });
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extractJSON(text);
}

app.post('/api/generate-from-prompt', async (req, res) => {
  const prompt = (req.body && req.body.prompt) || '';
  if (!String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' });
  let config = null, via = 'heuristic';
  // 1) NabuGate (central gateway) — preferred when configured.
  try {
    config = await configFromPromptNabu(prompt);
    if (config) via = 'nabugate';
  } catch (err) {
    console.warn('NabuGate prompt parse failed, trying next:', err && err.message);
    config = null;
  }
  // 2) Anthropic SDK directly.
  if (!config) {
    try {
      config = await configFromPromptLLM(prompt);
      if (config) via = 'llm';
    } catch (err) {
      console.warn('LLM prompt parse failed, falling back to heuristic:', err && err.message);
      config = null;
    }
  }
  // 3) keyless heuristic — always works.
  if (!config) config = CWG.parsePrompt(prompt);
  try {
    const full = CWG.withDefaults(config);
    res.json({ via: via, config: full, html: CWG.generate(full) });
  } catch (err) {
    res.status(400).json({ error: String(err && err.message ? err.message : err) });
  }
});

// --- Images: Pexels stock photos (primary) or OpenAI generation (fallback) --
//
// POST /api/image  body: { field, style, brand, accent, prompt, size, query? }
//   → { url, source, ... }
//
// Preference order:
//   1. PEXELS_API_KEY set → search Pexels and return a curated stock photo
//      (fast, free, no generation cost). This is the default image source.
//   2. else OPENAI_API_KEY set → generate an image with gpt-image.
//   3. else → a friendly "configure a key" error.

// English query terms per field — Pexels indexes English best, and the card
// copy is often Persian, so we drive the search from the field of work.
const PEXELS_FIELD_QUERY = {
  tea: 'herbal tea cup',
  coffee: 'coffee cup cafe',
  perfume: 'perfume bottle',
  jewelry: 'gold jewelry luxury',
  realestate: 'modern architecture building interior',
  restaurant: 'gourmet food plate restaurant',
  fitness: 'gym fitness workout',
  clinic: 'medical health clinic',
  tech: 'technology abstract',
  fashion: 'fashion model style',
  _default: 'elegant business'
};
const PEXELS_STYLE_HINT = { cinematic: 'dark moody', product: 'studio', artistic: 'abstract' };

function buildPexelsQuery(o) {
  o = o || {};
  if (o.query && String(o.query).trim()) return String(o.query).trim();
  const base = PEXELS_FIELD_QUERY[o.field] || PEXELS_FIELD_QUERY._default;
  // borrow any latin words from the (possibly localized) prompt to sharpen it
  const latin = String(o.prompt || '').match(/[A-Za-z][A-Za-z-]{2,}/g) || [];
  const extra = latin.slice(0, 2).join(' ');
  const hint = PEXELS_STYLE_HINT[o.style] || '';
  return [base, extra, hint].filter(Boolean).join(' ');
}

async function pexelsImage(o) {
  const key = process.env.PEXELS_API_KEY;
  const query = buildPexelsQuery(o);
  const perPage = 15;
  const url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) +
    '&orientation=landscape&size=large&per_page=' + perPage;
  const r = await fetch(url, { headers: { Authorization: key } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.code)) || ('Pexels API error ' + r.status));
  const photos = (data && data.photos) || [];
  if (!photos.length) throw new Error('No Pexels photos for "' + query + '"');
  // pick a random result so repeated clicks give variety
  const pick = photos[Math.floor(Math.random() * photos.length)];
  const src = pick.src || {};
  return {
    url: src.landscape || src.large || src.original,
    source: 'pexels',
    query: query,
    photographer: pick.photographer,
    photographer_url: pick.photographer_url,
    pexels_url: pick.url
  };
}

const IMAGE_STYLES = {
  cinematic: 'cinematic, dramatic moody lighting, shallow depth of field, atmospheric, premium film still',
  product: 'clean product photography, soft studio lighting, minimal uncluttered background, centred, crisp detail, e-commerce hero',
  artistic: 'artistic, painterly, abstract textures, rich gradients, evocative, editorial'
};
function buildImagePrompt(o) {
  const style = IMAGE_STYLES[o.style] || IMAGE_STYLES.cinematic;
  const preset = CWG.presetFor(o.field);
  const subject = (o.prompt && String(o.prompt).trim()) ||
    ('a hero image representing ' + (preset.label || 'a premium brand'));
  const parts = [
    subject,
    'Style: ' + style + '.',
    o.brand ? ('Brand mood: ' + o.brand + '.') : '',
    o.accent ? ('Accent colour ' + o.accent + '.') : '',
    'Dark, premium, high quality. No text, no logo, no watermark.'
  ];
  return parts.filter(Boolean).join(' ');
}

async function openaiImage(o) {
  const key = process.env.OPENAI_API_KEY;
  const prompt = buildImagePrompt(o);
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: o.size || '1536x1024'
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || 'image API error');
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('no image returned');
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dir = path.join(__dirname, 'public', 'generated');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.png'), Buffer.from(b64, 'base64'));
  return { url: '/generated/' + id + '.png', source: 'openai', prompt: prompt };
}

app.post('/api/image', async (req, res) => {
  if (typeof fetch !== 'function') return res.status(500).json({ error: 'Node 18+ (global fetch) is required for images.' });
  const body = req.body || {};
  const hasPexels = !!process.env.PEXELS_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasPexels && !hasOpenAI) {
    return res.status(400).json({ error: 'No image source configured. Set PEXELS_API_KEY (stock photos) or OPENAI_API_KEY (AI) on the server.' });
  }

  // Prefer Pexels stock photos when configured; fall back to OpenAI on failure.
  if (hasPexels) {
    try {
      return res.json(await pexelsImage(body));
    } catch (err) {
      if (!hasOpenAI) return res.status(502).json({ error: String(err && err.message ? err.message : err) });
      console.warn('Pexels image failed, falling back to OpenAI:', err && err.message);
    }
  }

  try {
    return res.json(await openaiImage(body));
  } catch (err) {
    res.status(502).json({ error: String(err && err.message ? err.message : err) });
  }
});

// --- API: image gallery search (Pexels) ----------------------------------
// GET /api/gallery?query=coffee&page=1&per_page=24&orientation=landscape
//   → { query, page, per_page, total_results, next_page, photos: [...] }
// With no query it returns Pexels' "curated" feed, so the gallery has something
// to show on first load. Requires PEXELS_API_KEY; without it, a friendly error.

// normalizePexelsPhoto keeps only the fields the gallery UI needs (and the
// attribution Pexels asks us to display).
function normalizePexelsPhoto(p) {
  const src = p.src || {};
  return {
    id: p.id,
    width: p.width,
    height: p.height,
    alt: p.alt || '',
    avg_color: p.avg_color || '#15151f',
    src: {
      tiny: src.tiny,
      medium: src.medium,
      large: src.large,
      large2x: src.large2x,
      original: src.original
    },
    photographer: p.photographer,
    photographer_url: p.photographer_url,
    pexels_url: p.url
  };
}

// clampInt parses n and bounds it to [min, max], falling back to def.
function clampInt(n, def, min, max) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}

async function pexelsSearch(opts) {
  const key = process.env.PEXELS_API_KEY;
  const query = String(opts.query || '').trim();
  const page = clampInt(opts.page, 1, 1, 1000);
  const perPage = clampInt(opts.per_page, 24, 1, 80); // Pexels caps per_page at 80
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  let endpoint;
  if (query) {
    endpoint = 'search';
    params.set('query', query);
    const orientation = String(opts.orientation || '').trim();
    if (['landscape', 'portrait', 'square'].includes(orientation)) params.set('orientation', orientation);
  } else {
    endpoint = 'curated'; // no query → a nice default feed
  }
  const url = 'https://api.pexels.com/v1/' + endpoint + '?' + params.toString();
  const r = await fetch(url, { headers: { Authorization: key } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.code)) || ('Pexels API error ' + r.status));
  const photos = ((data && data.photos) || []).map(normalizePexelsPhoto);
  return {
    query: query,
    page: page,
    per_page: perPage,
    total_results: (data && data.total_results) || photos.length,
    next_page: !!(data && data.next_page),
    photos: photos
  };
}

app.get('/api/gallery', async (req, res) => {
  if (typeof fetch !== 'function') return res.status(500).json({ error: 'Node 18+ (global fetch) is required for the gallery.' });
  if (!process.env.PEXELS_API_KEY) {
    return res.status(400).json({ error: 'PEXELS_API_KEY is not set on the server. Add it to enable image search (get a free key at https://www.pexels.com/api/).' });
  }
  try {
    const out = await pexelsSearch(req.query || {});
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: String(err && err.message ? err.message : err) });
  }
});

// --- Health check (for Docker / Coolify) ---------------------------------
app.get('/healthz', (req, res) => res.json({ ok: true, service: 'cinemate' }));

// --- Static files (landing, app.js, generator.js, builder, demo, assets) --
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/builder', (req, res) => res.sendFile(path.join(__dirname, 'public', 'builder.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gallery.html')));

/* Bind to the platform-provided PORT/HOST so reverse proxies (Coolify,
   Docker, Heroku, Railway, …) can reach the container.
   - HOST defaults to 0.0.0.0 so the container is reachable from outside,
     never just 127.0.0.1.
   - When PORT is set by the platform we bind EXACTLY to it (no fallback) —
     incrementing to a free port would make the proxy route to a port the
     app no longer listens on, so traffic silently never arrives.
   - Only in local dev (no PORT) do we fall back to the next free port. */
var HOST = process.env.HOST || '0.0.0.0';
var ENV_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

function banner(port) {
  console.log('Cinemate running on ' + HOST + ':' + port);
  console.log('  Home:    http://localhost:' + port + '/');
  console.log('  Builder: http://localhost:' + port + '/builder');
  console.log('  Gallery: http://localhost:' + port + '/gallery');
  console.log('  Demo:    http://localhost:' + port + '/demo');
  console.log('  Health:  http://localhost:' + port + '/healthz');
}

function tryListen(port, triesLeft) {
  var server = app.listen(port, HOST);
  var failed = false;
  server.on('error', function (err) {
    failed = true;
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.warn('Port ' + port + ' is in use — trying ' + (port + 1) + '…');
      tryListen(port + 1, triesLeft - 1);
    } else {
      console.error('Could not start server: ' + err.message);
      process.exit(1);
    }
  });
  server.on('listening', function () {
    setImmediate(function () { if (!failed && server.listening) banner(port); });
  });
}

checkAssets();
if (ENV_PORT) {
  /* Platform-provided port: bind exactly, fail loudly if it is taken. */
  tryListen(ENV_PORT, 0);
} else {
  /* Local dev: prefer 3000, fall back to the next free port. */
  tryListen(3000, 8);
}
