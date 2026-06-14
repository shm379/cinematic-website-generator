# Master Prompt — "TEA" Luxury Scroll-Driven Website

You are building a **luxury scroll-driven narrative website** for **TEA** — a premium Indian tea brand.

Build it as a **single HTML file** (`public/index.html`) served by a local **Express server** (`server.js`) on `localhost:3000`. Plain HTML + CSS + JS — **no frameworks, no React, no TypeScript, no build step**. After building, run the server.

---

## Tech stack

- `public/index.html` — the entire site; **all CSS and JS inline**.
- `server.js` — Express static server (port **3000**, auto-falls-back to the next free port if busy).
- **GSAP 3 + ScrollTrigger** — from CDN (cdnjs).
- **Lenis 1.1.20** — from CDN (jsDelivr) — momentum smooth scrolling.
- **Google Fonts:** Cormorant Garamond (display) + Inter (body).
- **No npm packages except `express`.**
- **`ffmpeg`** must be installed — used once at build time to extract video frames.

CDN URLs:
```
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js
```

---

## Project structure

```
project/
├── package.json
├── server.js
├── resourcess-assets/
│   └── video-01.mp4              ← source hero film (provided, ~30s, 1920x1080, 30fps)
└── public/
    ├── index.html
    ├── newsletter-bg.jpg         ← extracted from the video (build step)
    ├── dawn.jpg  dusk.jpg  night.jpg   ← product card photos (provided, 16:9)
    └── frames/
        └── frame_0001.jpg … frame_0227.jpg   ← extracted from the video (build step)
```

---

## Build assets — ffmpeg extraction (run once, before serving)

The hero video has ~900 frames at 1080p — far too many to extract or hold in a browser — so frames are **pre-extracted server-side with ffmpeg**, then the browser preloads the resulting JPGs.

```bash
# ~227 hero frames (every 4th frame, scaled to 1600px wide)
ffmpeg -i resourcess-assets/video-01.mp4 -vf "fps=7.5,scale=1600:-2" -q:v 3 \
       public/frames/frame_%04d.jpg

# Newsletter background still — the "hands cradling the cup" moment (~24.9s)
ffmpeg -ss 24.9 -i resourcess-assets/video-01.mp4 -frames:v 1 -q:v 3 \
       public/newsletter-bg.jpg
```

Also place the three product photos in `public/` as `dawn.jpg`, `dusk.jpg`, `night.jpg` (16:9; compress to JPEG ~1000px wide so each is well under ~150 KB).

> Tunable: `fps=7.5` gives ~227 frames; `scale=1600` is crisp but memory-heavy — drop to `scale=1280` to roughly halve the browser memory footprint.

---

## CORE MECHANIC — scroll-driven video

The video **never autoplays**. It is **100% controlled by scroll position**.

- In the browser, **preload all ~227 frames as `ImageBitmap`** (`fetch → response.blob() → createImageBitmap`). This decodes them eagerly and eliminates flicker during fast scroll.
- The hero is **800vh of scroll** with a **pinned** `<canvas>` (100vw × 100vh). Use GSAP **ScrollTrigger `pin: true`** with `end: "+=700%"` (pinned canvas + 700vh of scroll travel = 800vh total). Do **not** use CSS `position: sticky` — the ScrollTrigger pin is more robust.
- Map hero scroll progress `0 → 1` to frame index `0 → last`. Drive it from a **single master GSAP timeline scrubbed by ScrollTrigger** (`scrub: 0.4`): a `playhead` proxy object is tweened across the timeline and its `onUpdate` draws the matching frame to the canvas (draw-on-change only).
- **Cover-fit** each frame to the canvas. Canvas backing store = viewport size × `min(devicePixelRatio, 2)`; redraw on resize (debounced).
- **Mobile:** load every 2nd frame (`matchMedia('(max-width: 768px)')`) to halve memory and network.

---

## SMOOTH SCROLLING — Lenis (Chrome + Safari)

Add momentum smooth scrolling with **Lenis**. It keeps **real native scroll** (no transform hack) — so the pinned hero and the fixed header / progress bar / loader all keep working.

