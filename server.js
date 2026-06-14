/*
 * TEA — Express static server
 * ---------------------------------
 * Serves the single-page site from /public (port 3000, or the next free port).
 *
 * The hero's scroll-driven film is a sequence of ~227 JPG frames in
 * public/frames/, pre-extracted once from resourcess-assets/video-01.mp4. If that folder is
 * ever emptied, regenerate the assets with these two ffmpeg commands
 * (run from this directory):
 *
 *   ffmpeg -i resourcess-assets/video-01.mp4 -vf "fps=7.5,scale=1600:-2" -q:v 3 \
 *          public/frames/frame_%04d.jpg
 *
 *   ffmpeg -ss 24.9 -i resourcess-assets/video-01.mp4 -frames:v 1 -q:v 3 public/newsletter-bg.jpg
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// --- Asset sanity check (runs once at startup) ---------------------------
function checkAssets() {
  const framesDir = path.join(__dirname, 'public', 'frames');
  let count = 0;
  try {
    count = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).length;
  } catch (_) {
    /* frames folder missing */
  }
  if (count < 200) {
    console.warn(`\n⚠  public/frames/ has ${count} frames — expected ~227.`);
    console.warn('   The hero video needs them. See the ffmpeg commands at the top of server.js.\n');
  } else {
    console.log(`✓ ${count} hero frames ready.`);
  }
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* Prefer port 3000; if it is busy (another dev server is running, etc.),
   fall back to the next free port and report the real URL. The success
   line is logged on setImmediate and gated on server.listening so a
   trailing EADDRINUSE always wins over a spurious 'listening' event. */
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
        console.log('TEA running at http://localhost:' + port);
      }
    });
  });
}

checkAssets();
tryListen(3000, 8);
