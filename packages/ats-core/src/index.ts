export { analyze, buildContext, notes, rankFixes } from "./analyze";
export { bandFor, definitionFor, rubric, CHECK_IMPLEMENTATIONS } from "./rubric";
export type { Rubric } from "./rubric";

export {
  arabicRatio,
  containsArabic,
  containsPresentationForms,
  countImpossibleSequences,
  detectLanguage,
  foldArabic,
  hasCorruptedLigatures,
  looksVisuallyOrdered,
  normalizeDigits,
  repairArabic,
  repairVisualOrder,
} from "./text/arabic";
export type { DocumentLanguage } from "./text/arabic";

export {
  detectSections,
  extractBullets,
  extractDateRanges,
  findSection,
  isBulletLine,
  isReverseChronological,
} from "./analysis/structure";
export type { Bullet, Calendar, DateRange, Section } from "./analysis/structure";

export { matchSectionHeading, SECTION_KINDS, headingsFor } from "./lexicon/sections";
export type { SectionKind } from "./lexicon/sections";

export { extractKeyTerms, tokenize, STOPWORDS } from "./lexicon/stopwords";
export { hasQuantifiedResult, startsWithAction, startsWithWeakPhrase } from "./lexicon/verbs";
export { missingTerms } from "./checks/keywords";

export { FAMILIES } from "./types";
export type {
  AnalyzeOptions,
  BoundingBox,
  Check,
  CheckDefinition,
  CheckResult,
  CheckStatus,
  Context,
  DocumentMeta,
  DocumentModel,
  DocumentSource,
  Direction,
  Evidence,
  FamilyId,
  FamilyScore,
  Line,
  Page,
  ScoreBand,
  ScoreReport,
  Severity,
  TextItem,
} from "./types";
