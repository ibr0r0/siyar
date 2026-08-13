import { foldArabic, normalizeDigits } from "../text/arabic";
import { matchSectionHeading, type SectionKind } from "../lexicon/sections";
import { startsWithAction } from "../lexicon/verbs";
import type { Context, Line } from "../types";

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface Section {
  kind: SectionKind;
  /** Index into `doc.lines` of the heading itself. */
  headingIndex: number;
  /** Line indices of the section body, excluding the heading. */
  bodyIndices: number[];
}

/**
 * Split the document into sections at recognised headings.
 *
 * A section runs from its heading to the next recognised heading. Content
 * before the first heading (usually the name and contact block) is attributed
 * to a synthetic `contact` section only if no explicit contact heading exists —
 * plenty of good CVs put the email under the name with no heading at all, and
 * failing them for that would be wrong.
 */
export function detectSections(context: Context): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;

  context.foldedLines.forEach((folded, index) => {
    const kind = matchSectionHeading(folded);
    if (kind) {
      current = { kind, headingIndex: index, bodyIndices: [] };
      sections.push(current);
    } else if (current && folded.trim().length > 0) {
      current.bodyIndices.push(index);
    }
  });

  return sections;
}

export function findSection(
  sections: Section[],
  kind: SectionKind,
): Section | undefined {
  return sections.find((section) => section.kind === kind);
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

const BULLET_MARKER = /^[\s]*[•●▪‣◦·*\-–—]\s+/;
const NUMBERED_MARKER = /^[\s]*(?:\d{1,2}|[٠-٩]{1,2})[.)]\s+/;

export interface Bullet {
  line: Line;
  /** Bullet text with the marker removed. */
  text: string;
  folded: string;
}

export function isBulletLine(text: string): boolean {
  return BULLET_MARKER.test(text) || NUMBERED_MARKER.test(text);
}

