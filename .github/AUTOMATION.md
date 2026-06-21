# 🤖 خودکارسازیِ نگه‌داری با Claude (GitHub Actions)

این مخزن دو workflow دارد که با **Claude** کار نگه‌داری را خودکار می‌کنند:

| Workflow | فایل | کِی اجرا می‌شود؟ | چه می‌کند؟ |
|----------|------|------------------|------------|
| **Daily Bug Scan & Auto-Fix** | `.github/workflows/daily-maintenance.yml` | هر روز ۰۳:۰۰ UTC (≈ ۰۶:۳۰ تهران) + اجرای دستی | کد را برای باگ بررسی می‌کند، issueهای با برچسب `auto-fix` را رفع می‌کند و یک **Pull Request پیش‌نویس** می‌سازد. اگر باگی نباشد، هیچ PRای ساخته نمی‌شود. |
| **Claude Code** | `.github/workflows/claude.yml` | وقتی در یک issue / کامنت / بازبینیِ PR عبارت `@claude` بیاید | همان لحظه بررسی/اصلاح می‌کند و در صورت نیاز PR می‌سازد. |

---

## ⚙️ راه‌اندازی (یک‌بار)

### ۱) توکنِ احراز هویت را به‌عنوان Secret اضافه کنید
مسیر: **Settings → Secrets and variables → Actions → New repository secret**

این مخزن از **توکنِ اشتراکِ Claude (OAuth)** استفاده می‌کند:

- نام: `CLAUDE_CODE_OAUTH_TOKEN`
- مقدار: توکنِ OAuth شما (با `claude setup-token` ساخته می‌شود)

> اگر به‌جای اشتراک می‌خواهید از **کلید مستقیمِ Anthropic API** استفاده کنید،
> یک secret به نامِ `ANTHROPIC_API_KEY` بسازید و در هر دو workflow خطِ
> `claude_code_oauth_token:` را با `anthropic_api_key:` جایگزین کنید.

### ۲) اجازه‌ی ساخت PR توسط Actions را بدهید
مسیر: **Settings → Actions → General → Workflow permissions**

- گزینه‌ی **Read and write permissions** را فعال کنید.
- تیکِ **Allow GitHub Actions to create and approve pull requests** را بزنید.

### ۳) برچسبِ `auto-fix` را بسازید (اختیاری، برای Part B)
مسیر: **Issues → Labels → New label** با نام `auto-fix`.
هر issueای که این برچسب را داشته باشد، در اسکنِ روزانه برای رفعِ خودکار در نظر گرفته می‌شود.

---

## ▶️ استفاده

- **خودکارِ روزانه:** کاری لازم نیست؛ هر شب اجرا می‌شود. برای اجرای فوری:
  تب **Actions → Daily Bug Scan & Auto-Fix → Run workflow**.
- **درخواستِ دستی:** در هر issue یا کامنتی بنویسید مثلاً:
  > `@claude این خطا را در /api/generate بررسی و رفع کن`

---

## 🔧 سفارشی‌سازی

- **زمانِ اجرا:** مقدار `cron` در `daily-maintenance.yml` را عوض کنید
  (قالب: `دقیقه ساعت روز ماه روزِهفته`، همیشه به وقت **UTC**).
- **مدل:** خطِ `--model claude-opus-4-8` را تغییر دهید.
- **سقفِ گام‌ها:** `--max-turns` را کم/زیاد کنید (هزینه/عمق).

---

## 🔒 نکات

- PRهای روزانه به‌صورت **draft** ساخته می‌شوند تا قبل از merge بازبینی شوند.
- workflowها هرگز `.env`، secretها یا خودِ فایل‌های `.github/workflows/` را تغییر نمی‌دهند.
- اگر `CLAUDE_CODE_OAUTH_TOKEN` تنظیم نشده باشد، اجراها با خطا متوقف می‌شوند (هیچ تغییری روی کد اعمال نمی‌شود).
