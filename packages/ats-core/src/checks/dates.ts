import {
  extractDateRanges,
  isReverseChronological,
  type DateRange,
} from "../analysis/structure";
import type { Context } from "../types";
import { evidenceFromLine, fail, pass, skip, warn, type CheckFn } from "./kinds";

/**
 * Employment dates. Parsers build a timeline from these; ambiguous or
 * inconsistent formats produce roles with no duration, which is how a decade of
 * experience becomes "0 years" in a recruiter's filter.
 */

function rangesOf(context: Context): DateRange[] {
  return extractDateRanges(context);
}

/** Are there any parseable date ranges at all? */
const present: CheckFn = (context) => {
  const ranges = rangesOf(context);
  if (ranges.length === 0) return fail();
  return pass(undefined, { count: ranges.length });
};

const reverseChronological: CheckFn = (context) => {
  const ranges = rangesOf(context);
  if (ranges.length < 2) return skip();
  return isReverseChronological(ranges) ? pass() : warn(0.3);
};

/**
 * Month precision should be all-or-nothing. "2019 – 2021" next to
 * "Mar 2021 – Present" leaves the parser guessing at a gap that may not exist.
 */
const consistentPrecision: CheckFn = (context) => {
  const ranges = rangesOf(context);
  if (ranges.length < 2) return skip();

  const withMonths = ranges.filter((range) => range.hasMonthPrecision).length;
  if (withMonths === 0 || withMonths === ranges.length) return pass();

  const offender = ranges.find((range) => !range.hasMonthPrecision);
  const evidence = offender
    ? [evidenceFromLine(context, offender.lineIndex)].filter(
        (item) => item !== undefined,
      )
    : undefined;

  return warn(0.4, evidence, {
    withMonths,
    total: ranges.length,
  });
};

/**
 * Mixing Hijri and Gregorian years. Both are legitimate, but a parser reading
 * "1443 – 1445" alongside "2019 – 2021" will place the roles four centuries
 * apart. Picking one calendar throughout is the fix.
 */
const calendarConsistency: CheckFn = (context) => {
  const ranges = rangesOf(context);
  if (ranges.length < 2) return skip();

  const calendars = new Set(ranges.map((range) => range.calendar));
  if (calendars.size === 1) return pass();

  const hijri = ranges.filter((range) => range.calendar === "hijri");
  const evidence = hijri
    .slice(0, 2)
    .map((range) => evidenceFromLine(context, range.lineIndex))
    .filter((item) => item !== undefined);

  return warn(0.2, evidence, { hijri: hijri.length, total: ranges.length });
};

/**
 * Unexplained gaps of a year or more between consecutive roles.
 *
 * Reported at low weight and phrased as something to account for rather than a
 * defect — career breaks are normal, and the point is that the CV should say so
 * rather than leave a recruiter to guess.
 */
const gaps: CheckFn = (context) => {
  const ranges = rangesOf(context)
    .filter((range) => range.calendar === "gregorian")
    .sort((a, b) => a.startYear - b.startYear);

  if (ranges.length < 2) return skip();

  const found: DateRange[] = [];
  for (let i = 1; i < ranges.length; i++) {
    const previous = ranges[i - 1];
    const current = ranges[i];
    if (!previous || !current) continue;
    const previousEnd = previous.isPresent
      ? current.startYear
      : (previous.endYear ?? previous.startYear);
    if (current.startYear - previousEnd >= 2) found.push(current);
  }

  if (found.length === 0) return pass();

  const evidence = found
    .slice(0, 2)
    .map((range) => evidenceFromLine(context, range.lineIndex))
    .filter((item) => item !== undefined);

  return warn(0.5, evidence, { count: found.length });
};

/** A current role should say so, rather than trailing off at a past year. */
const currentRole: CheckFn = (context) => {
  const ranges = rangesOf(context);
  if (ranges.length === 0) return skip();
  return ranges.some((range) => range.isPresent) ? pass() : warn(0.6);
};

export const DATE_CHECKS: Record<string, CheckFn> = {
  "dates.present": present,
  "dates.reverse-chronological": reverseChronological,
  "dates.consistent-precision": consistentPrecision,
  "dates.calendar-consistency": calendarConsistency,
  "dates.gaps": gaps,
  "dates.current-role": currentRole,
};
