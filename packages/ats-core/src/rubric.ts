import rubricData from "../rubric/v1.json";
import { CONTACT_CHECKS } from "./checks/contact";
import { DATE_CHECKS } from "./checks/dates";
import { HYGIENE_CHECKS } from "./checks/hygiene";
import { IMPACT_CHECKS } from "./checks/impact";
import { KEYWORD_CHECKS } from "./checks/keywords";
import type { CheckFn } from "./checks/kinds";
import { READABILITY_CHECKS } from "./checks/readability";
import { STRUCTURE_CHECKS } from "./checks/structure";
import type { CheckDefinition, ScoreBand } from "./types";

/** Every check implementation, keyed by the id used in the rubric. */
export const CHECK_IMPLEMENTATIONS: Record<string, CheckFn> = {
  ...READABILITY_CHECKS,
  ...STRUCTURE_CHECKS,
  ...CONTACT_CHECKS,
  ...DATE_CHECKS,
  ...IMPACT_CHECKS,
  ...KEYWORD_CHECKS,
  ...HYGIENE_CHECKS,
};

export interface Rubric {
  version: string;
  note: string;
  bands: { good: number; fair: number };
  checks: CheckDefinition[];
}

export const rubric = rubricData as unknown as Rubric;

export function bandFor(score: number): ScoreBand {
  if (score >= rubric.bands.good) return "good";
  if (score >= rubric.bands.fair) return "fair";
  return "poor";
}

export function definitionFor(id: string): CheckDefinition | undefined {
  return rubric.checks.find((check) => check.id === id);
}
