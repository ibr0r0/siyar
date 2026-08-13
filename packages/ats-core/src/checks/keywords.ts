import { extractKeyTerms, tokenize } from "../lexicon/stopwords";
import { foldArabic } from "../text/arabic";
import type { Context } from "../types";
import { gradeRatio, pass, skip, warn, type CheckFn } from "./kinds";

/**
 * Coverage against a target job description.
 *
 * Every check here skips when no job description was supplied — an unmatched CV
 * is not a bad CV, and scoring it as one would punish people for not pasting an
 * optional field.
 */

function targetTerms(context: Context): string[] | null {
  const description = context.options.targetJobDescription?.trim();
  if (!description || description.length < 80) return null;
  return extractKeyTerms(foldArabic(description));
}

/** Terms from the job description that appear nowhere in the CV. */
export function missingTerms(context: Context): {
  covered: string[];
  missing: string[];
} | null {
  const terms = targetTerms(context);
  if (!terms) return null;

  const covered: string[] = [];
  const missing: string[] = [];

  for (const term of terms) {
    if (context.folded.includes(term)) covered.push(term);
    else missing.push(term);
  }

  return { covered, missing };
}

const coverage: CheckFn = (context) => {
  const result = missingTerms(context);
  if (!result) return skip();

  const total = result.covered.length + result.missing.length;
  if (total === 0) return skip();

  // Two thirds is a realistic target; a CV matching every term reads as keyword
  // stuffing to the human who opens it next.
  return gradeRatio(result.covered.length / total, 0.65, undefined, {
    covered: result.covered.length,
    total,
    missing: result.missing.slice(0, 8).join("، "),
  });
};

/**
 * Does the CV state a job title close to the one being applied for? Titles are
 * matched more strictly than general keywords because parsers key on them.
 */
const titleMatch: CheckFn = (context) => {
  const description = context.options.targetJobDescription?.trim();
  if (!description) return skip();

  // The job title is nearly always in the first non-empty line of a posting.
  const firstLine = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return skip();

  const titleWords = tokenize(foldArabic(firstLine));
  if (titleWords.length === 0) return skip();

  const present = titleWords.filter((word) => context.folded.includes(word));
  const ratio = present.length / titleWords.length;

  if (ratio >= 0.6) return pass(undefined, { title: firstLine });
  return warn(ratio, undefined, { title: firstLine, matched: present.length, total: titleWords.length });
};

/**
 * Hard skills concentrated in one block. Some parsers only index the skills
 * section, so a technology mentioned solely inside a bullet can be missed.
 */
const skillsCoverage: CheckFn = (context) => {
  const result = missingTerms(context);
  if (!result || result.covered.length === 0) return skip();

  // Terms present somewhere, but not in the CV's own skills area.
  const skillsRegion = context.foldedLines
    .slice(
      context.foldedLines.findIndex((line) => line.includes("مهارات") || line.includes("skills")),
    )
    .slice(0, 12)
    .join(" ");

  if (skillsRegion.length === 0) return skip();

  const inSkills = result.covered.filter((term) => skillsRegion.includes(term));
  return gradeRatio(inSkills.length / result.covered.length, 0.4, undefined, {
    inSkills: inSkills.length,
    covered: result.covered.length,
  });
};

export const KEYWORD_CHECKS: Record<string, CheckFn> = {
  "keywords.coverage": coverage,
  "keywords.title-match": titleMatch,
  "keywords.skills-section-coverage": skillsCoverage,
};
