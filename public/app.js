/*
 * Cinemate — landing + onboarding app
 * -----------------------------------
 * Drives the homepage (hero live preview, showcase, pricing), a simulated
 * auth modal, and a 6-step onboarding wizard that takes the user from
 * "what's your field" to a finished, downloadable / publishable cinematic
 * site. All generation is client-side via /generator.js (window.CWG).
 *
 * Auth + hosting are front-end flows (no backend persistence). Hosting the
 * platform itself is done with Docker/Coolify (see Dockerfile & README);
 * the in-app "publish" gives a believable live URL and is wired so a real
 * hosting backend can drop in later.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- field metadata (emoji + label) ---------- */
  var EMOJI = {
    tea: '🍵', coffee: '☕', perfume: '🌸', jewelry: '💎', realestate: '🏛️',
    restaurant: '🍽️', fitness: '🏋️', clinic: '🩺', tech: '🚀', fashion: '👗', _default: '✦'
  };
  var FIELDS = Object.keys(CWG.presets);

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  /* ---------- hero mock preview ---------- */
  var mockFields = ['perfume', 'tea', 'jewelry', 'restaurant', 'tech'];
  var mockBrands = { perfume: 'رایحه', tea: 'خشخاش', jewelry: 'Aurum', restaurant: 'آتش', tech: 'Nova' };
  var mockSwitch = $('#mockSwitch');
  function slug(s) {
    var x = String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return x || 'yourbrand';
  }
  function loadMock(field) {
    var brand = mockBrands[field] || 'برند';
    $('#mockFrame').srcdoc = CWG.generate({ field: field, brand: brand });
    $('#mockUrl').textContent = slug(mockBrands[field] || field) + '.cinemate.site';
    $$('.mock-chip', mockSwitch).forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-f') === field); });
  }
  mockFields.forEach(function (f, i) {
    var b = document.createElement('button');
    b.className = 'mock-chip' + (i === 0 ? ' on' : '');
    b.setAttribute('data-f', f);
    b.textContent = (EMOJI[f] || '') + ' ' + CWG.presetFor(f).label;
    b.addEventListener('click', function () { loadMock(f); });
    mockSwitch.appendChild(b);
  });
  loadMock(mockFields[0]);

  /* ---------- showcase (lazy live thumbnails) ---------- */
  var showItems = [
    { field: 'perfume', brand: 'رایحه' }, { field: 'jewelry', brand: 'Aurum' },
    { field: 'restaurant', brand: 'آتش' }, { field: 'fitness', brand: 'Iron' },
    { field: 'tech', brand: 'Nova' }, { field: 'coffee', brand: 'قهوه‌خانه' }
  ];
  var LW = 1200, LH = 750; // logical thumbnail render size (16:10)
  var showGrid = $('#showGrid');
  showItems.forEach(function (it) {
    var p = CWG.presetFor(it.field);
    var card = document.createElement('div');
    card.className = 'show';
    card.innerHTML =
      '<div class="thumb" style="background:linear-gradient(135deg,' + p.bg + ',#000)">' +
        '<iframe scrolling="no" tabindex="-1"></iframe><div class="veil"></div>' +
      '</div>' +
      '<div class="cap"><div><b>' + (EMOJI[it.field] || '') + ' ' + it.brand + '</b> ' +
        '<span>' + p.label + '</span></div><span class="go">باز کردن ↗</span></div>';
    card.addEventListener('click', function () {
      var blob = new Blob([CWG.generate(it)], { type: 'text/html;charset=utf-8' });
      window.open(URL.createObjectURL(blob), '_blank');
    });
    showGrid.appendChild(card);
    card._cfg = it;
  });
  function fitThumb(frame) {
    var thumb = frame.parentElement;
    var s = thumb.clientWidth / LW;
    frame.style.width = LW + 'px'; frame.style.height = LH + 'px';
    frame.style.transformOrigin = 'top left'; frame.style.left = '0'; frame.style.right = 'auto';
    frame.style.transform = 'scale(' + s + ')';
  }
  // lazy-load showcase iframes when near viewport (staggered)
  var ioDelay = 0;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var card = e.target, frame = $('iframe', card);
      io.unobserve(card);
      ioDelay += 350;
      setTimeout(function () {
        frame.srcdoc = CWG.generate(card._cfg);
        frame.addEventListener('load', function () { fitThumb(frame); });
        fitThumb(frame);
      }, ioDelay);
    });
  }, { rootMargin: '120px' });
  $$('.show', showGrid).forEach(function (c) { io.observe(c); });
  window.addEventListener('resize', function () { $$('.show iframe', showGrid).forEach(fitThumb); });

  /* ============================================================
     AUTH (simulated)
     ============================================================ */
  var authOverlay = $('#authOverlay');
  function openAuth() {
    var u = getUser();
    if (u) { openWizard(); return; }
    authOverlay.classList.add('show');
  }
  function closeAuth() { authOverlay.classList.remove('show'); }
  function getUser() { try { return JSON.parse(localStorage.getItem('cinemate_user') || 'null'); } catch (e) { return null; } }

  $('#authClose').addEventListener('click', closeAuth);
  authOverlay.addEventListener('click', function (e) { if (e.target === authOverlay) closeAuth(); });

  var authMode = 'signup';
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      authMode = b.getAttribute('data-tab');
      $$('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('#authTitle').textContent = authMode === 'signup' ? 'به Cinemate خوش آمدی' : 'خوش برگشتی';
      $('#nameField').style.display = authMode === 'signup' ? '' : 'none';
      $('#auSubmit').textContent = authMode === 'signup' ? 'ساختِ حساب و شروع →' : 'ورود و ادامه →';
    });
  });
  $('#auSubmit').addEventListener('click', function () {
    var email = $('#auEmail').value.trim();
    var name = $('#auName').value.trim();
    if (!email || email.indexOf('@') < 0) { toast('یک ایمیلِ معتبر وارد کن'); return; }
    if (!$('#auPass').value) { toast('رمز عبور را وارد کن'); return; }
    localStorage.setItem('cinemate_user', JSON.stringify({ name: name || email.split('@')[0], email: email }));
    closeAuth(); toast('خوش آمدی، ' + (name || 'دوست عزیز') + '!'); openWizard();
  });
  $('#auGuest').addEventListener('click', function () {
    localStorage.setItem('cinemate_user', JSON.stringify({ name: 'مهمان', guest: true }));
    closeAuth(); openWizard();
  });

  $('#navStart').addEventListener('click', openAuth);
  $('#heroStart').addEventListener('click', openAuth);
  $('#finalStart').addEventListener('click', openAuth);
  $('#navSignin').addEventListener('click', function () { $$('.tabs button')[1].click(); authOverlay.classList.add('show'); });
  $('#ftHost').addEventListener('click', function (e) { e.preventDefault(); openAuth(); });
  $$('[data-plan]').forEach(function (b) {
    b.addEventListener('click', function () { window._plan = b.getAttribute('data-plan'); openAuth(); });
  });

  /* ============================================================
     WIZARD
     ============================================================ */
  var STEPS = 6;
  var step = 0;
  var cfg = null; // current generation config
  var brandTouched = false; // true only once the user types their own brand name

  function defaultCfg() {
    var p = CWG.presetFor('tea');
    return buildFromPreset('tea', 'برند تو', 'fa');
  }
  function buildFromPreset(field, brand, lang) {
    var p = CWG.presetFor(field);
    return {
      field: field, brand: brand || p.label, fieldLabel: p.label, lang: lang || 'fa',
      accent: p.accent, motif: Object.assign({}, p.motif),
      heroTitle: p.heroTitle, overlays: p.overlays.map(function (a) { return a.slice(); }),
      eyebrow: p.eyebrow, collectionTitle: p.collectionTitle,
      items: p.items.map(function (it) { return Object.assign({}, it); }),
      newsletterTitle: p.newsletterTitle, newsletterSub: p.newsletterSub, footerNote: p.footerNote
    };
  }

  // stepper segments
  var stepper = $('#stepper');
  for (var i = 0; i < STEPS; i++) { var s = document.createElement('div'); s.className = 'seg'; stepper.appendChild(s); }
  function paintStepper() {
    $$('.seg', stepper).forEach(function (el, i) {
      el.classList.toggle('done', i < step);
      el.classList.toggle('cur', i === step);
    });
  }

  /* ----- field grid (step 1) ----- */
  var wzFields = $('#wzFields');
  FIELDS.forEach(function (f) {
    var p = CWG.presetFor(f);
    var c = document.createElement('div');
    c.className = 'field-card';
    c.setAttribute('data-field', f);
    c.innerHTML = '<span class="emo">' + (EMOJI[f] || '✦') + '</span><div><b>' +
      (f === '_default' ? 'سایر / دلخواه' : p.label) + '</b><span>' +
      (p.heroTitle || '') + '</span></div>';
    c.addEventListener('click', function () { selectField(f); });
    wzFields.appendChild(c);
  });
  function selectField(f) {
    // Only carry the brand across fields if the user actually typed one;
    // otherwise switch to the new field's preset brand so the preview follows.
    var keepBrand = brandTouched && cfg && cfg.brand ? cfg.brand : null;
    var lang = cfg ? cfg.lang : 'fa';
    cfg = buildFromPreset(f, keepBrand, lang);
    $$('.field-card', wzFields).forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-field') === f); });
    markSwitching();
    syncForm(); preview(); hydratePhotos();
  }

  // Field switches reload the (heavy) preview iframe; until the new field paints,
  // the browser keeps the previous field on screen. Cover it with a spinner so
  // the selection and the preview never look out of sync.
  var switchClearT;
  function markSwitching() {
    var dev = $('#wzDevice'); if (!dev) return;
    dev.classList.add('switching');
    clearTimeout(switchClearT);
    switchClearT = setTimeout(function () { dev.classList.remove('switching'); }, 2600);
  }
  function clearSwitching() {
    clearTimeout(switchClearT);
    var dev = $('#wzDevice'); if (dev) dev.classList.remove('switching');
  }

  /* ----- mega prompt: free text → full config ----- */
  function applyGenerated(g) {
    cfg = buildFromPreset(g.field, g.brand, g.lang);
    cfg.fieldLabel = g.fieldLabel || cfg.fieldLabel;
    cfg.accent = (g.theme && g.theme.accent) || g.accent || cfg.accent;
    cfg.motif = (g.theme && g.theme.motif) || cfg.motif;
    cfg.heroTitle = g.heroTitle || cfg.heroTitle;
    if (g.overlays && g.overlays.length) cfg.overlays = g.overlays;
    cfg.eyebrow = g.eyebrow || cfg.eyebrow;
    cfg.collectionTitle = g.collectionTitle || cfg.collectionTitle;
    if (g.items && g.items.length) cfg.items = g.items.map(function (it) { return Object.assign({}, it); });
    cfg.newsletterTitle = g.newsletterTitle || cfg.newsletterTitle;
    cfg.newsletterSub = g.newsletterSub || cfg.newsletterSub;
    cfg.footerNote = g.footerNote || cfg.footerNote;
    brandTouched = true; // the prompt specified the brand intent
  }
  $('#wzPromptBtn').addEventListener('click', function () {
    var p = ($('#wzPrompt').value || '').trim();
    if (!p) { toast('یک توصیف بنویس'); return; }
    var btn = this, old = btn.textContent;
    btn.disabled = true; btn.textContent = '… در حال ساخت';
    function finish(g, msg) {
      applyGenerated(g); syncForm(); preview(); hydratePhotos(); showStep(4);
      btn.disabled = false; btn.textContent = old; toast(msg);
    }
    fetch('/api/generate-from-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: p, lang: (cfg && cfg.lang) || 'fa' })
    }).then(function (r) {
      if (!r.ok) throw new Error('server');
      return r.json();
    }).then(function (data) {
      finish(data.config, data.via === 'llm' ? 'با هوش مصنوعی ساخته شد ✨' : 'ساخته شد ✨');
    }).catch(function () {
      // static host / no server → keyless client-side parse
      finish(CWG.withDefaults(CWG.parsePrompt(p)), 'ساخته شد (تحلیل محلی) ✨');
    });
  });

  /* ----- swatches (step 3) ----- */
  var SW = ['#f59e0b', '#c98a5e', '#e6a4ad', '#e7c873', '#7fa8c9', '#e0613e', '#b6f24a', '#5fd3c4', '#8b5cf6', '#d8d2c8'];
  var wzSw = $('#wzSwatches');
  SW.forEach(function (c) {
    var el = document.createElement('span'); el.className = 'sw'; el.style.background = c; el.setAttribute('data-c', c);
    el.addEventListener('click', function () { cfg.accent = c; $('#wzAccent').value = c; markSw(); preview(); });
    wzSw.insertBefore(el, $('#wzAccent'));
  });
  function markSw() { $$('.sw', wzSw).forEach(function (el) { el.classList.toggle('on', (el.getAttribute('data-c') || '').toLowerCase() === (cfg.accent || '').toLowerCase()); }); }
  $('#wzAccent').addEventListener('input', function () { cfg.accent = this.value; markSw(); previewDebounced(); });

  /* ----- motif (step 3) ----- */
  $$('#wzMotif button').forEach(function (b) {
    b.addEventListener('click', function () {
      cfg.motif = Object.assign({}, cfg.motif, { shape: b.getAttribute('data-motif') });
      $$('#wzMotif button').forEach(function (x) { x.classList.toggle('on', x === b); });
      preview();
    });
  });

  /* ----- language (step 2) ----- */
  $$('#wzLang button').forEach(function (b) {
    b.addEventListener('click', function () {
      cfg.lang = b.getAttribute('data-lang');
      $$('#wzLang button').forEach(function (x) { x.classList.toggle('on', x === b); });
      previewDebounced();
    });
  });

  /* ----- card editors (step 4) ----- */
  var wzCards = $('#wzCards');
  for (var k = 0; k < 3; k++) {
    var d = document.createElement('div'); d.className = 'cardmini'; d.setAttribute('data-i', k);
    d.innerHTML = '<h5>کارت ' + (k + 1) + '</h5>' +
      '<div class="wz-row"><input class="wz-input c-name" placeholder="نام"><input class="wz-input c-price" placeholder="قیمت"></div>' +
      '<input class="wz-input c-desc" style="margin-top:10px" placeholder="توضیح کوتاه">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
        '<button type="button" class="btn btn-ghost c-img" style="font-size:12px;padding:9px 13px">🎨 عکسِ دیگر</button>' +
        '<span class="c-imgstatus" style="font-size:11px;color:var(--faint)"></span>' +
      '</div>';
    wzCards.appendChild(d);
  }

  /* ----- card images (Pexels stock photos, or OpenAI if configured) ----- */
  var imgStyle = 'cinematic';
  $$('#wzImgStyle button').forEach(function (b) {
    b.addEventListener('click', function () {
      imgStyle = b.getAttribute('data-imgstyle');
      $$('#wzImgStyle button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });
  wzCards.addEventListener('click', function (e) {
    var btn = e.target.closest('.c-img'); if (!btn) return;
    var box = btn.closest('.cardmini'); var i = +box.getAttribute('data-i');
    genCardImage(i, btn);
  });
  function genCardImage(i, btn) {
    var status = btn.parentElement.querySelector('.c-imgstatus');
    var it = cfg.items[i] || {};
    var label = CWG.presetFor(cfg.field).label;
    btn.disabled = true; var old = btn.textContent; btn.textContent = '… در حال گرفتن عکس';
    status.textContent = '';
    fetch('/api/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field: cfg.field, style: imgStyle, brand: cfg.brand, accent: cfg.accent,
        prompt: (it.name ? it.name + ' — ' : '') + (it.desc || label), size: '1536x1024'
      })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (o) {
        btn.disabled = false; btn.textContent = old;
        if (!o.ok) { status.textContent = o.d && o.d.error ? o.d.error : 'خطا'; return; }
        var u = (o.d && o.d.url) || '';
        // Pexels returns an absolute URL; the OpenAI path returns a same-origin path.
        cfg.items[i].image = /^https?:\/\//i.test(u) ? u : (location.origin + u);
        status.textContent = o.d && o.d.source === 'pexels' ? '✓ از Pexels' : '✓ ساخته شد';
        preview();
      }).catch(function () {
        btn.disabled = false; btn.textContent = old;
        status.textContent = 'نیازمندِ سرور است';
      });
  }

  /* ----- auto-fill card photos from the stock-photo proxy -----
     Presets ship copy but no photos, so a generated site would otherwise show
     only gradient placeholders. When a field is loaded, pull a batch of stock
     photos for it and drop them into the cards (keeping any the user made by
     hand). Silent no-op on a static host / when no photo key is configured. */
  var photoCache = {};   // field → [url, ...] (avoids re-fetching on re-select)
  var photoSeq = 0;      // guards against a slow response for a now-stale field
  function applyPhotos(urls) {
    if (!cfg || !urls || !urls.length) return;
    var changed = false;
    (cfg.items || []).forEach(function (it, i) {
      if (!it.image && urls[i]) { it.image = urls[i]; changed = true; }
    });
    if (changed) preview();
  }
  function hydratePhotos() {
    if (!cfg || !cfg.items || !cfg.items.length) return;
    var field = cfg.field;
    if (photoCache[field]) { applyPhotos(photoCache[field]); return; }
    var seq = ++photoSeq;
    fetch('/api/photos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: field, style: imgStyle, count: cfg.items.length })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.photos || !d.photos.length) return;
        var urls = d.photos.map(function (p) { return p.url; }).filter(Boolean);
        if (!urls.length) return;
        photoCache[field] = urls;
        // ignore if the user has since switched to a different field
        if (seq === photoSeq && cfg && cfg.field === field) applyPhotos(urls);
      })
      .catch(function () { /* static host / no key → cards keep placeholders */ });
  }

  /* ----- simple text inputs bound to cfg ----- */
  function bind(id, key) {
    $(id).addEventListener('input', function () { cfg[key] = this.value; previewDebounced(); });
  }
  bind('#wzBrand', 'brand'); bind('#wzFieldLabel', 'fieldLabel');
  bind('#wzHeroTitle', 'heroTitle'); bind('#wzEyebrow', 'eyebrow'); bind('#wzCollTitle', 'collectionTitle');
  // remember once the user has personalised the brand, so switching field keeps it
  $('#wzBrand').addEventListener('input', function () { brandTouched = (this.value || '').trim().length > 0; });
  $('#wzCards').addEventListener('input', function (e) {
    var box = e.target.closest('.cardmini'); if (!box) return;
    var i = +box.getAttribute('data-i');
    if (e.target.classList.contains('c-name')) cfg.items[i].name = e.target.value;
    if (e.target.classList.contains('c-price')) cfg.items[i].price = e.target.value;
    if (e.target.classList.contains('c-desc')) cfg.items[i].desc = e.target.value;
    previewDebounced();
  });

  /* ----- push cfg → form fields ----- */
  function syncForm() {
    $('#wzBrand').value = cfg.brand || '';
    $('#wzFieldLabel').value = cfg.fieldLabel || '';
    $('#wzHeroTitle').value = cfg.heroTitle || '';
    $('#wzEyebrow').value = cfg.eyebrow || '';
    $('#wzCollTitle').value = cfg.collectionTitle || '';
    $('#wzAccent').value = cfg.accent || '#f59e0b'; markSw();
    $$('#wzMotif button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-motif') === (cfg.motif && cfg.motif.shape)); });
    $$('#wzLang button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-lang') === cfg.lang); });
    $$('.field-card', wzFields).forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-field') === cfg.field); });
    $$('.cardmini', wzCards).forEach(function (box, i) {
      var it = cfg.items[i] || {};
      $('.c-name', box).value = it.name || '';
      $('.c-price', box).value = it.price || '';
      $('.c-desc', box).value = it.desc || '';
    });
  }

  /* ----- live preview ----- */
  var lastHtml = '';
  function preview() {
    lastHtml = CWG.generate(cfg);
    var fr = $('#wzFrame');
    fr.onload = clearSwitching; // drop the spinner the moment the new field paints
    fr.srcdoc = lastHtml;
    try { localStorage.setItem('cinemate_draft', JSON.stringify(cfg)); } catch (e) {}
    fillReview();
  }
  var pvT; function previewDebounced() { clearTimeout(pvT); pvT = setTimeout(preview, 380); }

  function fillReview() {
    $('#rvBrand').textContent = cfg.brand || '—';
    $('#rvField').textContent = (EMOJI[cfg.field] || '') + ' ' + CWG.presetFor(cfg.field).label;
    $('#rvLang').textContent = cfg.lang === 'en' ? 'English (LTR)' : 'فارسی (RTL)';
    $('#rvAccent').textContent = cfg.accent;
  }

  /* ----- device toggle (preview) ----- */
  $$('#wzDevseg button').forEach(function (b) {
    b.addEventListener('click', function () {
      $('#wzDevice').classList.toggle('mob', b.getAttribute('data-dev') === 'mob');
      $$('#wzDevseg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  /* ----- step navigation ----- */
  function showStep(n) {
    step = Math.max(0, Math.min(STEPS - 1, n));
    $$('.wz-step').forEach(function (el) { el.classList.toggle('on', +el.getAttribute('data-step') === step); });
    paintStepper();
    $('#wzBack').style.visibility = step === 0 ? 'hidden' : 'visible';
    $('#wzNext').textContent = step === STEPS - 1 ? 'پایان ✓' : 'بعدی ←';
    $('.wz-main').scrollTop = 0;
  }
  $('#wzNext').addEventListener('click', function () {
    if (step === 0 && !cfg) { toast('یک حوزه انتخاب کن'); return; }
    if (step === STEPS - 1) { closeWizard(); toast('سایتت آماده است — هر زمان می‌توانی برگردی'); return; }
    showStep(step + 1);
  });
  $('#wzBack').addEventListener('click', function () { showStep(step - 1); });

  /* ----- open / close ----- */
  var wizard = $('#wizard');
  function openWizard() {
    if (!cfg) {
      var draft = null; try { draft = JSON.parse(localStorage.getItem('cinemate_draft') || 'null'); } catch (e) {}
      cfg = draft && draft.field ? draft : defaultCfg();
    }
    // a restored draft whose brand differs from its field's preset label was user-set
    brandTouched = !!(cfg.brand && cfg.brand !== 'برند تو' && cfg.brand !== CWG.presetFor(cfg.field).label);
    syncForm(); preview(); hydratePhotos(); showStep(0);
    wizard.classList.add('show'); document.body.style.overflow = 'hidden';
  }
  function closeWizard() { wizard.classList.remove('show'); document.body.style.overflow = ''; }
  $('#wzClose').addEventListener('click', closeWizard);

  /* ----- delivery ----- */
  function freshHtml() { lastHtml = CWG.generate(cfg); return lastHtml; }
  $('#dlDownload').addEventListener('click', function () {
    var blob = new Blob([freshHtml()], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (slug(cfg.brand) || 'cinematic-site') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('فایل HTML دانلود شد ⬇');
  });
  $('#dlOpen').addEventListener('click', function () {
    var blob = new Blob([freshHtml()], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), '_blank');
  });
  $('#dlCopy').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(freshHtml()).then(function () { toast('کد کپی شد ⧉'); });
    else toast('کپی پشتیبانی نمی‌شود');
  });

  /* ----- hosting (simulated publish) ----- */
  var hostMode = 'sub';
  $$('#hostGrid .host').forEach(function (h) {
    h.addEventListener('click', function () {
      hostMode = h.getAttribute('data-host');
      $$('#hostGrid .host').forEach(function (x) { x.classList.toggle('on', x === h); });
      $('#hostName').placeholder = hostMode === 'custom' ? 'دامنه‌ی اختصاصی (مثلاً brand.com)' : 'نامِ دلخواه برای ساب‌دامین';
    });
  });
  $('#publishBtn').addEventListener('click', function () {
    var name = slug($('#hostName').value || cfg.brand);
    var url = hostMode === 'custom'
      ? 'https://' + ($('#hostName').value || (name + '.com'))
      : 'https://' + name + '.cinemate.site';
    $('#publishBtn').textContent = '… در حال انتشار';
    setTimeout(function () {
      $('#publishUrl').textContent = url;
      $('#publishBox').classList.add('show');
      $('#publishBtn').textContent = '🚀 انتشار روی هاست ما';
      toast('منتشر شد 🎉');
    }, 1100);
  });
  $('#copyUrl').addEventListener('click', function () {
    var u = $('#publishUrl').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('لینک کپی شد'); });
  });

  /* ----- esc closes overlays ----- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAuth(); }
  });
})();
