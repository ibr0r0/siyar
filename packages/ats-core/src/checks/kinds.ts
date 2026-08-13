import type { CheckStatus, Context, Evidence } from "../types";

export interface CheckOutcome {
  status: CheckStatus;
  /**
   * Fraction of the check's weight earned, 0–1. Ignored when `status` is
   * `skipped`, in which case the check's weight leaves the denominator too.
   */
  ratio: number;
  evidence?: Evidence[];
  /** Interpolated into the translated message in the UI. */
  params?: Record<string, string | number>;
}

export type CheckFn = (context: Context) => CheckOutcome;

export const pass = (
  evidence?: Evidence[],
  params?: CheckOutcome["params"],
): CheckOutcome => ({ status: "pass", ratio: 1, evidence, params });

export const fail = (
  evidence?: Evidence[],
  params?: CheckOutcome["params"],
): CheckOutcome => ({ status: "fail", ratio: 0, evidence, params });

export const warn = (
  ratio: number,
  evidence?: Evidence[],
  params?: CheckOutcome["params"],
): CheckOutcome => ({ status: "warn", ratio, evidence, params });

export const skip = (params?: CheckOutcome["params"]): CheckOutcome => ({
  status: "skipped",
  ratio: 0,
  params,
});

/**
 * Grade a proportion against a target, giving partial credit rather than a
 * cliff edge. A CV with 7 of 10 bullets quantified is not the same as one with
 * none, and the report should say so.
 */
export function gradeRatio(
  achieved: number,
  target: number,
  evidence?: Evidence[],
  params?: CheckOutcome["params"],
): CheckOutcome {
  const ratio = target <= 0 ? 1 : Math.min(1, achieved / target);
  if (ratio >= 1) return pass(evidence, params);
  if (ratio <= 0) return fail(evidence, params);
  return warn(ratio, evidence, params);
}

export function evidenceFromLine(
  context: Context,
  lineIndex: number,
): Evidence | undefined {
  const line = context.doc.lines[lineIndex];
  if (!line) return undefined;
  return {
    text: line.text,
    lineIndex,
    pageIndex: line.pageIndex,
    bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
  };
}
