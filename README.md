<div align="center">

# سِيَر · Siyar

**A free, open-source, Arabic-first CV analyzer and job-outreach toolkit.**

No account. No daily limit. No subscription. Your CV never leaves your device.

[العربية](#بالعربية) · [English](#in-english)

</div>

---

## In English

Job seekers in the Gulf are routinely charged for things a piece of software can
do for nothing: 54 SAR to have a CV made "ATS-compatible", 37 SAR for a list of
employer email addresses, 99 SAR to have that CV emailed out. The free tiers that
exist are capped at a handful of runs a day and hand back an opaque number.

Siyar does the two parts that genuinely automate, and gives them away:

### 1. CV analyzer

Upload a PDF or DOCX in Arabic or English and get a scored report against a
published rubric.

- **Unlimited.** No counter, no paywall after the third run.
- **Auditable.** The [rubric](packages/ats-core/rubric/v1.json) is a versioned
  JSON document in this repo. Every deduction names the check that caused it,
  quotes the text in your file that triggered it, and says how to fix it. If you
  think a rule is wrong, open a pull request against it.
- **Local-first.** Parsing and scoring run in your browser. Nothing is uploaded,
  nothing is stored server-side, no account exists. Disconnect your network after
  the page loads and run an analysis — it still works.
- **Actually handles Arabic.** Arabic PDFs frequently store text as
  *presentation forms* (U+FE70–FEFF) in visual rather than logical order. Most
  CV tools read that as gibberish and score it accordingly. We reverse the
  shaping, decompose lam-alef ligatures, strip tatweel and harakat, and repair
  bidi ordering before a single rule runs.

### 2. Outreach

Draft a message, pick or import a list of employers, and Siyar opens **your own**
mail client or Gmail with the message written and recipients filled in. You review
it and press send yourself.

There is no SMTP server, no OAuth, no stored credentials, and nothing sends on
your behalf. Mail leaves your mailbox, lands in your Sent folder, and replies come
straight back to you — which is also the only way it reaches an inbox rather than
a spam folder.

The built-in directory contains only addresses an organisation has **published
itself** for receiving applications, each with a source URL and a verification
date, contributed by pull request. Any organisation can have its entry removed on
request, permanently. See [REMOVALS.md](packages/contacts/data/REMOVALS.md).

### Optional AI

Bring your own API key (Claude, OpenAI) or point it at a local Ollama instance.
The key is stored in your browser and forwarded per-request; the server keeps
nothing. **Every number in your score is computed without the model** — the AI
only rewrites bullets and drafts prose. Use it or don't; the tool is complete
either way.

---

## بالعربية

الباحث عن عمل في الخليج يُطلب منه الدفع مقابل أشياء يستطيع البرنامج أن يؤديها
مجانًا: ٥٤ ريالًا لجعل السيرة الذاتية «متوافقة مع ATS»، و٣٧ ريالًا لقائمة إيميلات
شركات، و٩٩ ريالًا لإرسال تلك السيرة. والأدوات المجانية المتاحة محدودة بثلاث
محاولات في اليوم، وتعطيك رقمًا لا تعرف من أين جاء.

**سِيَر** يؤدي الجزأين اللذين يمكن أتمتتهما فعلًا، ويمنحهما مجانًا:

### ١. تحليل السيرة الذاتية

ارفع ملف PDF أو Word بالعربية أو الإنجليزية، واحصل على تقرير مفصّل وفق معايير
منشورة.

- **بلا حد.** لا عدّاد، ولا صفحة دفع بعد المحاولة الثالثة.
- **قابل للمراجعة.** [معايير التقييم](packages/ats-core/rubric/v1.json) ملف JSON
  في هذا المستودع. كل نقطة تُخصم تذكر القاعدة التي سبّبتها، وتقتبس النص من ملفك
  الذي أثارها، وتشرح كيف تصلحه. وإن رأيت قاعدة خاطئة، اقترح تعديلها.
- **يعمل داخل جهازك.** القراءة والتحليل يجريان في المتصفح. لا رفع، ولا تخزين،
  ولا حساب. اقطع الإنترنت بعد فتح الصفحة وجرّب — سيعمل.
- **يفهم العربية فعلًا.** ملفات PDF العربية كثيرًا ما تخزّن النص بأشكاله المتصلة
  (U+FE70–FEFF) وبترتيب بصري لا منطقي، فتقرأه أغلب الأدوات كطلاسم وتقيّمه على هذا
  الأساس. نحن نعيد الحروف إلى أصولها، ونفكّك لام-ألف، ونزيل التطويل والتشكيل،
  ونصحّح ترتيب النص قبل تطبيق أي قاعدة.

### ٢. الإرسال

اكتب رسالتك، اختر قائمة جهات أو استورد قائمتك، ويفتح لك **سِيَر** بريدك أنت — أو
Gmail — والرسالة مكتوبة والعناوين جاهزة. تراجعها وترسلها بنفسك.

لا يوجد خادم إرسال، ولا تسجيل دخول، ولا كلمات مرور محفوظة، ولا شيء يُرسل نيابة
عنك. الرسالة تخرج من بريدك، وتُحفظ في «المرسَل» عندك، والردود تصلك مباشرة — وهذا
أيضًا السبيل الوحيد لأن تصل إلى صندوق الوارد لا إلى الرسائل المزعجة.

الدليل المدمج يحتوي فقط على عناوين **نشرتها الجهات بنفسها** لاستقبال طلبات
التوظيف، مع رابط المصدر وتاريخ التحقق، ويُضاف عبر طلبات دمج. ولأي جهة أن تطلب
حذف عنوانها نهائيًا — انظر [REMOVALS.md](packages/contacts/data/REMOVALS.md).

---

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

```bash
pnpm test         # rubric + Arabic normalization tests
pnpm typecheck
```

Requires Node ≥ 20.11 and pnpm 10.

## Layout

| Path | What it is | Licence |
| --- | --- | --- |
| `apps/web` | Next.js app (App Router, RTL-first, `ar` default) | AGPL-3.0 |
| `packages/ats-core` | Rubric engine + Arabic normalizer. Isomorphic, zero runtime deps. | MIT |
| `packages/parsers` | PDF/DOCX → layout-aware `DocumentModel` | AGPL-3.0 |
| `packages/contacts` | Directory, schema, validator, suppression list | AGPL-3.0 / data ODbL |

`ats-core` is MIT on purpose — the scoring engine is more useful the more places
it ends up. The app is AGPL so nobody can re-wrap it as the paid product it was
built to replace.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Rubric changes and directory entries have
their own rules, both documented there.
