# cinematic-tea-website


# 🍵 TEA Scrollytelling

یک وب‌سایت سینمایی و لوکس مبتنی بر **Scroll-Driven Storytelling** که با استفاده از **GSAP**, **ScrollTrigger**, **Lenis** و تکنیک **Image Sequence Animation** ساخته شده است.

در این پروژه، یک ویدیو به مجموعه‌ای از تصاویر (Frames) تبدیل می‌شود و با اسکرول کاربر، فریم‌ها به‌صورت متوالی نمایش داده می‌شوند تا تجربه‌ای مشابه پخش ویدیو ایجاد شود.

---

## ✨ ویژگی‌ها

* Scroll-Driven Animation
* Image Sequence Hero Section
* GSAP ScrollTrigger
* Lenis Smooth Scrolling
* Canvas Rendering
* Loading Screen با Progress Bar
* Product Collection Section
* Newsletter Section
* Fully Responsive
* بدون React
* بدون TypeScript
* بدون Build Step

---

## 🛠 تکنولوژی‌ها

* HTML
* CSS
* JavaScript
* Express.js
* GSAP
* ScrollTrigger
* Lenis
* FFmpeg

---

## 📂 ساختار پروژه

```text
project/
├── package.json
├── server.js
├── resourcess-assets/
│   └── video-01.mp4
└── public/
    ├── index.html
    ├── newsletter-bg.jpg
    ├── dawn.jpg
    ├── dusk.jpg
    ├── night.jpg
    └── frames/
        ├── frame_0001.jpg
        ├── frame_0002.jpg
        ├── frame_0003.jpg
        └── ...
```

---

## 🚀 نصب و اجرا

نصب وابستگی‌ها:

```bash
npm install
```

اجرای پروژه:

```bash
node server.js
```

سپس پروژه در آدرس زیر اجرا خواهد شد:

```text
http://localhost:3000
```

اگر پورت 3000 اشغال باشد، سرور به‌صورت خودکار روی اولین پورت آزاد اجرا می‌شود.

---

# 🎬 شخصی‌سازی پروژه

## تغییر محتوای انیمیشن اسکرول

این پروژه از تکنیک **Image Sequence Animation** استفاده می‌کند.

یعنی به‌جای پخش مستقیم ویدیو، مجموعه‌ای از تصاویر پشت سر هم نمایش داده می‌شوند و اسکرول کاربر تعیین می‌کند کدام فریم نمایش داده شود.

---

## مرحله 1 — ساخت ویدیو

ابتدا یک ویدیوی سینمایی برای برند یا محصول خود ایجاد کنید.

می‌توانید از ابزارهای هوش مصنوعی زیر استفاده کنید:

* Runway
* Kling AI
* Veo
* Hailuo AI
* Pika
* Luma Dream Machine

بهترین نتیجه معمولاً از ویدیوهای 10 تا 30 ثانیه‌ای با حرکت نرم دوربین به دست می‌آید.

---

## مرحله 2 — تبدیل ویدیو به فریم

پس از آماده شدن ویدیو، آن را به تصاویر فریم‌به‌فریم تبدیل کنید.

نمونه با FFmpeg:

```bash
ffmpeg -i video.mp4 \
-vf "fps=7.5,scale=1600:-2" \
-q:v 3 public/frames/frame_%04d.jpg
```

خروجی:

```text
frame_0001.jpg
frame_0002.jpg
frame_0003.jpg
...
```

همچنین می‌توانید از نرم‌افزارهای زیر استفاده کنید:

* FFmpeg
* Adobe Premiere Pro
* Adobe After Effects
* DaVinci Resolve

---

## مرحله 3 — جایگزینی فریم‌ها

تمام فریم‌های استخراج‌شده را در پوشه زیر قرار دهید:

```text
public/frames/
```

ساختار نام فایل‌ها باید مشابه زیر باشد:

```text
frame_0001.jpg
frame_0002.jpg
frame_0003.jpg
...
```

در صورت تغییر تعداد فریم‌ها، مقدار `frameCount` در کد JavaScript را نیز به‌روزرسانی کنید.

---

## مرحله 4 — تغییر تصاویر محصولات

تصاویر کارت‌های محصولات در مسیر زیر قرار دارند:

```text
public/
├── dawn.jpg
├── dusk.jpg
└── night.jpg
```

برای استفاده از تصاویر خود، کافی است این فایل‌ها را جایگزین کنید یا مسیر آن‌ها را در کد تغییر دهید.

---

## مرحله 5 — تغییر تصویر Newsletter

تصویر پس‌زمینه بخش Newsletter از فایل زیر استفاده می‌کند:

```text
public/newsletter-bg.jpg
```

می‌توانید یک فریم دلخواه از ویدیوی خود استخراج کرده و با این فایل جایگزین کنید.

نمونه:

```bash
ffmpeg -ss 24.9 \
-i video.mp4 \
-frames:v 1 \
-q:v 3 \
public/newsletter-bg.jpg
```

---

## 📈 پیشنهادات برای بهترین نتیجه

* مدت ویدیو: 10 تا 30 ثانیه
* تعداد فریم‌ها: 150 تا 300
* عرض فریم‌ها: 1280px تا 1600px
* فرمت: JPG یا WebP
* حجم هر فریم: کمتر از 150KB
* استفاده از حرکات آرام دوربین برای ایجاد حس سینمایی

---

## 🎨 طراحی

### رنگ اصلی

```css
#f59e0b
```

### رنگ پس‌زمینه

```css
#030303
```

### فونت‌ها

* Cormorant Garamond
* Inter

---

## 📜 لایسنس

این پروژه برای اهداف آموزشی، نمونه‌کار و توسعه رابط‌های کاربری سینمایی ساخته شده است.

Feel free to fork, customize and build your own scroll-driven story experience.
