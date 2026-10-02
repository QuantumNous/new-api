# Persian (fa) translation guide

This guide applies to every Persian string in `web/src/i18n/locales/fa.json`. Follow it in every translation session, together with the i18n workflow in `.agents/skills/i18n-translate/SKILL.md`.

## Locale status

- `fa` is a partial locale. A key that is missing from `fa.json` shows the English text for that key. `bun run i18n:sync` reports missing Persian keys but does not fill them with English.
- Only put a key in `fa.json` when it has a real Persian translation. If the correct Persian text is identical to the English (a brand name, for example), leave the key out.
- Persian is right-to-left. Selecting it sets `dir="rtl"` and `lang="fa"` on the page.
- Numbers and dates formatted through `Intl` use the constant `PERSIAN_INTL_LOCALE` in `web/src/i18n/languages.ts`. It is `fa`, which gives Persian digits (۱۲۳). Set it to `fa-u-nu-latn` for Latin digits (123).
- Write all locale changes through the script described in the i18n skill, then run `bun run i18n:sync` and `bun run i18n:check-fa` from `web/`. The check must report no findings.

## Dates and times

These rules apply only when the interface language is Persian. Every other language keeps its current date output.

- Absolute dates are shown in the Solar Hijri calendar, in numeric year/month/day order with `/` between the fields and 24-hour time: `۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹` (2026-09-25 15:05:09). Digits follow `PERSIAN_INTL_LOCALE`.
- Relative times are Persian: «۳ دقیقه پیش».
- Code: format display dates with the shared helpers in `web/src/lib/format.ts` and `web/src/lib/time.ts` (`formatDisplayDate`, `formatTimestampToDate`, `formatTimestamp`, `formatDateTimeStr`, `formatDateStr`, `formatDate`, `formatDateTimeObject`, `formatChartTime`) and relative times with `formatFromNow` or `formatTimestampRelative`. Pass the interface locale as the last argument: `toIntlLocale(i18n.resolvedLanguage || i18n.language)`, computed at render. Do not call `dayjs().format()`, `toLocaleString()` or `fromNow()` directly for a displayed date.
- Only displayed dates change. Values sent to the API, date-range filter values, input values (`formatTimestampForInput`), exports and copied text stay Gregorian.
- Where a Solar Hijri date and time is shown in a table, list or log cell, set `title={formatGregorianTitle(timestamp, locale)}` on the element, so the Gregorian date and time can be matched with provider invoices and server logs. It returns `undefined` for other languages.
- Dashboard chart axes are Solar Hijri (`formatChartTime` with the locale); the chart points are ordered by timestamp, so the order stays right across Nowruz.
- The date pickers (`web/src/components/ui/calendar.tsx`, used by `date-picker.tsx` and `datetime-picker.tsx`) show the Solar Hijri calendar through the `@daypicker/persian` add-on, loaded lazily only when the interface language is Persian. Its digits follow `PERSIAN_INTL_LOCALE`, and its direction follows the direction provider. The Date values the pickers return are unchanged. The text on the picker buttons, including the usage-log range picker, is Solar Hijri through `formatDisplayDate`; the native date-time inputs inside the usage-log range picker are drawn by the browser and stay Gregorian.
- Dependency note: `@daypicker/persian` pins `@daypicker/react`, which pins `react-day-picker` to the same exact version (10.0.1 today). Upgrade `react-day-picker` and `@daypicker/persian` together, to the same version, and check that `web/bun.lock` still has a single `react-day-picker` entry. The add-on also pins `date-fns-jalali` (4.1.0-0); its `-N` suffix mirrors the date-fns version and is the normal release line, not a prerelease.
- In a translation, wrap an interpolated date or time in FSI and PDI (rule 10 below).

## Glossary

Use these terms consistently. If a new recurring term comes up, add it here first.