export function extractBullets(context: Context): Bullet[] {
  const marked = context.doc.lines
    .filter((line) => isBulletLine(line.text))
    .map((line) => {
      const text = line.text
        .replace(BULLET_MARKER, "")
        .replace(NUMBERED_MARKER, "")
        .trim();
      return { line, text, folded: foldArabic(text) };
    })
    .filter((bullet) => bullet.text.length > 0);

  if (marked.length > 0) return marked;

  // Some PDF exporters — Chrome's print-to-PDF among them — draw list markers
  // as decoration and leave them out of the text layer entirely, so a CV full
  // of bullets extracts as a run of bare lines. Falling back to lines inside
  // the experience section that open with an action verb recovers them without
  // sweeping up the summary paragraph, which sits in a different section.
  const experience = findSection(detectSections(context), "experience");
  if (!experience) return [];

  return experience.bodyIndices
    .map((index) => {
      const line = context.doc.lines[index];
      const folded = context.foldedLines[index];
      if (!line || !folded) return undefined;
      if (!startsWithAction(folded)) return undefined;
      return { line, text: line.text.trim(), folded };
    })
    .filter((bullet) => bullet !== undefined);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const GREGORIAN_MONTHS = [
  ["jan", "january", "يناير", "كانون الثاني"],
  ["feb", "february", "فبراير", "شباط"],
  ["mar", "march", "مارس", "آذار", "اذار"],
  ["apr", "april", "أبريل", "ابريل", "نيسان"],
  ["may", "مايو", "أيار", "ايار"],
  ["jun", "june", "يونيو", "حزيران"],
  ["jul", "july", "يوليو", "تموز"],
  ["aug", "august", "أغسطس", "اغسطس", "آب", "اب"],
  ["sep", "sept", "september", "سبتمبر", "أيلول", "ايلول"],
  ["oct", "october", "أكتوبر", "اكتوبر", "تشرين الأول", "تشرين الاول"],
  ["nov", "november", "نوفمبر", "تشرين الثاني"],
  ["dec", "december", "ديسمبر", "كانون الأول", "كانون الاول"],
];

const MONTH_INDEX: ReadonlyMap<string, number> = (() => {
  const index = new Map<string, number>();
  GREGORIAN_MONTHS.forEach((names, monthNumber) => {
    for (const name of names) index.set(foldArabic(name), monthNumber + 1);
  });
  return index;
})();

const PRESENT_TOKENS = [
  "present", "current", "now", "to date", "till date", "ongoing",
  "الآن", "الان", "حتى الآن", "حتى الان", "حاليا", "حالياً", "الحالي",
  "مستمر", "لتاريخه",
].map((token) => foldArabic(token));

/** Gregorian CVs span roughly this range; anything outside is a typo. */
const GREGORIAN_RANGE = { min: 1950, max: 2100 } as const;
/** Hijri years in living memory. 1400 AH ≈ 1979 CE. */
const HIJRI_RANGE = { min: 1350, max: 1500 } as const;

export type Calendar = "gregorian" | "hijri";

export interface DateRange {
  startYear: number;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isPresent: boolean;
  calendar: Calendar;
  /** Whether both endpoints stated a month. Mixed precision is a consistency flag. */
  hasMonthPrecision: boolean;
  lineIndex: number;
  raw: string;
}

const SEPARATOR = /\s*(?:[-–—]|to|إلى|الى|حتى|:)\s*/i;

function classifyYear(year: number): Calendar | null {
  if (year >= GREGORIAN_RANGE.min && year <= GREGORIAN_RANGE.max)
    return "gregorian";
  if (year >= HIJRI_RANGE.min && year <= HIJRI_RANGE.max) return "hijri";
  return null;
}

interface Endpoint {
  year: number;
  month: number | null;
}

function parseEndpoint(raw: string): Endpoint | "present" | null {
  const folded = foldArabic(normalizeDigits(raw));
  if (folded.length === 0) return null;
  if (PRESENT_TOKENS.some((token) => folded.includes(token))) return "present";

  // Numeric forms: 03/2019, 2019-03, 2019.
  const numeric = folded.match(/(\d{1,4})\s*[/.]\s*(\d{1,4})/);
  if (numeric) {
    const left = Number(numeric[1]);
    const right = Number(numeric[2]);
    // Whichever side looks like a year is the year.
    if (classifyYear(right)) return { year: right, month: left <= 12 ? left : null };
    if (classifyYear(left)) return { year: left, month: right <= 12 ? right : null };
    return null;
  }

  const yearMatch = folded.match(/\b(\d{4})\b/);
  if (!yearMatch?.[1]) return null;
  const year = Number(yearMatch[1]);
  if (!classifyYear(year)) return null;

  let month: number | null = null;
  for (const [name, number] of MONTH_INDEX) {
    if (folded.includes(name)) {
      month = number;
      break;
    }
  }

  return { year, month };
}

/**
 * Pull employment/education date ranges out of the document.
 *
 * Only ranges are returned. A lone year is ambiguous — it could be a graduation
 * date, a certificate, or a reference number — so treating it as a role
 * duration would produce nonsense gap warnings.
 */
export function extractDateRanges(context: Context): DateRange[] {
  const ranges: DateRange[] = [];

  context.doc.lines.forEach((line, lineIndex) => {
    const normalized = normalizeDigits(line.text);
    // Look for "<something> <separator> <something>" containing at least one year.
    // The right-hand side allows two words so multi-word "present" markers —
    // "حتى الآن", "to date" — survive; a single-word pattern silently drops
    // every current role, which is the one date range that matters most.
    const candidate = normalized.match(
      /([A-Za-z؀-ۿ]*\s*\d{4}|\d{1,2}\s*[/.]\s*\d{4})\s*(?:[-–—]|to|إلى|الى|حتى)\s*([A-Za-z؀-ۿ]+(?:\s+[A-Za-z؀-ۿ]+)?\s*\d{0,4}|\d{1,2}\s*[/.]\s*\d{4}|\d{4})/i,
    );
    if (!candidate?.[1] || !candidate[2]) return;

    const start = parseEndpoint(candidate[1]);
    const end = parseEndpoint(candidate[2]);
    if (!start || start === "present" || !end) return;

    const calendar = classifyYear(start.year);
    if (!calendar) return;

    ranges.push({
      startYear: start.year,
      startMonth: start.month,
      endYear: end === "present" ? null : end.year,
      endMonth: end === "present" ? null : end.month,
      isPresent: end === "present",
      calendar,
      hasMonthPrecision:
        start.month !== null && (end === "present" || end.month !== null),
      lineIndex,
      raw: candidate[0].trim(),
    });
  });

  return ranges;
}

/** Ranges sorted newest-first, which is the order an ATS expects. */
export function isReverseChronological(ranges: DateRange[]): boolean {
  const starts = ranges.map((range) => range.startYear);
  for (let i = 1; i < starts.length; i++) {
    const previous = starts[i - 1];
    const current = starts[i];
    if (previous === undefined || current === undefined) continue;
    if (current > previous) return false;
  }
  return true;
}

export { SEPARATOR };
