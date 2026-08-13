import { extractDateRanges } from "../analysis/structure";
import { foldArabic } from "../text/arabic";
import type { Context } from "../types";
import { evidenceFromLine, pass, skip, warn, type CheckFn } from "./kinds";

/** Presentation details that cost nothing to fix and are noticed immediately. */

/** Rough years of experience, from the span the date ranges cover. */
function yearsOfExperience(context: Context): number | null {
  const ranges = extractDateRanges(context).filter(
    (range) => range.calendar === "gregorian",
  );
  if (ranges.length === 0) return null;

  const currentYear = ranges.reduce(
    (latest, range) => Math.max(latest, range.endYear ?? range.startYear),
    0,
  );
  const earliest = ranges.reduce(
    (oldest, range) => Math.min(oldest, range.startYear),
    Number.POSITIVE_INFINITY,
  );

  const span = currentYear - earliest;
  return Number.isFinite(span) && span >= 0 ? span : null;
}

/**
 * Page count against career length. Two pages is the safe ceiling for most
 * people; a long career earns a third. A five-page CV is not thorough, it is
 * unread.
 */
const length: CheckFn = (context) => {
  const pages = context.doc.pages.length;
  if (pages === 0) return skip();

  const years = yearsOfExperience(context);
  const allowed = years !== null && years >= 12 ? 3 : 2;

  if (pages <= allowed) return pass(undefined, { pages, allowed });
  return warn(Math.max(0, 1 - (pages - allowed) * 0.5), undefined, {
    pages,
    allowed,
    years: years ?? 0,
  });
};

/**
 * The file name is the first thing a recruiter sees in their downloads folder,
 * and some systems display it instead of the candidate's name.
 */
const filename: CheckFn = (context) => {
  const name = context.doc.source.fileName.replace(/\.(pdf|docx?)$/i, "");
  const folded = foldArabic(name);

  const generic =
    /^(document|untitled|new|final|resume|cv|my ?cv|my ?resume|سيره ذاتيه|سيرة ذاتية|مستند|بدون عنوان)[\s._-]*\d*$/i;
  const messy = /(v\d|final|copy|نسخة|الاخير|جديد|\(\d+\))/i;

  if (generic.test(folded.trim())) return warn(0, undefined, { fileName: name });
  if (messy.test(folded)) return warn(0.4, undefined, { fileName: name });
  return pass(undefined, { fileName: name });
};

/** Too short to say anything, or long enough that nothing will be read. */
const wordCount: CheckFn = (context) => {
  const words = context.doc.text.split(/\s+/).filter(Boolean).length;

  if (words < 150) return warn(0, undefined, { words });
  if (words < 250) return warn(0.5, undefined, { words });
  if (words > 1400) return warn(0.5, undefined, { words });
  return pass(undefined, { words });
};

/** Template scaffolding left in the document. */
const placeholders: CheckFn = (context) => {
  const markers = [
    "lorem ipsum",
    "your name here",
    "click to edit",
    "insert your",
    "xxxx",
    "اكتب هنا",
    "ادخل اسمك",
    "أدخل هنا",
    "نص تجريبي",
  ].map((marker) => foldArabic(marker));

  const offenders = context.foldedLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => markers.some((marker) => line.includes(marker)));

  if (offenders.length === 0) return pass();

  const evidence = offenders
    .slice(0, 3)
    .map(({ index }) => evidenceFromLine(context, index))
    .filter((item) => item !== undefined);

  return warn(0, evidence, { count: offenders.length });
};

export const HYGIENE_CHECKS: Record<string, CheckFn> = {
  "hygiene.length": length,
  "hygiene.filename": filename,
  "hygiene.word-count": wordCount,
  "hygiene.placeholders": placeholders,
};
