import { foldArabic } from "../text/arabic";

/**
 * Openers that signal an achievement rather than a job description.
 *
 * English CVs are expected to open bullets with a past-tense action verb.
 * Arabic CVs conventionally use either a past-tense verb ("طوّرت") **or** a
 * verbal noun / masdar ("تطوير") — the masdar register is normal professional
 * Arabic, not a weakness, so both are accepted. Marking masdar down would be
 * the same category of mistake as penalising a CV for carrying a photo.
 */

const ENGLISH_VERBS = [
  "accelerated", "achieved", "acquired", "adapted", "administered", "advised",
  "analysed", "analyzed", "architected", "authored", "automated", "built",
  "championed", "collaborated", "consolidated", "constructed", "converted",
  "coordinated", "created", "cut", "delivered", "deployed", "designed",
  "developed", "devised", "diagnosed", "directed", "doubled", "drove",
  "eliminated", "engineered", "established", "evaluated", "executed",
  "expanded", "facilitated", "forecast", "founded", "generated", "grew",
  "guided", "halved", "handled", "headed", "implemented", "improved",
  "increased", "initiated", "instituted", "integrated", "introduced",
  "launched", "led", "maintained", "managed", "mentored", "migrated",
  "minimised", "minimized", "modernised", "modernized", "negotiated",
  "operated", "optimised", "optimized", "orchestrated", "organised",
  "organized", "overhauled", "oversaw", "owned", "partnered", "performed",
  "pioneered", "planned", "prepared", "presented", "prioritised",
  "prioritized", "produced", "programmed", "published", "recovered",
  "redesigned", "reduced", "refactored", "resolved", "restructured",
  "revamped", "reviewed", "saved", "scaled", "secured", "shipped",
  "simplified", "spearheaded", "standardised", "standardized", "streamlined",
  "strengthened", "supervised", "supported", "sustained", "tested", "trained",
  "transformed", "translated", "tripled", "unified", "upgraded", "validated",
];

/** Past-tense first-person verbs. */
const ARABIC_VERBS = [
  "قدت", "بنيت", "صممت", "طورت", "نفذت", "أدرت", "ادرت", "أطلقت", "اطلقت",
  "زدت", "خفضت", "حسنت", "أنشأت", "انشأت", "سلمت", "أسست", "اسست", "رفعت",
  "حققت", "وفرت", "دربت", "نسقت", "حللت", "عالجت", "أنجزت", "انجزت", "ساهمت",
  "أشرفت", "اشرفت", "راجعت", "وضعت", "طبقت", "اختصرت", "أتمتت", "اتمتت",
  "ربطت", "وسعت", "قللت", "ضاعفت", "أعددت", "اعددت", "نظمت", "خططت", "أنتجت",
  "انتجت", "نشرت", "دعمت", "اختبرت", "حدثت", "أعدت", "طورنا", "قمت", "توليت",
  "أنشأنا", "قدمت", "اكتسبت", "أضفت", "اضفت", "بادرت", "أعدت هيكلة",
];

/** Verbal nouns (masdar) — the standard register in Arabic CVs. */
const ARABIC_MASDAR = [
  "إدارة", "ادارة", "تطوير", "تصميم", "تنفيذ", "إشراف", "اشراف", "تحليل",
  "تنسيق", "إعداد", "اعداد", "متابعة", "تحسين", "بناء", "إطلاق", "اطلاق",
  "قيادة", "مراجعة", "تدريب", "تخطيط", "توثيق", "أتمتة", "اتمتة", "دعم",
  "اختبار", "تطبيق", "تشغيل", "صيانة", "تقييم", "تنظيم", "إنشاء", "انشاء",
  "توظيف", "تسويق", "مبيعات", "محاسبة", "برمجة", "هيكلة", "ترجمة", "تحديث",
];

/** Openers that describe duties rather than results. */
const WEAK_OPENERS = [
  "responsible for", "duties included", "tasked with", "worked on",
  "helped with", "assisted with", "involved in", "participated in",
  "in charge of", "my role was", "i was", "i am",
  "مسؤول عن", "مسؤولة عن", "من مهامي", "كنت مسؤولا عن", "المهام", "ضمن فريق",
  "العمل على", "المساعدة في", "المشاركة في", "كان دوري",
];