- Initialise inside the same setup as ScrollTrigger and wire the two together:
  ```js
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ```
- `lenis.stop()` while the loading screen is up; `lenis.start()` when it fades out.
- Include the Lenis CSS (it ships these rules):
  ```css
  html.lenis, html.lenis body { height: auto; }
  .lenis.lenis-smooth { scroll-behavior: auto !important; }
  .lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
  .lenis.lenis-stopped { overflow: hidden; }
  .lenis.lenis-smooth iframe { pointer-events: none; }
  ```
- Anchor scrolls (e.g. the header **SHOP** link → product collection) use `lenis.scrollTo(target, { duration: 1.5 })`.
- Mobile keeps **native touch momentum** (Lenis default — only the mouse wheel is smoothed).
- Guard with `if (window.Lenis)` so the site still works if the CDN ever fails.
- Works identically in Chrome and Safari (standard `requestAnimationFrame` + `wheel` events).

---

## LOADING SCREEN

- Full screen, background `#030303`.
- Centre: **"TEA"** — Cormorant Garamond 48px, amber.
- Below: a **thin amber progress bar, 200px wide**, filling left→right as frames preload.
- Below the bar: **"Preparing your ritual..."** — Inter 11px, faint.
- At 100% loaded: **fade the loading screen out over 0.8s**, then unlock scroll.
- Loading overlay is `position: fixed; inset: 0; z-index: 300+`. Wait for `document.fonts.ready` before creating ScrollTriggers; lock scroll while loading.

---

## FIXED HEADER

- Height 64px, **completely transparent** — no border, no background. `z-index: 200`.
- Left: **"TEA"** — Cormorant Garamond 15px, amber, letter-spacing 0.25em.
- Right: **"SHOP"** — Inter 11px, uppercase, `rgba(255,255,255,0.6)`; hover → amber. Clicking it smooth-scrolls to the product collection.

---

## SCROLL PROGRESS BAR

- Fixed **vertical 2px line on the right edge** of the screen, full height. `z-index: 100`.
- Track: `rgba(245,158,11,0.15)`.
- Fill: `rgba(245,158,11,0.8)` — grows from top to bottom with whole-page scroll progress.

---

## HERO TEXT OVERLAYS

Five overlays appear during the 800vh hero scroll, always positioned in **dark areas of the frame** (never over the bright subject). Each is driven by the master scrubbed timeline; words reveal **one by one** as you scroll. Each fades out before the next begins.

| # | Scroll | Copy | Style & placement |
|---|--------|------|-------------------|
| 1 | ~5% | **TEA** | Cormorant Garamond 120px, letter-spacing 0.3em, `rgba(245,158,11,0.9)`. Top centre. Fades in over ~2%, fades out by ~15%. |
| 2 | ~18% | *"A single bag. / Ancient wisdom inside."* | Cormorant Garamond **italic** 42px, white ~0.88. Bottom-left (left 8%, bottom 15%). |
| 3 | ~40% | *"Rose, cardamom, tulsi. / Every leaf, awake."* | Cormorant italic 42px. Right edge, right-aligned. |
| 4 | ~62% | *"Steeped slow. / Nothing is hurried here."* | Cormorant italic 42px. Left edge, left-aligned. |
| 5 | ~85% | *"Warm in your hands. / The ritual is yours."* | Cormorant italic 42px. Top-left. |

All display type uses `clamp()` so it scales down gracefully on mobile.

---

## PRODUCT COLLECTION — DAWN / DUSK / NIGHT

Section anchor: small eyebrow **"THE COLLECTION"** (Inter 10px, uppercase, amber, wide tracking) + heading **"Choose your hour."** (Cormorant Garamond).

Three cards in a responsive grid (`repeat(auto-fit, minmax(280px, 1fr))`, 1 column on mobile). Each card = a **16:9 product photo at the top** + a gradient body below it. Card radius 12px, `overflow: hidden`, inset border `box-shadow: 0 0 0 1px rgba(245,158,11,0.3)`.

