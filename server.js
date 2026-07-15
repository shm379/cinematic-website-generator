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

// --- API: generate an image (OpenAI gpt-image) ---------------------------
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

app.post('/api/image', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server. Add it to enable AI image generation.' });
  if (typeof fetch !== 'function') return res.status(500).json({ error: 'Node 18+ (global fetch) is required for image generation.' });
  try {
    const body = req.body || {};
    const prompt = buildImagePrompt(body);
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: body.size || '1536x1024'
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || 'image API error' });
    const b64 = data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) return res.status(502).json({ error: 'no image returned' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const dir = path.join(__dirname, 'public', 'generated');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + '.png'), Buffer.from(b64, 'base64'));
    res.json({ url: '/generated/' + id + '.png', prompt: prompt });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// --- Health check (for Docker / Coolify) ---------------------------------
app.get('/healthz', (req, res) => res.json({ ok: true, service: 'cinemate' }));

// --- Static files (landing, app.js, generator.js, builder, demo, assets) --
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/builder', (req, res) => res.sendFile(path.join(__dirname, 'public', 'builder.html')));

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
