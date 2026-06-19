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

// --- Health check (for Docker / Coolify) ---------------------------------
app.get('/healthz', (req, res) => res.json({ ok: true, service: 'cinemate' }));

// --- Static files (landing, app.js, generator.js, builder, demo, assets) --
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/builder', (req, res) => res.sendFile(path.join(__dirname, 'public', 'builder.html')));

/* Prefer port 3000; if busy, fall back to the next free port. The success
   line is logged on setImmediate and gated on server.listening so a trailing
   EADDRINUSE always wins over a spurious 'listening' event. */
function tryListen(port, triesLeft) {
  var server = app.listen(port);
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
    setImmediate(function () {
      if (!failed && server.listening) {
        console.log('Cinemate running at http://localhost:' + port);
        console.log('  Home:    http://localhost:' + port + '/');
        console.log('  Builder: http://localhost:' + port + '/builder');
        console.log('  Demo:    http://localhost:' + port + '/demo');
      }
    });
  });
}

checkAssets();
tryListen(3000, 8);
