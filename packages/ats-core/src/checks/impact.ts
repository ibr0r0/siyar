import { extractBullets, type Bullet } from "../analysis/structure";
import {
  hasQuantifiedResult,
  startsWithAction,
  startsWithWeakPhrase,
} from "../lexicon/verbs";
import { foldArabic } from "../text/arabic";
import type { Context, Evidence } from "../types";
import { gradeRatio, pass, skip, warn, type CheckFn } from "./kinds";

/**
 * Writing quality of the experience bullets. None of this affects whether a
 * parser can read the CV — it affects whether the human who reads it next is
 * persuaded. Weighted below the parsing families for that reason.
 */

function bulletEvidence(bullets: Bullet[], limit = 3): Evidence[] {
  return bullets.slice(0, limit).map((bullet) => ({
    text: bullet.text,
    lineIndex: bullet.line.index,
    pageIndex: bullet.line.pageIndex,
    bbox: {
      x: bullet.line.x,
      y: bullet.line.y,
      width: bullet.line.width,
      height: bullet.line.height,
    },
  }));
}

/**
 * Every impact check needs bullets to look at. A CV written as prose paragraphs
 * is a style choice we do not grade, so these skip rather than fail.
 */
function withBullets(
  minimum: number,
  run: (bullets: Bullet[], context: Context) => ReturnType<CheckFn>,
): CheckFn {
  return (context) => {
    const bullets = extractBullets(context);
    if (bullets.length < minimum) return skip({ bullets: bullets.length });
    return run(bullets, context);
  };
}

const actionOpeners = withBullets(3, (bullets) => {
  const weak = bullets.filter((bullet) => !startsWithAction(bullet.folded));
  const strong = bullets.length - weak.length;
  return gradeRatio(strong / bullets.length, 0.7, bulletEvidence(weak), {
    strong,
    total: bullets.length,
  });
});

const quantified = withBullets(3, (bullets) => {
  const quantifiedBullets = bullets.filter((bullet) =>
    hasQuantifiedResult(bullet.folded),
  );
  const unquantified = bullets.filter(
    (bullet) => !hasQuantifiedResult(bullet.folded),
  );

  // Half the bullets carrying a number is a realistic target; demanding every
  // bullet be quantified pushes people into inventing metrics.
  return gradeRatio(
    quantifiedBullets.length / bullets.length,
    0.5,
    bulletEvidence(unquantified),
    { quantified: quantifiedBullets.length, total: bullets.length },
  );
});

const noDutyOpeners = withBullets(3, (bullets) => {
  const offenders = bullets.filter((bullet) =>
    startsWithWeakPhrase(bullet.folded),
  );
  if (offenders.length === 0) return pass();

  return gradeRatio(
    1 - offenders.length / bullets.length,
    1,
    bulletEvidence(offenders),
    { count: offenders.length, total: bullets.length },
  );
});

/**
 * Bullets that run past roughly two printed lines stop being scanned. Measured
 * in characters, with a higher allowance for Arabic, which needs more
 * characters than English to say the same thing.
 */
const bulletLength = withBullets(3, (bullets, context) => {
  // Arabic drops short vowels, so it says the same thing in fewer characters
  // than English — the allowance is lower, not higher.
  const limit = context.language === "en" ? 220 : 190;
  const overlong = bullets.filter((bullet) => bullet.text.length > limit);
  if (overlong.length === 0) return pass();

  return gradeRatio(
    1 - overlong.length / bullets.length,
    1,
    bulletEvidence(overlong),
    { count: overlong.length, total: bullets.length, limit },
  );
});

/**
 * First-person pronouns. Conventional CV register drops them in both languages.
 * Low weight — it is a polish issue, not a parsing one.
 *
 * Scans every content line rather than only the bullets: the summary paragraph
 * is where "I am a developer who loves programming" almost always lives, and a
 * bullets-only check would miss the single most common instance of the problem.
 */
const firstPerson: CheckFn = (context) => {
  const pronouns = new Set(
    ["i", "my", "me", "myself", "انا", "أنا", "لي", "عملي", "خاصتي", "نفسي"].map(
      (word) => foldArabic(word),
    ),
  );

  const contentLines = context.foldedLines
    .map((folded, index) => ({ folded, index }))
    .filter(({ folded }) => folded.split(/\s+/).filter(Boolean).length >= 4);

  if (contentLines.length < 4) return skip();

  const offenders = contentLines.filter(({ folded }) =>
    folded.split(/\s+/).some((word) => pronouns.has(word)),
  );

  if (offenders.length === 0) return pass();

  const evidence = offenders
    .slice(0, 3)
    .map(({ index }) => {
      const line = context.doc.lines[index];
      return line
        ? {
            text: line.text,
            lineIndex: index,
            pageIndex: line.pageIndex,
            bbox: {
              x: line.x,
              y: line.y,
              width: line.width,
              height: line.height,
            },
          }
        : undefined;
    })
    .filter((item) => item !== undefined);

  return warn(
    Math.max(0, 1 - offenders.length / contentLines.length),
    evidence,
    { count: offenders.length, total: contentLines.length },
  );
};

/** A CV with no bullet points at all is harder to scan and harder to parse. */
const usesBullets: CheckFn = (context) => {
  const bullets = extractBullets(context);
  if (bullets.length >= 5) return pass(undefined, { count: bullets.length });
  if (bullets.length > 0) return warn(0.5, undefined, { count: bullets.length });
  return warn(0, undefined, { count: 0 });
};

export const IMPACT_CHECKS: Record<string, CheckFn> = {
  "impact.uses-bullets": usesBullets,
  "impact.action-openers": actionOpeners,
  "impact.quantified": quantified,
  "impact.no-duty-openers": noDutyOpeners,
  "impact.bullet-length": bulletLength,
  "impact.first-person": firstPerson,
};
