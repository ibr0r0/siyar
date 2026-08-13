import { CHECK_IMPLEMENTATIONS, bandFor, rubric } from "./rubric";
import { detectLanguage, foldArabic } from "./text/arabic";
import {
  FAMILIES,
  type AnalyzeOptions,
  type CheckResult,
  type Context,
  type DocumentModel,
  type FamilyId,
  type FamilyScore,
  type ScoreReport,
  type Severity,
} from "./types";

/** Sort order for the fix list. Parsing failures always come first. */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
};

export function buildContext(
  doc: DocumentModel,
  options: AnalyzeOptions = {},
): Context {
  return {
    doc,
    language: options.language ?? doc.language ?? detectLanguage(doc.text),
    options,
    folded: foldArabic(doc.text),
    foldedLines: doc.lines.map((line) => foldArabic(line.text)),
  };
}

function applies(
  definition: (typeof rubric.checks)[number],
  language: Context["language"],
): boolean {
  return (
    definition.appliesTo === "all" || definition.appliesTo.includes(language)
  );
}

/**
 * Run the rubric over a parsed document.
 *
 * Scoring rule: `overall` is earned points over *applicable* points. A check
 * that skips — because it needs a job description that was not supplied, or
 * bullets in a CV written as prose — leaves the denominator entirely. It is
 * never silently counted as a failure, which is what makes a score comparable
 * between a CV analysed with a target job and the same CV analysed without one.
 */
export function analyze(
  doc: DocumentModel,
  options: AnalyzeOptions = {},
): ScoreReport {
  const context = buildContext(doc, options);
  const checks: CheckResult[] = [];

  for (const definition of rubric.checks) {
    const implementation = CHECK_IMPLEMENTATIONS[definition.id];
    if (!implementation) {
      throw new Error(`Rubric declares "${definition.id}" with no implementation`);
    }

    if (!applies(definition, context.language)) {
      checks.push({
        id: definition.id,
        family: definition.family,
        status: "skipped",
        severity: definition.severity,
        weight: definition.weight,
        earned: 0,
        evidence: [],
      });
      continue;
    }

    const outcome = implementation(context);
    const ratio = Math.min(1, Math.max(0, outcome.ratio));

    checks.push({
      id: definition.id,
      family: definition.family,
      status: outcome.status,
      severity: definition.severity,
      weight: definition.weight,
      earned: outcome.status === "skipped" ? 0 : definition.weight * ratio,
      evidence: outcome.evidence ?? [],
      ...(outcome.params ? { params: outcome.params } : {}),
    });
  }

  const families = FAMILIES.map<FamilyScore>((family) => {
    const applicable = checks.filter(
      (check) => check.family === family && check.status !== "skipped",
    );
    const weight = applicable.reduce((total, check) => total + check.weight, 0);
    const earned = applicable.reduce((total, check) => total + check.earned, 0);
    return {
      family,
      earned,
      weight,
      percent: weight === 0 ? null : round((earned / weight) * 100),
    };
  });

  const totalWeight = families.reduce((total, family) => total + family.weight, 0);
  const totalEarned = families.reduce((total, family) => total + family.earned, 0);
  const overall = totalWeight === 0 ? 0 : round((totalEarned / totalWeight) * 100);

  return {
    rubricVersion: rubric.version,
    overall,
    band: bandFor(overall),
    language: context.language,
    families,
    checks,
    fixes: rankFixes(checks),
  };
}

/**
 * Order the fix list by how much it helps to act on each item.
 *
 * Severity dominates: a CV an ATS cannot read at all needs that fixed before
 * anything else, however few points it nominally carries. Within a severity,
 * the points still on the table decide the order.
 */
export function rankFixes(checks: CheckResult[]): CheckResult[] {
  return checks
    .filter((check) => check.status === "fail" || check.status === "warn")
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.weight - b.earned - (a.weight - a.earned);
    });
}

/** Findings that carry no points — reported so the candidate can decide. */
export function notes(report: ScoreReport): CheckResult[] {
  return report.checks.filter(
    (check) =>
      check.weight === 0 &&
      check.status !== "pass" &&
      check.status !== "skipped",
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