const foldAll = (words: string[]) => new Set(words.map((w) => foldArabic(w)));

export const ACTION_OPENERS: ReadonlySet<string> = foldAll([
  ...ENGLISH_VERBS,
  ...ARABIC_VERBS,
  ...ARABIC_MASDAR,
]);

export const WEAK_OPENER_PHRASES: readonly string[] = [
  ...new Set(WEAK_OPENERS.map((phrase) => foldArabic(phrase))),
];

/** Does this bullet open with an action verb or verbal noun? */
export function startsWithAction(foldedBullet: string): boolean {
  const firstWord = foldedBullet.trimStart().split(/\s+/, 1)[0];
  if (!firstWord) return false;
  return ACTION_OPENERS.has(firstWord);
}

/** Does this bullet open by describing a duty instead of an outcome? */
export function startsWithWeakPhrase(foldedBullet: string): string | undefined {
  const start = foldedBullet.trimStart();
  return WEAK_OPENER_PHRASES.find((phrase) => start.startsWith(phrase));
}

/**
 * Units that make a number an achievement rather than a date.
 *
 * Written in *folded* spelling — `foldArabic` has already mapped أ→ا and ة→ه —
 * so each stem is listed once. Matched as substrings with no trailing boundary,
 * which lets Arabic case and plural endings through: "مشروع" also catches
 * "مشروعا" and "مشاريع" is listed separately where the stem changes.
 *
 * Note that `\b` cannot be used around Arabic alternatives at all: JavaScript
 * defines a word character as `[A-Za-z0-9_]`, so there is never a word boundary
 * between a space and an Arabic letter, and any Arabic alternative wrapped in
 * `\b` silently never matches.
 */
const ARABIC_UNITS = [
  "ساعه", "ساعات", "يوم", "ايام", "اسبوع", "اسابيع", "شهر", "اشهر", "سنه",
  "سنوات", "عام", "اعوام", "دقيقه", "ثانيه", "ملي", "مستخدم", "عميل", "عملاء",
  "مشروع", "مشاريع", "موظف", "شخص", "افراد", "فرد", "متجر", "فرع", "طلب",
  "صفقه", "ريال", "دولار", "الف", "مليون", "مليار", "نقطه", "مره", "مرات",
  "ضعف", "اضعاف", "شركه", "جهه", "تقرير", "تقارير", "لوحه", "منتج", "خدمه",
  "مهندس", "محلل", "عضو", "طالب", "متدرب", "دوله", "مدينه", "حاله", "طن", "كم",
];

const LATIN_UNITS =
  "hours?|days?|weeks?|months?|years?|users?|customers?|clients?|projects?|employees?|people|staff|stores?|branches|orders?|deals?|reports?|dashboards?|records?|tickets?|leads?|accounts?|countries|cities";

const PERCENTAGE = /\d+\s*[%٪]|[%٪]\s*\d+/;
const CURRENCY =
  /[$€£]\s*\d|\d+\s*(?:sar|usd|eur|aed|k\b|m\b|bn\b|million|billion|thousand)/i;
const MULTIPLIER = /\d+\s*(?:x|×)/i;
const LATIN_QUANTITY = new RegExp(`\\d+\\s*(?:${LATIN_UNITS})\\b`, "i");
const ARABIC_QUANTITY = new RegExp(`\\d+\\s*(?:${ARABIC_UNITS.join("|")})`);

/**
 * Does the bullet quantify anything?
 *
 * A bare number is not enough — a year on its own is not an achievement — so we
 * require a number attached to a percentage, a currency, a multiplier, or a
 * unit noun.
 *
 * Expects text that has been through `foldArabic`, which also converts
 * Arabic-Indic digits to ASCII so "٣٥٪" counts the same as "35%".
 */
export function hasQuantifiedResult(foldedText: string): boolean {
  return (
    PERCENTAGE.test(foldedText) ||
    CURRENCY.test(foldedText) ||
    MULTIPLIER.test(foldedText) ||
    LATIN_QUANTITY.test(foldedText) ||
    ARABIC_QUANTITY.test(foldedText)
  );
}
