import type { DocumentLanguage } from "./text/arabic";

// ---------------------------------------------------------------------------
// Document model — what a parser must produce
// ---------------------------------------------------------------------------

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Resolved direction of a fragment. `neutral` is whitespace and punctuation,
 * which takes its direction from whatever surrounds it.
 */
export type Direction = "ltr" | "rtl" | "neutral";

/** A positioned fragment of text, as the PDF content stream emitted it. */
export interface TextItem extends BoundingBox {
  /** Repaired text (logical order, base characters). */
  text: string;
  /** Exactly what the extractor produced, kept for diagnostics. */
  raw: string;
  fontName: string | null;
  fontSize: number;
  /** Direction the extractor reported, where it reports one. */
  dir: Direction;
}

/** Fragments merged into a visual line, in reading order. */
export interface Line extends BoundingBox {
  text: string;
  pageIndex: number;
  /** Index within `DocumentModel.lines`. */
  index: number;
  fontSize: number;
  fontNames: string[];
  /** True when the line is bold, all-caps, or notably larger than body text. */
  emphasised: boolean;
}

export interface Page {
  index: number;
  width: number;
  height: number;
  items: TextItem[];
  /** Number of embedded raster images on the page. */
  imageCount: number;
}

export interface DocumentSource {
  fileName: string;
  fileType: "pdf" | "docx";
  byteLength: number;
}

export interface DocumentMeta {
  /** The tool that produced the file, when it says so. */
  producer: string | null;
  /** False when the file carries no extractable text at all — a scanned image. */
  hasTextLayer: boolean;
  /** Fonts referenced but not embedded. Non-embedded fonts break some parsers. */
  nonEmbeddedFonts: string[];
  /** True when the extractor had to repair visually-ordered Arabic. */
  repairedVisualOrder: boolean;
}

export interface DocumentModel {
  source: DocumentSource;
  meta: DocumentMeta;
  pages: Page[];
  lines: Line[];
  /** All lines joined with newlines. Repaired, logical order. */
  text: string;
  language: DocumentLanguage;
}

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

export const FAMILIES = [
  "readability",
  "structure",
  "contact",
  "dates",
  "impact",
  "keywords",
  "hygiene",
] as const;

export type FamilyId = (typeof FAMILIES)[number];

/**
 * `critical` findings mean an ATS cannot read the document at all, and are
 * always sorted above everything else regardless of points.
 */
export type Severity = "critical" | "major" | "minor" | "info";

export type CheckStatus =
  | "pass"
  | "fail"
  | "warn"
  /** Not applicable to this document — excluded from the denominator. */
  | "skipped";

export interface Evidence {
  /** Quoted text from the CV, already repaired and safe to display. */
  text: string;
  pageIndex?: number;
  lineIndex?: number;
  bbox?: BoundingBox;
}

/**
 * The outcome of one check.
 *
 * Deliberately carries no prose: `id` plus `params` are looked up in the UI's
 * message catalogue, so the engine stays dependency-free and every finding is
 * available in both Arabic and English without duplicating logic here.
 */
export interface CheckResult {
  id: string;
  family: FamilyId;
  status: CheckStatus;
  severity: Severity;
  /** Points this check can contribute. */
  weight: number;
  /** Points actually earned, between 0 and `weight`. */
  earned: number;
  evidence: Evidence[];
  /** Values interpolated into the translated message, e.g. `{ count: 3 }`. */
  params?: Record<string, string | number>;
}

export interface CheckDefinition {
  id: string;
  family: FamilyId;
  severity: Severity;
  weight: number;
  /** Which document languages the check applies to. */
  appliesTo: "all" | DocumentLanguage[];
  /**
   * Informational checks never cost points — they surface something worth
   * knowing (e.g. a photo on the CV) without asserting it is wrong.
   */
  informational?: boolean;
}

export type ScoreBand = "good" | "fair" | "poor";

export interface FamilyScore {
  family: FamilyId;
  earned: number;
  weight: number;
  /** 0–100 within this family, or null when every check was skipped. */
  percent: number | null;
}

export interface ScoreReport {
  rubricVersion: string;
  /** 0–100, weighted across all applicable checks. */
  overall: number;
  band: ScoreBand;
  language: DocumentLanguage;
  families: FamilyScore[];
  checks: CheckResult[];
  /** Failing and warning checks, ordered by how much fixing them would help. */
  fixes: CheckResult[];
}

export interface AnalyzeOptions {
  /**
   * A pasted job description. Enables the keyword-coverage family; without it
   * those checks are skipped rather than failed.
   */
  targetJobDescription?: string;
  /** Overrides the detected language. */
  language?: DocumentLanguage;
}

export interface Context {
  doc: DocumentModel;
  language: DocumentLanguage;
  options: AnalyzeOptions;
  /** `doc.text` folded for comparison. Computed once and shared by all checks. */
  folded: string;
  /** Each line's folded text, index-aligned with `doc.lines`. */
  foldedLines: string[];
}

export type Check = (context: Context) => Omit<
  CheckResult,
  "family" | "severity" | "weight" | "id"
> & { id?: string };