| English | Persian | Reason |
| --- | --- | --- |
| token (unit of text counted by a model) | توکن | The established loanword in Persian AI writing; a translation such as «نشانه» is not recognized by users. |
| API key | کلید API (plural: کلیدهای API) | «کلید» is the common Persian term for a credential; API stays English. |
| token, when it means an API key (token group, token name) | کلید API / گروه کلید | Older strings call API keys "tokens". Translate by meaning so it is not confused with text tokens. The bare label "Token" stays «توکن» because several screens share it. |
| access token | توکن دسترسی | Standard term in Persian security writing. |
| channel | کانال | Short, familiar loanword; describes a configured upstream connection. |
| model | مدل | Standard term. |
| group | گروه | Standard term. |
| quota | سهمیه | The natural word for an allotted amount of usage. |
| balance | موجودی | What Persian banking and wallet apps use. |
| top-up, recharge | شارژ (verb: شارژ کردن) | What Persian users say for adding credit to an account or wallet. |
| redemption code | کد شارژ | A code that adds credit, the same idea as a prepaid top-up code; «کد بازخرید» is a word-for-word calque. |
| redeem | ثبت کد | Describes the action the user performs. |
| wallet | کیف پول | Standard term in Persian payment apps. |
| subscription | اشتراک | Standard term. |
| subscription plan | طرح اشتراک | «طرح» is common for plans; «پلن» is too informal. |
| usage log | گزارش مصرف | «گزارش» reads naturally for end users; «لاگ» is developer jargon. |
| audit log, task log | گزارش حسابرسی، گزارش وظایف | Same reason as usage log. |
| pricing | قیمت‌گذاری | Standard term. |
| price | قیمت | Standard term. |
| ratio, multiplier | ضریب | It is a billing multiplier; «نسبت» would suggest a fraction. |
| playground | محیط آزمایش | Says what the page is for; «زمین بازی» is a literal calque. |
| dashboard | داشبورد | Widely used loanword. |
| console | کنسول | Widely used loanword; also fits the browser console. |
| model square (model catalog page) | ویترین مدل‌ها | A catalog of models with prices; «ویترین» is the natural Persian image. |
| user, admin | کاربر، مدیر | Standard terms. |
| sign in, sign up, sign out | ورود، ثبت‌نام، خروج | Standard terms on Persian websites. |
| password | رمز عبور | Standard term. |
| verification code | کد تأیید | Standard term. |
| passkey | کلید عبور | The term Persian platform interfaces use. |
| two-factor authentication | احراز هویت دومرحله‌ای | Standard term. |
| authenticator app | برنامۀ احراز هویت | Describes the app, not a brand. |
| session | نشست | Standard term for a sign-in session. |
| profile | پروفایل | More familiar to users than «نمایه». |
| settings | تنظیمات | Standard term. |
| provider (upstream AI service) | ارائه‌دهنده | Standard term. |
| upstream | بالادستی | Standard technical term. |
| task (asynchronous job) | وظیفه | Neutral term for a background job. |
| plugin | افزونه | Standard term. |
| deployment | استقرار | Standard technical term. |
| rate limit | محدودیت نرخ | Standard technical term. |
| link | پیوند | Standard term. |
| theme | پوسته | Standard term in Persian interfaces. |
| sidebar | نوار کناری | Standard term. |
| clipboard | کلیپ‌بورد | Widely used loanword. |
| reset (a password or settings) | بازنشانی | Standard term. |
| refresh | تازه‌سازی | Standard term. |
| announcement, notification | اطلاعیه، اعلان | Standard terms. |
| audit (as in audit record, audit info) | حسابرسی | Matches «گزارش حسابرسی». |
| billing (how the cost of a request is calculated: billing mode, billing path, billing details) | محاسبۀ هزینه | Says what the section shows; «صورت‌حساب» is kept for invoices and the billing and payment settings. |
| vendor (the maker of a model, such as OpenAI) | سازنده | These are model makers, not sellers; «فروشنده» would be wrong and «ارائه‌دهنده» is taken by provider. |
| header (HTTP request header) | هدر | The loanword Persian developers use; the header names themselves stay English. |
| tier (pricing tier) | سطح | Standard term for a pricing level. |
| base URL | نشانی پایه | «نشانی» is the Persian interface word for an address; URL stays English only where the value itself is meant. |
| tag (a label on channels or models) | برچسب | Standard term. An HTML or XML tag such as `<think>` is «تگ». |
| priority, weight (channel selection) | اولویت، وزن | Standard terms. |
| mapping (model mapping, status code mapping) | نگاشت | Standard technical term for a key-to-value map. |
| model redirect | تغییر مسیر مدل | Says what happens to the request. Sending a person to another page is «انتقال» instead. |
| override (parameter, header or quota override) | بازنویسی | The value replaces the one that would otherwise apply; «جایگزینی» is kept for replace. |
| pass-through (request body or headers) | عبور مستقیم | The request goes upstream unchanged. |
| forward (send a request upstream) | ارسال | Plain verb. Native forwarding is «ارسال بدون تبدیل»; a forwarding route is «مسیر هدایت». |
| route, routing | مسیر، مسیریابی | Standard terms. |
| fallback route | مسیر پیش‌فرض | The route used when no rule matches. |
| endpoint | نقطۀ پایانی (plural: نقطه‌های پایانی) | Standard technical term. |
| source, target (in a mapping or conversion) | مبدأ، مقصد | Standard terms. |
| converter (protocol or format) | مبدل | Standard technical term. |
| regex, regular expression | عبارت باقاعده | The established Persian term. |
| catch-all (rule) | فراگیر | A rule that matches everything. |
| connection shards (HTTP/2) | بخش‌های اتصال | Describes the split connection pool. |
| multi-key (channel) | چندکلیدی | One channel with several keys. |
| polling (multi-key mode) | نوبتی | Keys are used in turn. Polling an asynchronous task for its result is «بررسی دوره‌ای». |
| credential | اعتبارنامه | Standard security term. «اطلاعات کاربری» is kept for a person's sign-in details. |
| metadata | فراداده | Standard technical term. |
| container, replica | کانتینر، رپلیکا | Loanwords Persian developers use. |
| snapshot (saved state of data) | نمای لحظه‌ای | Describes a picture of the data at one moment. |
| reset credit (a provider's usage reset) | اعتبار بازنشانی | Matches «بازنشانی» for reset. |
| prompt, system prompt | پرامپت، پرامپت سیستمی | The loanword Persian AI users know. |
| cache | کش | Widely used loanword. |
| search | جست‌وجو | The two-part spelling with ZWNJ, as the Academy of Persian Language writes it; not «جستجو». |
| template | الگو | Used for rule, parameter and payment templates; «قالب» is kept for format. |
| node (a deployment instance in the flow chart and system info) | گره | Matches «نام گره»; an instance record is «نمونه». |
| flow (traffic flow chart) | جریان | Describes the Sankey chart of requests. |
| artifact (files a task produced) | خروجی (plural: خروجی‌ها) | Matches «خروجی» for output; «آرتیفکت» is jargon. |
| pop-up (window) | پنجرۀ بازشو | Standard interface term. |
| inference (server, status) | استنتاج | Standard machine learning term. |
| schema (usage schema) | طرح‌واره | Standard technical term. |
| marketplace (plugin sources) | بازارچه | A small catalogue of installable plugins; «مارکت‌پلیس» is a loanword users do not need. |
| factory plugin, built-in | داخلی | The plugin shipped with the product; «کارخانه‌ای» reads like a factory reset. |
| dry run | اجرای آزمایشی | Runs without effect. A plugin sandbox is «محیط آزمایشی». |
| changelog | فهرست تغییرات | Standard term. |
| integrity hash, integrity check | هش یکپارچگی، بررسی یکپارچگی | Standard security terms. |
| load, loading, reload, upload | بارگذاری (reload: دوباره بارگذاری کردن) | One term for loading data and uploading files. |
| download, downloaded | دانلود، دانلودشده | The word users know; every download string uses it. «دریافت» is kept for fetch and pull. |
| async, asynchronous | ناهمگام | Written joined, like همگام; the prefix نا and the compound are not separated by ZWNJ (rule 1 does not apply). |

## Terms that stay in English

- Model names and model IDs (gpt-4o, claude-sonnet, gemini-2.5-pro).
- API, JSON, YAML, SDK, URL, HTTP, SMTP, SSRF, OAuth, OIDC, TOTP, IP, QR (as in «کد QR»), UTC.
- Provider, product and brand names: OpenAI, Anthropic, Claude, Gemini, DeepSeek, GitHub, Discord, Telegram, WeChat, LinuxDO, Stripe, Cloudflare, and the product name itself.
- Code: identifiers, JSON keys, file paths, environment variables, HTTP headers, command lines, keyboard key names (Escape, Enter).
- i18next placeholders and markup, exactly as in the English source.

## Typography rules

1. Use ZWNJ (U+200C, نیم‌فاصله) between a word and its affixes, never a space and never fully joined:
   - the verb prefixes می and نمی: می‌شود، نمی‌کند
   - the plural ها: سرویس‌ها، نتیجه‌ها. After a letter that never joins the next one (ا د ذ ر ز ژ و), write ها directly with no ZWNJ: کلیدها، فیلترها، رمزهای عبور.
   - تر and ترین: تازه‌تر، سریع‌ترین. Exception, following the Academy of Persian Language: بیشتر، کمتر، بهتر and their superlatives (بیشترین، کمترین، بهترین) are written joined.
   ZWNJ is only valid between two Persian letters.
2. Use Persian ی (U+06CC) and ک (U+06A9), never Arabic ي or ك.
3. Never use Arabic-Indic digits (٠ to ٩). Digits written inside a translation use Persian digits (۰ to ۹), to match the Intl default; prefer words for small numbers (شش‌رقمی، یک دقیقه).
4. Write ۀ as the single character U+06C0 (صفحۀ ورود), never ه followed by U+0654.
5. Use Persian punctuation ، ؛ ؟ and « », with no space before the mark. Use … for an ellipsis.
6. No em dash in Persian text.
7. A Latin word or number next to Persian text gets exactly one space on each side: «ورود با GitHub». Never attach a Persian affix to a Latin word; rephrase instead (کلیدهای API, not APIها).
8. Keep i18next placeholders such as `{{count}}` and any markup exactly as in the English source.
9. Write natural, concise product Persian, as a native speaker would write it, not a word-for-word translation.
10. Wrap an interpolated value in U+2068 FSI (first strong isolate) and U+2069 PDI (pop directional isolate) when it is, or may contain, left-to-right text that includes digits, punctuation or symbols: dates, times, version numbers, amounts with a currency symbol, IP addresses, IDs. Without the isolate, the bidirectional algorithm can move the neutral characters of the value (spaces, `-`, `:`, `$`) to the other side of the surrounding Persian text, so `2026-10-25 13:55` renders as `13:55 25-10-2026`. Put the FSI directly before the placeholder and the PDI directly after it, inside the translation value. Plain words and numbers already formatted by `Intl` for Persian do not need it. Every FSI (and any LRI or RLI) needs its PDI, and every PDI needs an opener; `check-fa` enforces this.

    Example, with the two invisible characters written as `[FSI]` and `[PDI]`:

    | Key | Persian value |
    | --- | --- |
    | `Last active {{time}} · Expires {{expires}}` | `آخرین فعالیت: [FSI]{{time}}[PDI] · انقضا: [FSI]{{expires}}[PDI]` |

    In the `newKeys` object of the i18n script, write them as the JavaScript escapes `\u2068` and `\u2069`; the script stores the characters themselves in `fa.json`.
11. An input or text area that holds a URL, an ID or code keeps `dir="ltr"` in Persian, so a typed value runs left to right. Its placeholder takes the same direction, which scrambles a Persian placeholder: `شناسۀ آیکون (مثلاً github یا gitlab)` shows its words and parentheses out of order. `dir="auto"` does not help, because an empty input takes its direction from its value, not its placeholder. Wrap the whole Persian value of such a placeholder in U+2067 RLI (right-to-left isolate) and U+2069 PDI: `[RLI]شناسۀ کلاینت OAuth[PDI]`. The value then reads right to left inside the left-to-right input, and other languages are unchanged. In the i18n script, write them as `\u2067` and `\u2069`.

## Style

- Address the user politely with the plural «شما» and plural imperatives (وارد کنید، تلاش کنید).
- Drop "please" in most prompts and validation messages; Persian interfaces sound more natural without «لطفاً» on every line.
- Buttons and menu items are short: a noun or verbal noun (ذخیره، حذف، ورود) rather than a full sentence.
- Status messages use the past tense (ذخیره شد، ارسال شد); failures use «ناموفق بود».
- Some English keys are sentence fragments that the code joins around a link (for example "I have read and agree to the" + link). Choose wording that still reads naturally in that fixed order.
- Check the call site before translating: the same English key can be a noun in one place and a verb in another.

## Automated check

`bun run i18n:check-fa` (from `web/`) runs `web/scripts/check-fa.mjs` against `fa.json` and exits with code 1 on any finding. It checks rules 1 to 8, the isolate pairing in rule 10 (an FSI, LRI or RLI without its PDI, or a PDI without an opener), empty values, stray whitespace, and keys that do not exist in `en.json`. For rule 11 it parses the `.tsx` and `.jsx` files under `src/` (with `@babel/parser`), collects the `t('…')` keys in the `placeholder` of every element with a literal `dir='ltr'`, and reports each one whose Persian value is not wrapped in RLI … PDI. The source scan runs when no `fa.json` path is given, or with `--src <dir>`.

Dependency note: `check-fa` imports `@babel/parser` directly, so it is declared as a dev dependency of `web/` (`^7.29.7`, MIT, maintained by the Babel team, no runtime dependency besides `@babel/types`, not part of the app bundle). The same package is already required by `@babel/core`, `@tanstack/router-plugin` and `shadcn`; after an upgrade, check that `web/bun.lock` still has a single `@babel/parser` entry.

Its ZWNJ checks for joined words are heuristics:

- Joined می or نمی is detected on any word starting with them, except a short list of real words (میان، میزان، میانگین، میلیون and similar) kept in the script.
- Joined plural ها is detected on any word ending in ها, های or هایی, except a short list of real words (تنها، نهایی and similar).
- Joined plural ها after a non-joining letter (ا د ذ ر ز ژ و) is accepted, and a ZWNJ in that position is reported.
- Joined تر and ترین are detected only on a list of common adjectives. بیش، کم and به are not on that list; a ZWNJ in بیش‌تر، کم‌تر or به‌تر is reported.

Extend those lists in the script when a real word is flagged, and review joined comparatives by eye. Natural phrasing and correct terminology still need a human review.
