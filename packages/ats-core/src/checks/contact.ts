import { foldArabic, normalizeDigits } from "../text/arabic";
import type { Context, Evidence } from "../types";
import { fail, pass, skip, warn, type CheckFn } from "./kinds";

/**
 * Contact details. A CV that scores perfectly and has no reachable email is
 * worth nothing, so these carry real weight.
 */

const EMAIL =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Saudi mobile numbers in the forms people actually write them, plus a generic
 * international fallback so the check is not Saudi-only.
 */
const PHONE_PATTERNS = [
  /(?:\+|00)966[\s-]?5\d{8}\b/, // +966 5xxxxxxxx
  /\b05\d{8}\b/, // 05xxxxxxxx
  /(?:\+|00)\d{1,3}[\s-]?\d{6,12}\b/, // international
];

const LINKEDIN = /linkedin\.com\/(?:in|pub)\/[A-Za-z0-9؀-ۿ._%-]+/i;

/** Cities and regions that commonly appear as a CV location. */
const LOCATIONS = [
  "الرياض", "جدة", "مكة", "المدينة المنورة", "الدمام", "الخبر", "الظهران",
  "الأحساء", "الهفوف", "الطائف", "بريدة", "عنيزة", "تبوك", "حائل", "أبها",
  "خميس مشيط", "نجران", "جازان", "الجبيل", "ينبع", "القصيم", "الشرقية",
  "السعودية", "المملكة العربية السعودية", "دبي", "أبوظبي", "الدوحة", "الكويت",
  "المنامة", "مسقط", "عمان", "القاهرة",
  "riyadh", "jeddah", "jedda", "mecca", "makkah", "medina", "madinah",
  "dammam", "khobar", "dhahran", "hofuf", "taif", "buraidah", "tabuk", "hail",
  "abha", "jazan", "jubail", "yanbu", "saudi arabia", "ksa", "dubai",
  "abu dhabi", "doha", "kuwait", "manama", "muscat", "amman", "cairo",
].map((name) => foldArabic(name));

/** Handles that read as personal rather than professional. */
const INFORMAL_HANDLE =
  /(cute|sexy|babe|baby|cool|king|queen|prince|princess|lover|killer|gamer|ninja|hero|boy|girl|angel|devil|xoxo|hotguy|hotgirl)/i;

function evidenceFor(context: Context, needle: string): Evidence[] {
  const index = context.doc.lines.findIndex((line) =>
    line.text.includes(needle),
  );
  const line = context.doc.lines[index];
  if (!line) return [{ text: needle }];
  return [
    {
      text: line.text,
      lineIndex: index,
      pageIndex: line.pageIndex,
      bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
    },
  ];
}

function findEmails(context: Context): string[] {
  return [...new Set(context.doc.text.match(EMAIL) ?? [])];
}

const email: CheckFn = (context) => {
  const found = findEmails(context);
  const first = found[0];
  return first ? pass(evidenceFor(context, first), { email: first }) : fail();
};

const phone: CheckFn = (context) => {
  const text = normalizeDigits(context.doc.text);
  const match = PHONE_PATTERNS.map((pattern) => text.match(pattern)).find(
    (result) => result !== null,
  );
  return match?.[0]
    ? pass(evidenceFor(context, match[0]), { phone: match[0] })
    : fail();
};

const location: CheckFn = (context) => {
  const folded = context.folded;
  const found = LOCATIONS.find((name) => folded.includes(name));
  return found ? pass() : warn(0.3);
};

const linkedin: CheckFn = (context) => {
  const match = context.doc.text.match(LINKEDIN);
  return match?.[0] ? pass(evidenceFor(context, match[0])) : warn(0.2);
};

/**
 * Flag an email address that will read as unserious to a hiring manager. Only
 * the local part is examined, and only for explicit informality or a long digit
 * run — a name with a birth year in it is perfectly normal and is not flagged.
 */
const professionalEmail: CheckFn = (context) => {
  const found = findEmails(context);
  if (found.length === 0) return skip();

  const offender = found.find((address) => {
    const local = address.split("@")[0] ?? "";
    return INFORMAL_HANDLE.test(local) || /\d{5,}/.test(local);
  });

  return offender
    ? warn(0, evidenceFor(context, offender), { email: offender })
    : pass();
};

/**
 * Personal details common on Gulf CVs: photo, date of birth, marital status,
 * nationality, national ID or iqama number.
 *
 * Reported, never penalised. These fields are conventional here and often
 * expected by local employers, while they are a liability on a CV sent abroad
 * and the photo in particular can break parsing. The candidate is in a better
 * position than the rubric to judge which audience they are writing for — so
 * this check states what it found and costs nothing.
 */
const personalDetails: CheckFn = (context) => {
  const folded = context.folded;
  const found: string[] = [];

  const markers: Array<[string, string[]]> = [
    ["dateOfBirth", ["تاريخ الميلاد", "date of birth", "dob", "المواليد"]],
    ["maritalStatus", ["الحالة الاجتماعية", "marital status", "متزوج", "أعزب"]],
    ["nationality", ["الجنسية", "nationality"]],
    ["nationalId", ["رقم الهوية", "الهوية الوطنية", "رقم الإقامة", "iqama", "national id"]],
    ["gender", ["الجنس", "gender"]],
  ];

  for (const [key, phrases] of markers) {
    if (phrases.some((phrase) => folded.includes(foldArabic(phrase)))) {
      found.push(key);
    }
  }

  const firstPage = context.doc.pages[0];
  const hasPhoto = (firstPage?.imageCount ?? 0) > 0;
  if (hasPhoto) found.push("photo");

  return found.length === 0
    ? pass()
    : warn(1, undefined, { fields: found.join(","), count: found.length });
};

export const CONTACT_CHECKS: Record<string, CheckFn> = {
  "contact.email": email,
  "contact.phone": phone,
  "contact.location": location,
  "contact.linkedin": linkedin,
  "contact.professional-email": professionalEmail,
  "contact.personal-details": personalDetails,
};