**DAWN** — `linear-gradient(160deg, #1a0f0a, #2a1810)`; image `dawn.jpg`
- "DAWN" — Cormorant Garamond, amber · "Morning Awakening Blend" (Cormorant italic, muted)
- "Tulsi. Rose. Cardamom. Green tea." — Inter 13px, `rgba(255,255,255,0.6)`
- "₹ 890" — Cormorant 32px white · **"ADD TO RITUAL"** button
- "15 BAGS · ORGANIC · ASSAM ORIGIN" — Inter 10px, `rgba(255,255,255,0.3)`

**DUSK** — `linear-gradient(160deg, #0a0a0a, #1a0a00)`; image `dusk.jpg`
- "DUSK" amber · "Evening Unwind Blend"
- "Chamomile. Rose. Cardamom. Black tea."
- **"BESTSELLER"** badge, top-right corner — Inter 9px, amber pill
- "₹ 890" · "ADD TO RITUAL" · meta line as above

**NIGHT** — `linear-gradient(160deg, #050510, #0a0a1a)`; image `night.jpg`
- "NIGHT" — **color white** · "Deep Rest Blend"
- "Ashwagandha. Rose. Lavender. White tea."
- "₹ 950" · "ADD TO RITUAL" · meta line as above

**Card hover:** `translateY(-12px)`, shadow deepens, amber glow border, subtle product-image zoom (`scale(1.045)`). Transition `0.4s cubic-bezier(0.16, 1, 0.3, 1)`.

The "ADD TO RITUAL" button: transparent, 1px amber border, amber uppercase label; hover fills amber with dark text.

---

## NEWSLETTER SECTION

```css
background-image:
  linear-gradient(to bottom,
    rgba(3,3,3,0.88) 0%, rgba(3,3,3,0.60) 35%,
    rgba(3,3,3,0.65) 65%, rgba(3,3,3,0.95) 100%),
  url('newsletter-bg.jpg');
background-size: cover; background-position: center;
```
- `background-attachment: fixed` **on desktop only** (via media query — it is janky on iOS Safari).
- "Join the ceremony." — Cormorant Garamond 52px, white, centred.
- "Be the first to know. No noise. Only ritual." — Inter 13px, faint.
- Email input: 320px wide, transparent, **border-bottom 1px amber only** (no other borders).
- "BEGIN →" — amber, no background, underline on hover.

---

## FOOTER

- `border-top: 1px solid rgba(245,158,11,0.15)`.
- Left: **"TEA"** — Cormorant Garamond 18px, amber.
- Centre: **"© 2026 Tea. Rooted in the hills."** — Inter 11px, faint.
- Right: **"Instagram · YouTube"** — Inter 11px, underline on hover.
- Stacks vertically and centres on mobile.

---

## DESIGN SYSTEM

- **Ground:** `#030303` near-black. **Accent:** amber `#f59e0b` / `rgba(245,158,11,*)`. **Text:** white at varying opacity.
- **Fonts:** Cormorant Garamond — all display/serif type; Inter — all body/UI type.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for UI transitions.
- Tone: cinematic, restrained, premium. Generous negative space; everything dark so the film carries the page.

---

## server.js

```js
/*
 * TEA — Express static server
 * ---------------------------------
 * Serves the single-page site from /public (port 3000, or the next free port).
 *
 * The hero's scroll-driven film is a sequence of ~227 JPG frames in
 * public/frames/, pre-extracted once from resourcess-assets/video-01.mp4. If that
 * folder is ever emptied, regenerate the assets with these two ffmpeg commands
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
   fall back to the next free port and report the real URL. */
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
```

---

## Build & run

```bash
npm init -y && npm install express

# extract assets (see the ffmpeg commands above) into public/frames/ and public/
# place dawn.jpg / dusk.jpg / night.jpg into public/

node server.js
```

Then report: **"Server running at http://localhost:3000"** (or the next free port if 3000 is taken).

---

## Acceptance criteria

- Loading screen fills its progress bar, then fades out smoothly.
- Scrolling the hero scrubs the film **frame-by-frame** (it never plays on its own); the five text overlays fade in word-by-word in dark areas of the frame.
- The pinned hero releases cleanly into the product collection — no jump.
- Smooth scrolling (Lenis) gives weighted momentum on the wheel in **Chrome and Safari**; mobile keeps native touch scrolling.
- Product cards show their photos and lift on hover; newsletter and footer render correctly.
- No console errors. Responsive from mobile to widescreen.
