/*
 * Cinematic Website Generator — engine
 * ------------------------------------
 * Turns a small config object (brand + field of work + copy + theme) into a
 * complete, self-contained, single-file cinematic scroll-driven website that
 * follows the design system in MASTER-PROMPT.md:
 *
 *   loading screen → pinned scroll-driven HERO → collection cards →
 *   newsletter → footer, with GSAP ScrollTrigger + Lenis smooth scrolling.
 *
 * The TEA template depended on ~227 video frames. Arbitrary fields have no
 * such film, so the hero here is a PROCEDURAL canvas scene (drifting light,
 * orbs, particles, parallax) that is 100% driven by scroll position — themed
 * by the field's accent colour and motif. No external images or video needed.
 *
 * UMD: usable both in the browser (window.CWG) and via require() in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CWG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================================================
     Colour utilities
     ============================================================ */
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return { r: 245, g: 158, b: 11 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    function c(x) { var s = clamp(Math.round(x), 0, 255).toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + c(r) + c(g) + c(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    function f(n) {
      var k = (n + h / 30) % 12;
      var a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    }
    return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }

  function toHsl(hex) { var c = hexToRgb(hex); return rgbToHsl(c.r, c.g, c.b); }

  // shift a hex colour in HSL space
  function shift(hex, dh, dl, ds) {
    var c = toHsl(hex);
    return hslToHex(c.h + (dh || 0), c.s + (ds || 0), c.l + (dl || 0));
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* ============================================================
     Field presets — the "say your field, get a site" magic.
     Each preset supplies a palette + motif + ready-made copy that the
     panel pre-fills (and the user can override).
     ============================================================ */
  function items3(a, b, c) { return [a, b, c]; }

  var PRESETS = {
    tea: {
      label: 'دمنوش و چای', accent: '#f59e0b', bg: '#030303',
      motif: { shape: 'soft', count: 60, speed: 1.0, size: 1.1, glow: true },
      heroTitle: 'دمنوش',
      overlays: [['یک جرعه.', 'حکمتی کهن درون.'], ['گل، هل، نعناع.', 'هر برگ، بیدار.'], ['آهسته دم می‌کشد.', 'اینجا چیزی عجله ندارد.'], ['گرم در دستانت.', 'آرامش از آنِ توست.']],
      eyebrow: 'مجموعه دمنوش‌ها', collectionTitle: 'لحظه‌ات را انتخاب کن.',
      items: items3(
        { name: 'سپیده‌دم', blend: 'دمنوش بیداری بامدادی', desc: 'نعناع. بهار نارنج. زنجبیل. چای سبز.', price: '۱۸۵٬۰۰۰ ت', meta: '۲۰ پاکت · ارگانیک · محصول ایران' },
        { name: 'غروب', blend: 'دمنوش آرامش عصرگاهی', desc: 'گلاب. بابونه. هل. چای سیاه.', price: '۱۹۵٬۰۰۰ ت', meta: '۲۰ پاکت · ارگانیک · محصول ایران', badge: 'پرفروش‌ترین' },
        { name: 'شبانه', blend: 'دمنوش خواب عمیق', desc: 'اسطوخودوس. سنبل‌الطیب. گل گاوزبان.', price: '۲۱۰٬۰۰۰ ت', meta: '۲۰ پاکت · ارگانیک · محصول ایران' }
      ),
      newsletterTitle: 'همراه مراسم باش.', newsletterSub: 'اول بدان. بی‌سروصدا. فقط آرامش.',
      footerNote: 'ریشه در دل طبیعت.'
    },
    coffee: {
      label: 'قهوه و کافه', accent: '#c98a5e', bg: '#0a0706',
      motif: { shape: 'soft', count: 55, speed: 0.9, size: 1.2, glow: true },
      heroTitle: 'قهوه',
      overlays: [['یک فنجان.', 'بیداری واقعی.'], ['رُست تازه.', 'عطر زنده.'], ['دم آهسته.', 'طعم عمیق.'], ['گرم و بی‌وقفه.', 'صبح از آنِ توست.']],
      eyebrow: 'منوی ما', collectionTitle: 'دمت را انتخاب کن.',
      items: items3(
        { name: 'اسپرسو', blend: 'تک‌خاستگاه اتیوپی', desc: 'شکلات تلخ. کارامل. نت مرکبات.', price: '۹۵٬۰۰۰ ت', meta: 'رُست متوسط · ۲۵۰ گرم' },
        { name: 'لاته', blend: 'ترکیب امضای ما', desc: 'شیر مخملی. کرما طلایی. متعادل.', price: '۱۱۰٬۰۰۰ ت', meta: 'پرطرفدار · سرو گرم', badge: 'پیشنهاد باریستا' },
        { name: 'کلد برو', blend: 'دم سرد ۱۸ ساعته', desc: 'نرم. شیرین طبیعی. بدون تلخی.', price: '۱۲۵٬۰۰۰ ت', meta: 'بطری ۳۰۰ml · تازه' }
      ),
      newsletterTitle: 'به جمع ما بپیوند.', newsletterSub: 'تخفیف‌ها و رُست‌های تازه، اول از همه.',
      footerNote: 'دم‌کرده با عشق.'
    },
    perfume: {
      label: 'عطر و زیبایی', accent: '#e6a4ad', bg: '#0a0608',
      motif: { shape: 'soft', count: 50, speed: 0.8, size: 1.3, glow: true },
      heroTitle: 'رایحه',
      overlays: [['یک قطره.', 'خاطره‌ای ماندگار.'], ['نت‌های گلی.', 'عمق چوبی.'], ['روی پوست.', 'زنده می‌شود.'], ['امضای تو.', 'بی‌کلام.']],
      eyebrow: 'کلکسیون عطر', collectionTitle: 'امضایت را بیاب.',
      items: items3(
        { name: 'سپیده', blend: 'گلی · تازه', desc: 'یاس. مرکبات. مشک سفید.', price: '۴۲۰٬۰۰۰ ت', meta: '۵۰ml · ادوپرفیوم' },
        { name: 'مخمل', blend: 'شرقی · گرم', desc: 'گلاب. عنبر. صندل.', price: '۴۸۰٬۰۰۰ ت', meta: '۵۰ml · ماندگاری بالا', badge: 'پرفروش‌ترین' },
        { name: 'نیمه‌شب', blend: 'چوبی · مرموز', desc: 'عود. وانیل. مشک سیاه.', price: '۵۲۰٬۰۰۰ ت', meta: '۵۰ml · رایحه شبانه' }
      ),
      newsletterTitle: 'اولین نفر باش.', newsletterSub: 'رونمایی‌ها و رایحه‌های محدود.',
      footerNote: 'هنرِ بو.'
    },
    jewelry: {
      label: 'طلا و جواهر', accent: '#e7c873', bg: '#08080a',
      motif: { shape: 'spark', count: 70, speed: 1.1, size: 0.9, glow: true },
      heroTitle: 'درخشش',
      overlays: [['یک قطعه.', 'یک عمر.'], ['ساخته‌ی دست.', 'دقتِ بی‌نقص.'], ['نور را می‌گیرد.', 'باز می‌تاباند.'], ['برای تو.', 'فقط تو.']],
      eyebrow: 'کلکسیون', collectionTitle: 'درخشش خود را برگزین.',
      items: items3(
        { name: 'هاله', blend: 'انگشتر طلای ۱۸', desc: 'نگین سولیتر. تراش بریلیان.', price: 'استعلام قیمت', meta: 'دست‌ساز · گارانتی مادام‌العمر' },
        { name: 'زنجیر نور', blend: 'گردنبند ظریف', desc: 'طلای زرد. آویز مینیمال.', price: 'استعلام قیمت', meta: 'سبک روزمره', badge: 'محبوب' },
        { name: 'میراث', blend: 'دستبند کلاسیک', desc: 'بافت دست. قفل ایمن.', price: 'استعلام قیمت', meta: 'ادیشن محدود' }
      ),
      newsletterTitle: 'به محفل ما بپیوند.', newsletterSub: 'رونمایی کلکسیون‌های تازه.',
      footerNote: 'ساخته‌ی دست، برای همیشه.'
    },
    realestate: {
      label: 'املاک و معماری', accent: '#7fa8c9', bg: '#06080b',
      motif: { shape: 'soft', count: 40, speed: 0.7, size: 1.4, glow: false },
      heroTitle: 'فضا',
      overlays: [['یک نشانی.', 'یک زندگی تازه.'], ['نور و خط.', 'سکوت و شکوه.'], ['ساخته‌شده', 'برای ماندن.'], ['خانه‌ات', 'اینجاست.']],
      eyebrow: 'پروژه‌ها', collectionTitle: 'فضای خود را بیاب.',
      items: items3(
        { name: 'برج آرامش', blend: 'مسکونی لوکس', desc: 'دو خوابه. ویو شهر. لابی مدرن.', price: 'مشاوره رایگان', meta: 'منطقه مرکزی · تحویل فوری' },
        { name: 'ویلا باغ', blend: 'اقامتگاه ییلاقی', desc: 'استخر. باغ. حریم کامل.', price: 'مشاوره رایگان', meta: 'حومه · سند تک‌برگ', badge: 'ویژه' },
        { name: 'دفتر کار', blend: 'تجاری اداری', desc: 'فضای باز. نورگیر. پارکینگ.', price: 'مشاوره رایگان', meta: 'مرکز تجاری' }
      ),
      newsletterTitle: 'پیش از همه بدان.', newsletterSub: 'فرصت‌های تازه‌ی سرمایه‌گذاری.',
      footerNote: 'جایی برای ماندن.'
    },
    restaurant: {
      label: 'رستوران و کافه', accent: '#e0613e', bg: '#0a0605',
      motif: { shape: 'spark', count: 55, speed: 1.1, size: 1.0, glow: true },
      heroTitle: 'طعم',
      overlays: [['یک میز.', 'یک خاطره.'], ['آتش و عطر.', 'دستِ سرآشپز.'], ['تازه.', 'هر روز.'], ['به جمع ما', 'خوش آمدی.']],
      eyebrow: 'منو', collectionTitle: 'میزت را رزرو کن.',
      items: items3(
        { name: 'پیش‌غذا', blend: 'شروعی گرم', desc: 'تازه‌ی روز. سرو با نان خانگی.', price: 'از ۹۰٬۰۰۰ ت', meta: 'انتخاب سرآشپز' },
        { name: 'غذای اصلی', blend: 'امضای آشپزخانه', desc: 'گوشت مرغوب. سس مخصوص.', price: 'از ۲۲۰٬۰۰۰ ت', meta: 'پرطرفدار', badge: 'پیشنهاد ویژه' },
        { name: 'دسر', blend: 'پایانی شیرین', desc: 'دست‌ساز. روزانه تازه.', price: 'از ۸۰٬۰۰۰ ت', meta: 'محدود در روز' }
      ),
      newsletterTitle: 'سر میز ما.', newsletterSub: 'منوی فصلی و شب‌های ویژه.',
      footerNote: 'پخته با عشق.'
    },
    fitness: {
      label: 'باشگاه و تناسب اندام', accent: '#b6f24a', bg: '#050607',
      motif: { shape: 'spark', count: 75, speed: 1.4, size: 0.85, glow: true },
      heroTitle: 'قدرت',
      overlays: [['یک تصمیم.', 'تغییری واقعی.'], ['هر تکرار.', 'هر روز.'], ['بدنت', 'گوش می‌دهد.'], ['نسخه‌ی بهتر،', 'همین حالا.']],
      eyebrow: 'برنامه‌ها', collectionTitle: 'مسیرت را انتخاب کن.',
      items: items3(
        { name: 'پایه', blend: 'شروع قدرتمند', desc: 'برنامه‌ی شخصی. مربی همراه.', price: '۴۹۰٬۰۰۰ ت/ماه', meta: 'دسترسی کامل به سالن' },
        { name: 'حرفه‌ای', blend: 'تمرین پیشرفته', desc: 'PT اختصاصی. تغذیه. پایش.', price: '۸۹۰٬۰۰۰ ت/ماه', meta: 'محبوب‌ترین', badge: 'پیشنهادی' },
        { name: 'آنلاین', blend: 'هرجا، هر زمان', desc: 'ویدیوها. برنامه. پشتیبانی.', price: '۲۹۰٬۰۰۰ ت/ماه', meta: 'بدون محدودیت مکان' }
      ),
      newsletterTitle: 'شروع کن.', newsletterSub: 'برنامه‌ی رایگان و انگیزه‌ی هفتگی.',
      footerNote: 'قوی‌تر از دیروز.'
    },
    clinic: {
      label: 'کلینیک و سلامت', accent: '#5fd3c4', bg: '#04080a',
      motif: { shape: 'soft', count: 45, speed: 0.7, size: 1.2, glow: true },
      heroTitle: 'سلامت',
      overlays: [['یک قرار.', 'آرامشی ماندگار.'], ['دقت.', 'مراقبت.'], ['به تو', 'گوش می‌دهیم.'], ['تندرستی،', 'حق توست.']],
      eyebrow: 'خدمات', collectionTitle: 'مراقبت خود را آغاز کن.',
      items: items3(
        { name: 'مشاوره', blend: 'ارزیابی اولیه', desc: 'گفت‌وگوی تخصصی. برنامه‌ی درمان.', price: 'نوبت آنلاین', meta: 'پزشک متخصص' },
        { name: 'درمان', blend: 'مراقبت کامل', desc: 'پیگیری مستمر. تجهیزات روز.', price: 'نوبت آنلاین', meta: 'پرمراجعه', badge: 'توصیه‌شده' },
        { name: 'پایش', blend: 'سلامت بلندمدت', desc: 'چکاپ دوره‌ای. مشاوره‌ی تغذیه.', price: 'نوبت آنلاین', meta: 'برنامه‌ی سالانه' }
      ),
      newsletterTitle: 'با ما در تماس باش.', newsletterSub: 'نکات سلامت و یادآوری نوبت.',
      footerNote: 'مراقب تو هستیم.'
    },
    tech: {
      label: 'فناوری و استارتاپ', accent: '#8b7cf6', bg: '#060610',
      motif: { shape: 'spark', count: 80, speed: 1.2, size: 0.8, glow: true },
      heroTitle: 'آینده',
      overlays: [['یک ایده.', 'مقیاسی جهانی.'], ['سریع.', 'هوشمند.'], ['ساخته‌شده', 'برای رشد.'], ['آینده،', 'از همین‌جا.']],
      eyebrow: 'محصول', collectionTitle: 'پلن خود را انتخاب کن.',
      items: items3(
        { name: 'استارتر', blend: 'برای شروع', desc: 'امکانات پایه. راه‌اندازی سریع.', price: 'رایگان', meta: 'بدون نیاز به کارت' },
        { name: 'پرو', blend: 'برای رشد', desc: 'اتوماسیون. گزارش پیشرفته.', price: '۴۹۹٬۰۰۰ ت/ماه', meta: 'محبوب تیم‌ها', badge: 'پرطرفدار' },
        { name: 'سازمانی', blend: 'برای مقیاس', desc: 'SLA اختصاصی. امنیت سازمانی.', price: 'تماس بگیرید', meta: 'پشتیبانی ۲۴/۷' }
      ),
      newsletterTitle: 'به‌روز بمان.', newsletterSub: 'آپدیت محصول و دسترسی زودهنگام.',
      footerNote: 'ساخته‌شده برای آینده.'
    },
    fashion: {
      label: 'مد و پوشاک', accent: '#d8d2c8', bg: '#08070a',
      motif: { shape: 'soft', count: 50, speed: 0.9, size: 1.1, glow: false },
      heroTitle: 'سبک',
      overlays: [['یک تن‌پوش.', 'یک حضور.'], ['پارچه و فرم.', 'خط و حرکت.'], ['ساخته‌شده', 'برای دیده‌شدن.'], ['سبکِ تو.', 'بی‌رقیب.']],
      eyebrow: 'کالکشن', collectionTitle: 'استایلت را بساز.',
      items: items3(
        { name: 'اسنشال', blend: 'پایه‌ی کمد', desc: 'پارچه‌ی مرغوب. برش تمیز.', price: '۳۹۰٬۰۰۰ ت', meta: 'محصول کپسولی' },
        { name: 'سیگنچر', blend: 'تکه‌ی شاخص', desc: 'طراحی محدود. دوخت دقیق.', price: '۶۹۰٬۰۰۰ ت', meta: 'ادیشن فصل', badge: 'جدید' },
        { name: 'مجلسی', blend: 'برای شب‌ها', desc: 'جزئیات ظریف. درخشش ملایم.', price: '۹۸۰٬۰۰۰ ت', meta: 'تعداد محدود' }
      ),
      newsletterTitle: 'به لیست ما بپیوند.', newsletterSub: 'دراپ‌های تازه و دسترسی زودهنگام.',
      footerNote: 'سبک، بی‌زمان.'
    },
    _default: {
      label: 'کسب‌وکار', accent: '#f59e0b', bg: '#050505',
      motif: { shape: 'soft', count: 55, speed: 1.0, size: 1.1, glow: true },
      heroTitle: 'برند تو',
      overlays: [['یک ایده.', 'اجرایی بی‌نقص.'], ['کیفیت.', 'در هر جزئیات.'], ['ساخته‌شده', 'برای تو.'], ['داستان تو،', 'از همین‌جا.']],
      eyebrow: 'خدمات ما', collectionTitle: 'انتخاب خود را بکن.',
      items: items3(
        { name: 'گزینه یک', blend: 'بسته‌ی پایه', desc: 'شرح کوتاه خدمت یا محصول شما.', price: 'تماس بگیرید', meta: 'جزئیات · مشخصات' },
        { name: 'گزینه دو', blend: 'بسته‌ی محبوب', desc: 'شرح کوتاه خدمت یا محصول شما.', price: 'تماس بگیرید', meta: 'جزئیات · مشخصات', badge: 'پیشنهادی' },
        { name: 'گزینه سه', blend: 'بسته‌ی کامل', desc: 'شرح کوتاه خدمت یا محصول شما.', price: 'تماس بگیرید', meta: 'جزئیات · مشخصات' }
      ),
      newsletterTitle: 'با ما همراه باش.', newsletterSub: 'تازه‌ترین‌ها را اول از همه بدان.',
      footerNote: 'ساخته‌شده با دقت.'
    }
  };

  function presetFor(field) {
    return PRESETS[field] || PRESETS._default;
  }

  /* ============================================================
     The runtime engine — serialised into each generated page.
     Written as a real function (so it is syntax-checked here) and
     injected via .toString(). It reads everything it needs from
     window.__SITE__ — so NO template interpolation happens inside it.
     ============================================================ */
  function engineSource() {
    'use strict';
    var SITE = window.__SITE__ || {};
    var theme = SITE.theme || {};
    var accent = theme.accent || '#f59e0b';
    var motif = theme.motif || { shape: 'soft', count: 55, speed: 1, size: 1, glow: true };

    /* ---- tiny colour helpers (self-contained) ---- */
    function hx(hex) {
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var AC = hx(accent);
    function ac(a) { return 'rgba(' + AC.r + ',' + AC.g + ',' + AC.b + ',' + a + ')'; }

    /* ---- seeded RNG ---- */
    function hash(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    var canvas = document.getElementById('hero-canvas');
    var ctx = canvas.getContext('2d', { alpha: false });
    var loader = document.getElementById('loader');
    var loaderFill = document.getElementById('loaderFill');
    var lenis = null;

    var lightMode = window.matchMedia('(max-width: 768px)').matches;

    /* ---- canvas sizing (height read from #progress-track, like the TEA template) ---- */
    var cw = 0, ch = 0, dpr = 1;
    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var track = document.getElementById('progress-track');
      var w = document.documentElement.clientWidth || window.innerWidth;
      var h = (track && track.clientHeight) || window.innerHeight;
      cw = Math.max(1, Math.round(w * dpr));
      ch = Math.max(1, Math.round(h * dpr));
      canvas.width = cw; canvas.height = ch;
    }

    /* ---- build the procedural scene (deterministic geometry + ambient drift) ---- */
    var scene = null;
    function buildScene() {
      var rng = mulberry32(hash(accent + motif.shape + (SITE.brand || '')));
      var orbs = [];
      var oN = 5;
      for (var i = 0; i < oN; i++) {
        orbs.push({
          x: 0.12 + 0.76 * rng(),
          y: 0.15 + 0.7 * rng(),
          r: 0.18 + 0.34 * rng(),
          depth: 0.25 + 0.75 * rng(),
          drift: (rng() - 0.5) * 0.5,
          hue: (rng() - 0.5) * 26,
          ph: rng() * 6.28
        });
      }
      var area = (cw * ch) / (dpr * dpr);
      var baseCount = Math.round((motif.count || 55) * Math.min(1.4, Math.max(0.5, area / (1280 * 720))));
      var pN = lightMode ? Math.round(baseCount * 0.55) : baseCount;
      var parts = [];
      for (var j = 0; j < pN; j++) {
        parts.push({
          x: rng(), y: rng(),
          z: 0.18 + 0.82 * rng(),         // depth 0..1 (bigger = closer)
          sp: 0.5 + rng(),                 // scroll travel factor
          tw: rng() * 6.2832,             // twinkle phase
          dx: (rng() - 0.5),               // horizontal sway
          sz: 0.5 + rng()
        });
      }
      scene = { orbs: orbs, parts: parts };
    }

    /* ---- draw one frame: story tied to scroll p, micro-life tied to time t ---- */
    var curP = 0;
    function setP(p) { curP = p < 0 ? 0 : (p > 1 ? 1 : p); }

    function draw(t) {
      if (!scene) return;
      var p = curP;
      var W = cw, H = ch;
      var bg = hx(theme.bg || '#050505');

      // base wash — near-black, slightly lifted toward the top as the "sun" rises
      var g0 = ctx.createLinearGradient(0, 0, 0, H);
      var liftTop = 0.04 + 0.10 * p;
      g0.addColorStop(0, 'rgb(' + Math.round(bg.r + 14 * liftTop * 6) + ',' + Math.round(bg.g + 12 * liftTop * 6) + ',' + Math.round(bg.b + 10 * liftTop * 6) + ')');
      g0.addColorStop(0.55, 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')');
      g0.addColorStop(1, 'rgb(' + Math.max(0, bg.r - 2) + ',' + Math.max(0, bg.g - 2) + ',' + Math.max(0, bg.b - 2) + ')');
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';

      // the anchor light — a soft accent bloom that rises and grows with scroll
      var sunX = (0.5 + 0.12 * Math.sin(t * 0.00008 + 1.5)) * W;
      var sunY = (0.86 - 0.5 * p) * H;
      var sunR = (0.26 + 0.34 * p) * Math.max(W, H);
      var sunBreath = 0.85 + 0.15 * Math.sin(t * 0.0011);
      var sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
      sun.addColorStop(0, ac(0.42 * sunBreath));
      sun.addColorStop(0.35, ac(0.16 * sunBreath));
      sun.addColorStop(1, ac(0));
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);

      // parallax orbs — drift sideways with scroll, breathe with time
      var orbs = scene.orbs;
      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i];
        var px = (o.x + o.drift * (p - 0.5) * 0.6 + 0.02 * Math.sin(t * 0.0003 + o.ph)) * W;
        var py = (o.y - p * 0.18 * o.depth) * H;
        var pr = o.r * Math.min(W, H) * (0.85 + 0.15 * Math.sin(t * 0.0009 + o.ph)) * (0.7 + 0.3 * o.depth);
        var col = shiftLite(AC, o.hue);
        var rg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        var oa = (0.05 + 0.10 * o.depth);
        rg.addColorStop(0, 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',' + oa + ')');
        rg.addColorStop(1, 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }

      // particles — rise with scroll, twinkle with time
      var parts = scene.parts;
      var spark = motif.shape === 'spark';
      var baseSz = (motif.size || 1) * (spark ? 1.6 : 4.2) * dpr;
      for (var k = 0; k < parts.length; k++) {
        var pt = parts[k];
        var travel = (pt.y - p * pt.sp * (motif.speed || 1) * 0.55 - t * 0.000012 * pt.sp);
        var yy = (travel % 1 + 1) % 1;
        var xx = (pt.x + pt.dx * 0.05 * Math.sin(t * 0.0004 + pt.tw) + (p - 0.5) * pt.dx * 0.08);
        xx = ((xx % 1) + 1) % 1;
        var depth = pt.z;
        var tw = 0.5 + 0.5 * Math.sin(t * 0.0018 + pt.tw);
        var alpha = (spark ? 0.5 : 0.32) * depth * (0.45 + 0.55 * tw);
        var r = baseSz * (0.4 + depth) * pt.sz;
        var cx = xx * W, cy = yy * H;
        if (motif.glow) {
          var pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * (spark ? 3.5 : 2.4));
          pg.addColorStop(0, ac(alpha));
          pg.addColorStop(1, ac(0));
          ctx.fillStyle = pg;
          ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
        } else {
          ctx.fillStyle = ac(alpha * 0.9);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, 6.2832);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';

      // cinematic vignette
      var vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.2, W / 2, H * 0.55, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    function shiftLite(c, dh) {
      // rough hue nudge in RGB space — cheap, good enough for soft glows
      var f = dh / 60;
      return {
        r: Math.max(0, Math.min(255, Math.round(c.r + 18 * f))),
        g: Math.max(0, Math.min(255, Math.round(c.g - 6 * f))),
        b: Math.max(0, Math.min(255, Math.round(c.b - 12 * f)))
      };
    }

    /* ---- continuous render loop (ambient life; story driven by curP) ---- */
    var running = false;
    function loop(t) { if (!running) return; draw(t); requestAnimationFrame(loop); }

    /* ---- word splitting for overlays ---- */
    function splitWords() {
      var nodes = document.querySelectorAll('[data-split]');
      Array.prototype.forEach.call(nodes, function (el) {
        var words = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        words.forEach(function (w, i) {
          var s = document.createElement('span');
          s.className = 'word'; s.textContent = w;
          el.appendChild(s);
          if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
      });
    }

    /* ---- static reveal: a correct hero with no animation libraries ----
       Used when GSAP/ScrollTrigger are unavailable (e.g. a blocked CDN). The
       page still shows THIS brand/field/theme — the ambient canvas keeps
       running and the collection + newsletter sit at their natural visible
       state — instead of being stranded behind the loader. */
    function staticReveal() {
      var title = document.querySelector('#ov1 .title-text');
      if (title) { title.style.opacity = '1'; title.style.transform = 'none'; }
      var brand = document.getElementById('ovBrand');
      if (brand) brand.style.opacity = '1';
    }

    /* ---- scroll-driven timeline ---- */
    function buildScroll() {
      // No animation engine (blocked/slow CDN) → reveal a static hero instead
      // of throwing, which would otherwise leave the page stuck on the loader.
      if (!window.gsap || !window.ScrollTrigger) { staticReveal(); return; }
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      if (window.Lenis) {
        lenis = new Lenis({ lerp: 0.1 });
        window.lenis = lenis;
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
        lenis.stop();
      }

      var playhead = { f: 0 };
      var heroEnd = lightMode ? '+=320%' : '+=700%';
      var master = gsap.timeline({
        scrollTrigger: {
          trigger: '.hero', start: 'top top', end: heroEnd,
          pin: true, scrub: 0.4, invalidateOnRefresh: true
        }
      });

      // scrub the scene's story progress 0 -> 1 across the hero
      master.to(playhead, {
        f: 1, ease: 'none', duration: 100,
        onUpdate: function () { setP(playhead.f); }
      }, 0);

      // brand mark fades the instant scrolling starts
      master.to('#ovBrand', { autoAlpha: 0, ease: 'power2.out', duration: 4 }, 0);

      // ov1 — the big title word
      master.fromTo('#ov1 .title-text',
        { autoAlpha: 0, yPercent: 30 },
        { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 2.4 }, 5);
      master.to('#ov1', { autoAlpha: 0, ease: 'power1.in', duration: 2.2 }, 15);

      // ov2..ovN — word-by-word reveals at beats baked into data-in/data-out
      var groups = document.querySelectorAll('.overlay[data-grp]');
      Array.prototype.forEach.call(groups, function (el) {
        var inAt = parseFloat(el.getAttribute('data-in'));
        var outAt = parseFloat(el.getAttribute('data-out'));
        master.fromTo('#' + el.id + ' .word',
          { autoAlpha: 0, yPercent: 60 },
          { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 1.6, stagger: 1.2 }, inAt);
        master.to('#' + el.id, { autoAlpha: 0, ease: 'power1.in', duration: 3 }, outAt);
      });

      // right-edge progress
      gsap.fromTo('#progress-fill', { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

      // collection cards reveal
      gsap.from('.card', {
        autoAlpha: 0, yPercent: 14, duration: 1, ease: 'power2.out', stagger: 0.14,
        scrollTrigger: { trigger: '.collection', start: 'top 72%' }
      });

      // newsletter reveal
      gsap.from('.nl-reveal', {
        autoAlpha: 0, y: 28, duration: 1, ease: 'power2.out', stagger: 0.12,
        scrollTrigger: { trigger: '.newsletter', start: 'top 70%' }
      });
    }

    /* ---- boot ---- */
    function init() {
      document.body.classList.add('loading');
      window.scrollTo(0, 0);
      sizeCanvas();
      buildScene();
      splitWords();
      running = true;
      requestAnimationFrame(loop);

      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

      // no frames to fetch — animate the loader bar, then reveal once fonts settle
      var pct = 0;
      var tick = setInterval(function () {
        pct = Math.min(100, pct + 8 + Math.random() * 12);
        loaderFill.style.width = pct.toFixed(0) + '%';
        if (pct >= 100) clearInterval(tick);
      }, 55);

      Promise.all([fontsReady, new Promise(function (r) { setTimeout(r, 650); })]).then(function () {
        clearInterval(tick);
        loaderFill.style.width = '100%';
        sizeCanvas();
        buildScene();
        // Never let a scroll-setup failure trap the page behind the loader.
        try { buildScroll(); } catch (e) { staticReveal(); }
        loader.classList.add('hidden');
        setTimeout(function () {
          document.body.classList.remove('loading');
          loader.style.display = 'none';
          if (lenis) lenis.start();
          requestAnimationFrame(function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); });
        }, 850);
      });
    }

    /* ---- resize (debounced; ignore mobile address-bar height-only changes) ---- */
    var resizeTimer, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (lightMode && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeCanvas(); buildScene();
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      }, 160);
    });

    /* ---- header CTA jump + form guards ---- */
    var shop = document.getElementById('shopLink');
    if (shop) shop.addEventListener('click', function () {
      var c = document.getElementById('collection');
      if (!c) return;
      if (lenis) lenis.scrollTo(c, { duration: 1.5 });
      else window.scrollTo(0, c.getBoundingClientRect().top + window.pageYOffset);
    });
    var nlForm = document.getElementById('nlForm');
    if (nlForm) nlForm.addEventListener('submit', function (e) { e.preventDefault(); });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  /* ============================================================
     HTML builders
     ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // beats for overlay groups (in/out in timeline units 0..100)
  function beatsFor(n) {
    if (n <= 1) return [[30, 70]];
    if (n === 2) return [[20, 46], [56, 90]];
    if (n === 3) return [[18, 40], [48, 68], [76, 94]];
    return [[16, 34], [40, 56], [62, 76], [82, 94]];
  }

  // overlay placements cycle through these anchor classes
  var OV_POS = ['ov2', 'ov3', 'ov4', 'ov5'];

  function cardMediaStyle(accent, idx) {
    var hueShift = [-12, 2, 16][idx % 3];
    var a = shift(accent, hueShift, 0, 0);
    var darkA = shift(a, 0, -(toHsl(a).l - 9), -(toHsl(a).s - 34)); // very dark tint
    var darkB = shift(a, 8, -(toHsl(a).l - 5), -(toHsl(a).s - 28));
    return 'linear-gradient(155deg, ' + darkA + ', ' + darkB + ')';
  }

  function buildCard(item, accent, idx, lang) {
    var media;
    if (item.image) {
      media = '<img class="card-media" src="' + esc(item.image) + '" alt="' + esc(item.name) + '" loading="lazy" decoding="async" />';
    } else {
      var initial = (item.name || '').trim().charAt(0) || '✦';
      media = '<div class="card-media card-media-gen" style="background:' + cardMediaStyle(accent, idx) + '">' +
        '<span class="card-glyph">' + esc(initial) + '</span></div>';
    }
    var badge = item.badge ? '<span class="card-badge">' + esc(item.badge) + '</span>' : '';
    var btnLabel = lang === 'en' ? 'ADD TO CART' : 'سفارش بده';
    return '' +
      '<article class="card card-' + idx + '">' +
        badge +
        media +
        '<div class="card-body">' +
          '<span class="card-name">' + esc(item.name) + '</span>' +
          (item.blend ? '<span class="card-blend">' + esc(item.blend) + '</span>' : '') +
          (item.desc ? '<p class="card-ingredients">' + esc(item.desc) + '</p>' : '') +
          '<div class="card-foot">' +
            '<div class="card-price-row">' +
              '<span class="card-price">' + esc(item.price || '') + '</span>' +
              '<button class="card-btn" type="button">' + esc(item.cta || btnLabel) + '</button>' +
            '</div>' +
            (item.meta ? '<span class="card-meta">' + esc(item.meta) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function favicon(accent, bg) {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='" + bg + "'/><circle cx='16' cy='16' r='9' fill='" + accent + "'/></svg>";
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function baseCss(theme, lang) {
    var accent = theme.accent;
    var bg = theme.bg;
    var rtl = lang !== 'en';
    var fontBody = rtl ? "'Vazirmatn', 'Inter', sans-serif" : "'Inter', sans-serif";
    var fontDisplay = rtl ? "'Vazirmatn', sans-serif" : "'Cormorant Garamond', Georgia, serif";
    var dir = rtl ? 'rtl' : 'ltr';
    var pad = rtl ? 'padding-left' : 'padding-right';
    return [
'*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
':root{--bg:' + bg + ';--accent:' + accent + ';--ease:cubic-bezier(0.16,1,0.3,1)}',
'html,body{background:var(--bg)}',
'body{font-family:' + fontBody + ';color:#fff;direction:' + dir + ';overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
'body.loading{overflow:hidden;height:100vh}',
'::selection{background:' + rgba(accent, 0.25) + ';color:#fff}',
/* lenis */
'html.lenis,html.lenis body{height:auto}',
'.lenis.lenis-smooth{scroll-behavior:auto !important}',
'.lenis.lenis-smooth [data-lenis-prevent]{overscroll-behavior:contain}',
'.lenis.lenis-stopped{overflow:hidden}',
'.lenis.lenis-smooth iframe{pointer-events:none}',
/* loader */
'#loader{position:fixed;inset:0;z-index:1000;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .8s ease}',
'#loader.hidden{opacity:0;pointer-events:none}',
'.loader-title{font-family:' + fontDisplay + ';font-size:clamp(26px,7vw,48px);font-weight:600;color:var(--accent);letter-spacing:.18em;' + pad + ':.18em}',
'.loader-bar-track{width:200px;height:2px;margin-top:32px;background:' + rgba(accent, 0.15) + ';border-radius:2px;overflow:hidden}',
'.loader-bar-fill{width:0%;height:100%;background:var(--accent);transition:width .25s ease}',
'.loader-note{margin-top:18px;font-size:11px;font-weight:300;letter-spacing:.14em;color:rgba(255,255,255,.3)}',
/* header */
'#site-header{position:fixed;top:0;left:0;right:0;height:64px;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:0 34px}',
'.header-brand{font-family:' + fontDisplay + ';font-size:16px;font-weight:600;color:var(--accent);letter-spacing:.22em;' + pad + ':.22em;text-shadow:0 2px 24px rgba(0,0,0,.8);text-decoration:none}',
'.header-shop{font-size:11px;font-weight:400;text-transform:uppercase;letter-spacing:.18em;color:rgba(255,255,255,.6);text-decoration:none;cursor:pointer;transition:color .35s var(--ease);text-shadow:0 2px 24px rgba(0,0,0,.8)}',
/* progress */
'#progress-track{position:fixed;top:0;right:0;width:2px;height:100vh;height:100lvh;z-index:100;background:' + rgba(accent, 0.15) + '}',
'#progress-fill{width:100%;height:100%;background:' + rgba(accent, 0.8) + ';transform:scaleY(0);transform-origin:top}',
/* hero */
'.hero{position:relative;width:100%;height:100vh;height:100lvh;overflow:hidden;background:#000}',
'#hero-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1}',
'.overlay{position:absolute;z-index:2;pointer-events:none;line-height:1.16;max-width:46%}',
'.ov1{top:11%;left:50%;transform:translateX(-50%);text-align:center;max-width:92%}',
'.ov2{left:8%;bottom:15%;text-align:left}',
'.ov3{right:8%;top:50%;transform:translateY(-50%);text-align:right}',
'.ov4{left:8%;top:50%;transform:translateY(-50%);text-align:left}',
'.ov5{left:8%;top:16%;text-align:left}',
'.title-text{display:inline-block;font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(40px,9vw,118px);letter-spacing:.28em;' + pad + ':.28em;white-space:nowrap;color:' + rgba(accent, 0.92) + ';text-shadow:0 2px 50px rgba(0,0,0,.9);opacity:0}',
'.oline{display:block;white-space:nowrap;font-family:' + fontDisplay + ';font-style:' + (rtl ? 'normal' : 'italic') + ';font-weight:' + (rtl ? '500' : '500') + ';font-size:clamp(23px,4.5vw,42px);color:rgba(255,255,255,.9);text-shadow:0 2px 30px rgba(0,0,0,.95),0 0 70px rgba(0,0,0,.8)}',
'.word{display:inline-block;opacity:0}',
'.brand-mark{position:absolute;z-index:2;left:50%;top:83%;transform:translate(-50%,-50%);text-align:center;pointer-events:none}',
'.brand-word{display:block;font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(30px,5.4vw,72px);letter-spacing:.14em;' + pad + ':.14em;white-space:nowrap;color:' + rgba(accent, 0.95) + ';text-shadow:0 2px 50px rgba(0,0,0,.9)}',
/* collection */
'.collection{position:relative;padding:150px 34px 170px;background:radial-gradient(ellipse 62% 46% at 50% 0%,' + rgba(accent, 0.06) + ',transparent 72%),var(--bg)}',
'.collection-head{text-align:center;margin-bottom:78px}',
'.collection-eyebrow{display:block;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.4em;' + pad + ':.4em;color:var(--accent)}',
'.collection-title{margin-top:16px;font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(30px,5vw,46px);color:#fff}',
'.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:26px;max-width:1120px;margin:0 auto}',
'.card{position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:12px;box-shadow:0 0 0 1px ' + rgba(accent, 0.3) + ',0 24px 50px -34px rgba(0,0,0,.9);transition:transform .4s var(--ease),box-shadow .4s var(--ease)}',
'.card-media{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;transition:transform .5s var(--ease)}',
'.card-media-gen{display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}',
'.card-media-gen::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 25%,' + rgba(accent, 0.22) + ',transparent 60%)}',
'.card-glyph{font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(60px,9vw,104px);color:' + rgba(accent, 0.5) + ';position:relative;z-index:1;text-shadow:0 4px 40px rgba(0,0,0,.5)}',
'.card-body{display:flex;flex-direction:column;flex:1;padding:32px 34px 34px;text-align:' + (rtl ? 'right' : 'left') + '}',
'.card-name{font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(28px,3.4vw,38px);letter-spacing:' + (rtl ? '.04em' : '.14em') + ';color:var(--accent)}',
'.card-blend{margin-top:4px;font-family:' + fontDisplay + ';font-style:' + (rtl ? 'normal' : 'italic') + ';font-size:16px;color:rgba(255,255,255,.5)}',
'.card-ingredients{margin-top:22px;font-size:13px;font-weight:300;line-height:1.7;color:rgba(255,255,255,.6)}',
'.card-foot{margin-top:auto;padding-top:34px}',
'.card-price-row{display:flex;align-items:center;justify-content:space-between;gap:16px;direction:' + dir + '}',
'.card-price{font-family:' + fontDisplay + ';font-weight:500;font-size:clamp(22px,3vw,30px);color:#fff}',
'.card-btn{font-family:' + fontBody + ';font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.16em;color:var(--accent);background:transparent;border:1px solid ' + rgba(accent, 0.45) + ';border-radius:6px;padding:12px 16px;cursor:pointer;white-space:nowrap;transition:background .35s var(--ease),color .35s var(--ease),border-color .35s var(--ease)}',
'.card-meta{display:block;margin-top:22px;font-size:10px;font-weight:400;letter-spacing:.12em;color:rgba(255,255,255,.3)}',
'.card-badge{position:absolute;top:20px;' + (rtl ? 'left' : 'right') + ':20px;z-index:3;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.16em;color:var(--accent);border:1px solid ' + rgba(accent, 0.4) + ';border-radius:100px;padding:5px 10px;background:' + rgba(bg, 0.5) + '}',
/* newsletter */
'.newsletter{position:relative;padding:168px 34px;text-align:center;background:radial-gradient(ellipse 80% 60% at 50% 50%,' + rgba(accent, 0.08) + ',transparent 70%),linear-gradient(to bottom,' + rgba(bg, 0.4) + ',var(--bg))}',
'.newsletter-title{font-family:' + fontDisplay + ';font-weight:600;font-size:clamp(34px,6vw,52px);color:#fff}',
'.newsletter-sub{margin-top:16px;font-size:13px;font-weight:300;letter-spacing:.05em;color:rgba(255,255,255,.45)}',
'.newsletter-form{margin-top:44px;display:inline-flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center;direction:' + dir + '}',
'.newsletter-input{width:min(320px,78vw);padding:12px 4px;font-family:' + fontBody + ';font-size:13px;color:#fff;background:transparent;border:none;border-bottom:1px solid ' + rgba(accent, 0.55) + ';outline:none;transition:border-color .35s var(--ease);text-align:' + (rtl ? 'right' : 'left') + '}',
'.newsletter-input::placeholder{color:rgba(255,255,255,.3)}',
'.newsletter-input:focus{border-bottom-color:var(--accent)}',
'.newsletter-btn{font-family:' + fontBody + ';font-size:12px;font-weight:500;letter-spacing:.14em;color:var(--accent);background:transparent;border:none;cursor:pointer;padding:8px 2px;transition:opacity .3s ease}',
'.newsletter-btn span{border-bottom:1px solid transparent;transition:border-color .3s ease}',
/* footer */
'.site-footer{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:42px 34px;background:var(--bg);border-top:1px solid ' + rgba(accent, 0.15) + '}',
'.footer-brand{font-family:' + fontDisplay + ';font-size:18px;font-weight:600;letter-spacing:.18em;' + pad + ':.18em;color:var(--accent)}',
'.footer-center{font-size:11px;font-weight:300;letter-spacing:.04em;color:rgba(255,255,255,.3)}',
'.footer-links{font-size:11px;color:rgba(255,255,255,.5)}',
'.footer-links a{color:inherit;text-decoration:none;transition:color .3s ease}',
/* responsive */
'@media (max-width:768px){#site-header{padding:0 20px}.collection{padding:110px 22px 120px}.newsletter{padding:120px 22px}.overlay{max-width:84%}.ov2{left:7%;bottom:12%}.ov3{right:7%}.ov4{left:7%}.ov5{left:7%}}',
'@media (max-width:600px){.title-text{letter-spacing:.14em;' + pad + ':.14em}.oline{white-space:normal}.card-body{padding:26px 24px 30px}.card-price-row{flex-direction:column;align-items:stretch}.card-btn{padding:16px}.newsletter-btn{padding:14px 10px}.header-brand,.header-shop{display:inline-flex;align-items:center;min-height:44px}}',
'@media (max-width:680px){.site-footer{flex-direction:column;text-align:center;gap:16px}}',
'@media (max-width:480px){#site-header{height:56px}}',
'@media (max-width:400px){.overlay{max-width:90%}.ov2,.ov4,.ov5{left:5%}.ov3{right:5%}}',
'@media (hover:hover){.card:hover{transform:translateY(-12px);box-shadow:0 0 0 1px ' + rgba(accent, 0.6) + ',0 36px 64px -28px rgba(0,0,0,.9),0 0 60px -14px ' + rgba(accent, 0.28) + '}.card:hover .card-media{transform:scale(1.045)}.header-shop:hover{color:var(--accent)}.card-btn:hover{background:var(--accent);border-color:var(--accent);color:#100c06}.newsletter-btn:hover span{border-bottom-color:var(--accent)}.footer-links a:hover{text-decoration:underline;color:var(--accent)}}'
    ].join('\n');
  }

  /* ============================================================
     withDefaults — merge a preset with user overrides into a full config
     ============================================================ */
  function withDefaults(input) {
    var cfg = input || {};
    var preset = presetFor(cfg.field);
    var lang = cfg.lang || 'fa';
    var accent = cfg.accent || preset.accent;
    var bg = cfg.bg || preset.bg;
    var brand = cfg.brand || preset.label;

    // Guard by TYPE, not just null: a malformed non-array (e.g. a string sent
    // to POST /api/generate) would otherwise reach the .map()/.slice() calls in
    // generate() and throw a TypeError. Fall back to the preset defaults.
    var overlays = Array.isArray(cfg.overlays) ? cfg.overlays : preset.overlays;
    var items = Array.isArray(cfg.items) ? cfg.items : preset.items;

    return {
      brand: brand,
      field: cfg.field || '_default',
      fieldLabel: cfg.fieldLabel || preset.label,
      lang: lang,
      title: cfg.title || (brand + ' — ' + (cfg.fieldLabel || preset.label)),
      description: cfg.description || cfg.tagline || (brand + ' · ' + preset.label),
      theme: {
        accent: accent, bg: bg,
        motif: cfg.motif || preset.motif
      },
      heroTitle: cfg.heroTitle || preset.heroTitle,
      overlays: overlays,
      eyebrow: cfg.eyebrow || preset.eyebrow,
      collectionTitle: cfg.collectionTitle || preset.collectionTitle,
      items: items,
      newsletterTitle: cfg.newsletterTitle || preset.newsletterTitle,
      newsletterSub: cfg.newsletterSub || preset.newsletterSub,
      newsletterCta: cfg.newsletterCta || (lang === 'en' ? 'BEGIN →' : 'شروع ←'),
      newsletterPlaceholder: cfg.newsletterPlaceholder || (lang === 'en' ? 'your email' : 'ایمیل شما'),
      shopLabel: cfg.shopLabel || (lang === 'en' ? 'SHOP' : 'سفارش'),
      footerNote: cfg.footerNote || preset.footerNote,
      footerLinks: Array.isArray(cfg.footerLinks) ? cfg.footerLinks : (lang === 'en'
        ? [{ label: 'Instagram', href: '#top' }, { label: 'Contact', href: '#top' }]
        : [{ label: 'اینستاگرام', href: '#top' }, { label: 'تماس', href: '#top' }]),
      year: cfg.year || (lang === 'en' ? '2026' : '۱۴۰۵')
    };
  }

  /* ============================================================
     generate — produce the full single-file HTML document
     ============================================================ */
  function generate(input) {
    var c = withDefaults(input);
    var lang = c.lang;
    var rtl = lang !== 'en';
    var accent = c.theme.accent;
    var bg = c.theme.bg;

    // build overlays markup (first 4 groups)
    var groups = (c.overlays || []).slice(0, 4);
    var beats = beatsFor(groups.length);
    var overlaysHtml = groups.map(function (lines, i) {
      var pos = OV_POS[i] || 'ov2';
      var b = beats[i];
      var linesHtml = (Array.isArray(lines) ? lines : [lines]).map(function (ln) {
        return '<span class="oline" data-split>' + esc(ln) + '</span>';
      }).join('');
      return '<div class="overlay ' + pos + '" id="ov' + (i + 2) + '" data-grp data-in="' + b[0] + '" data-out="' + b[1] + '">' + linesHtml + '</div>';
    }).join('\n  ');

    var cardsHtml = (c.items || []).slice(0, 3).map(function (it, i) {
      return buildCard(it, accent, i, lang);
    }).join('\n    ');

    var footerLinksHtml = (c.footerLinks || []).map(function (l) {
      return '<a href="' + esc(l.href || '#top') + '">' + esc(l.label) + '</a>';
    }).join(' · ');

    // fonts
    // For FA sites: self-hosted Vazirmatn @font-face (same-origin /fonts/…)
    // so the site renders correctly even where Google Fonts is blocked (e.g.
    // Iran) when hosted on our platform; the Google link stays as a fallback.
    var vazirFace =
      '<style>' +
      "@font-face{font-family:'Vazirmatn';font-weight:300;font-display:swap;src:url('/fonts/vazirmatn/Vazirmatn-Light.woff2') format('woff2')}" +
      "@font-face{font-family:'Vazirmatn';font-weight:400;font-display:swap;src:url('/fonts/vazirmatn/Vazirmatn-Regular.woff2') format('woff2')}" +
      "@font-face{font-family:'Vazirmatn';font-weight:500;font-display:swap;src:url('/fonts/vazirmatn/Vazirmatn-Medium.woff2') format('woff2')}" +
      "@font-face{font-family:'Vazirmatn';font-weight:600;font-display:swap;src:url('/fonts/vazirmatn/Vazirmatn-SemiBold.woff2') format('woff2')}" +
      "@font-face{font-family:'Vazirmatn';font-weight:700;font-display:swap;src:url('/fonts/vazirmatn/Vazirmatn-Bold.woff2') format('woff2')}" +
      '</style>\n';

    var fontLinks =
      '<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
      (rtl
        ? vazirFace + '<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap" rel="stylesheet" />'
        : '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />');

    // the runtime config the engine reads
    var siteRuntime = {
      brand: c.brand,
      theme: { accent: accent, bg: bg, motif: c.theme.motif }
    };

    var engine = '(' + engineSource.toString() + ')();';

    var html =
'<!DOCTYPE html>\n' +
'<html lang="' + (rtl ? 'fa' : 'en') + '" dir="' + (rtl ? 'rtl' : 'ltr') + '">\n' +
'<head>\n' +
'<meta charset="UTF-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'<title>' + esc(c.title) + '</title>\n' +
'<meta name="description" content="' + esc(c.description) + '" />\n' +
'<meta name="theme-color" content="' + esc(bg) + '" />\n' +
'<link rel="icon" href="' + favicon(accent, bg) + '" />\n' +
fontLinks + '\n' +
'<style>\n' + baseCss(c.theme, lang) + '\n</style>\n' +
'</head>\n' +
'<body class="loading">\n\n' +
'<!-- loading -->\n' +
'<div id="loader">\n' +
'  <div class="loader-title">' + esc(c.brand) + '</div>\n' +
'  <div class="loader-bar-track"><div class="loader-bar-fill" id="loaderFill"></div></div>\n' +
'  <div class="loader-note">' + esc(lang === 'en' ? 'Preparing your experience...' : 'در حال آماده‌سازی...') + '</div>\n' +
'</div>\n\n' +
'<!-- header -->\n' +
'<header id="site-header">\n' +
'  <a class="header-brand" href="#top">' + esc(c.brand) + '</a>\n' +
'  <a class="header-shop" id="shopLink">' + esc(c.shopLabel) + '</a>\n' +
'</header>\n\n' +
'<!-- progress -->\n' +
'<div id="progress-track"><div id="progress-fill"></div></div>\n\n' +
'<!-- hero -->\n' +
'<section class="hero" id="top">\n' +
'  <canvas id="hero-canvas" aria-hidden="true"></canvas>\n' +
'  <div class="brand-mark" id="ovBrand"><span class="brand-word">' + esc(c.brand) + '</span></div>\n' +
'  <div class="overlay ov1" id="ov1"><span class="title-text">' + esc(c.heroTitle) + '</span></div>\n' +
'  ' + overlaysHtml + '\n' +
'</section>\n\n' +
'<!-- collection -->\n' +
'<section class="collection" id="collection">\n' +
'  <div class="collection-head">\n' +
'    <span class="collection-eyebrow">' + esc(c.eyebrow) + '</span>\n' +
'    <h2 class="collection-title">' + esc(c.collectionTitle) + '</h2>\n' +
'  </div>\n' +
'  <div class="cards">\n    ' + cardsHtml + '\n  </div>\n' +
'</section>\n\n' +
'<!-- newsletter -->\n' +
'<section class="newsletter">\n' +
'  <h2 class="newsletter-title nl-reveal">' + esc(c.newsletterTitle) + '</h2>\n' +
'  <p class="newsletter-sub nl-reveal">' + esc(c.newsletterSub) + '</p>\n' +
'  <form class="newsletter-form nl-reveal" id="nlForm">\n' +
'    <input class="newsletter-input" type="email" placeholder="' + esc(c.newsletterPlaceholder) + '" aria-label="' + esc(c.newsletterPlaceholder) + '" />\n' +
'    <button class="newsletter-btn" type="submit"><span>' + esc(c.newsletterCta) + '</span></button>\n' +
'  </form>\n' +
'</section>\n\n' +
'<!-- footer -->\n' +
'<footer class="site-footer">\n' +
'  <span class="footer-brand">' + esc(c.brand) + '</span>\n' +
'  <span class="footer-center">© ' + esc(c.year) + ' ' + esc(c.brand) + '. ' + esc(c.footerNote) + '</span>\n' +
'  <span class="footer-links">' + footerLinksHtml + '</span>\n' +
'</footer>\n\n' +
'<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></scr' + 'ipt>\n' +
'<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></scr' + 'ipt>\n' +
'<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js"></scr' + 'ipt>\n' +
'<script>window.__SITE__ = ' + JSON.stringify(siteRuntime) + ';</scr' + 'ipt>\n' +
'<script>' + engine + '</scr' + 'ipt>\n' +
'</body>\n</html>\n';

    return html;
  }

  /* ============================================================
     parsePrompt — heuristic "mega prompt" → config (no API key needed)
     Detects language, field, brand and accent from free text. Used as the
     no-key path in the panel and as the server-side fallback when no LLM
     key is configured.
     ============================================================ */
  var FIELD_KEYWORDS = [
    ['tea', ['چای', 'دمنوش', 'دم‌نوش', 'دمنوش‌', 'tea', 'herbal', 'tisane', 'چای‌خانه']],
    ['coffee', ['قهوه', 'کافه', 'اسپرسو', 'لاته', 'coffee', 'cafe', 'café', 'espresso', 'barista', 'latte']],
    ['perfume', ['عطر', 'ادکلن', 'رایحه', 'آرایش', 'زیبایی', 'perfume', 'fragrance', 'scent', 'beauty', 'cosmetic', 'cologne']],
    ['jewelry', ['طلا', 'جواهر', 'زیورآلات', 'نگین', 'الماس', 'jewelry', 'jewellery', 'gold', 'diamond', 'gem']],
    ['realestate', ['املاک', 'مسکن', 'آپارتمان', 'ویلا', 'معماری', 'real estate', 'realestate', 'property', 'realty', 'architecture', 'estate']],
    ['restaurant', ['رستوران', 'کافه‌رستوران', 'بیسترو', 'کترینگ', 'restaurant', 'dining', 'bistro', 'eatery', 'menu', 'food']],
    ['fitness', ['باشگاه', 'بدنسازی', 'فیتنس', 'تناسب', 'کراسفیت', 'gym', 'fitness', 'workout', 'crossfit', 'training']],
    ['clinic', ['کلینیک', 'درمان', 'پزشک', 'سلامت', 'دندان', 'clinic', 'medical', 'health', 'dental', 'therapy', 'wellness']],
    ['tech', ['استارتاپ', 'نرم‌افزار', 'اپلیکیشن', 'فناوری', 'تکنولوژی', 'هوش مصنوعی', 'tech', 'startup', 'software', 'app', 'saas', 'ai', 'platform']],
    ['fashion', ['مد', 'پوشاک', 'لباس', 'بوتیک', 'fashion', 'clothing', 'apparel', 'wear', 'boutique', 'couture']]
  ];

  var ACCENT_KEYWORDS = [
    ['#f59e0b', ['کهربایی', 'amber', 'نارنجی', 'orange']],
    ['#e7c873', ['طلایی', 'gold', 'golden']],
    ['#e0613e', ['قرمز', 'سرخ', 'red', 'ember', 'آتشی']],
    ['#e6a4ad', ['صورتی', 'pink', 'rose', 'گلی']],
    ['#7fa8c9', ['آبی', 'blue', 'navy', 'سرمه‌ای']],
    ['#5fd3c4', ['فیروزه‌ای', 'teal', 'turquoise', 'سبزآبی']],
    ['#b6f24a', ['سبز', 'green', 'lime', 'لیمویی']],
    ['#8b5cf6', ['بنفش', 'purple', 'violet', 'ارغوانی']],
    ['#c98a5e', ['قهوه‌ای', 'brown', 'caramel', 'کاراملی']]
  ];

  function detectField(t) {
    for (var i = 0; i < FIELD_KEYWORDS.length; i++) {
      var kws = FIELD_KEYWORDS[i][1];
      for (var j = 0; j < kws.length; j++) {
        if (t.indexOf(kws[j].toLowerCase()) !== -1) return FIELD_KEYWORDS[i][0];
      }
    }
    return '_default';
  }

  function detectAccent(t) {
    for (var i = 0; i < ACCENT_KEYWORDS.length; i++) {
      var kws = ACCENT_KEYWORDS[i][1];
      for (var j = 0; j < kws.length; j++) {
        if (t.indexOf(kws[j].toLowerCase()) !== -1) return ACCENT_KEYWORDS[i][0];
      }
    }
    return null;
  }

  function detectBrand(raw) {
    // quoted name first: «...», "...", “...”, '...'
    var m = raw.match(/[«"“']\s*([^»"”'\n]{1,40}?)\s*[»"”']/);
    if (m && m[1].trim()) return m[1].trim();
    // "برند ..." / "به نام ..." / "named ..." / "called ..." / "brand ..."
    m = raw.match(/(?:برند(?:\s+به\s+نام)?|به\s+نام|brand(?:\s+(?:called|named))?|named|called)\s+[«"“']?([^\s،.,«»"”'\n]{2,40})/i);
    if (m && m[1].trim()) return m[1].trim();
    return null;
  }

  function parsePrompt(text) {
    var raw = String(text || '');
    var lower = raw.toLowerCase();
    var lang = /[؀-ۿ]/.test(raw) ? 'fa' : 'en';
    var field = detectField(lower);
    var accent = detectAccent(lower);
    var brand = detectBrand(raw);
    var cfg = { field: field, lang: lang };
    if (brand) cfg.brand = brand;
    if (accent) cfg.accent = accent;
    if (raw.trim()) cfg.description = raw.trim().slice(0, 180);
    return cfg; // pass through withDefaults to fill the rest from the preset
  }

  return {
    generate: generate,
    withDefaults: withDefaults,
    presetFor: presetFor,
    parsePrompt: parsePrompt,
    presets: PRESETS,
    util: { shift: shift, rgba: rgba, toHsl: toHsl }
  };
});
