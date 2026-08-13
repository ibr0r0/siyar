import { countImpossibleSequences, hasCorruptedLigatures } from "../text/arabic";
import type { Context } from "../types";
import { evidenceFromLine, fail, gradeRatio, pass, skip, warn, type CheckFn } from "./kinds";

/**
 * Machine-readability: whether an applicant tracking system can extract the
 * document's text at all. Everything else is moot if these fail, which is why
 * they carry the only `critical` severities in the rubric.
 */

/** A file with no text layer is a picture of a CV. No ATS can read it. */
const textLayer: CheckFn = (context) =>
  context.doc.meta.hasTextLayer
    ? pass()
    : fail(undefined, { fileType: context.doc.source.fileType });

/**
 * Multi-column layouts are the most common silent failure: the CV looks fine to
 * a human, and the parser interleaves the two columns into nonsense.
 *
 * Detected by clustering text-item start positions per page. A single-column CV
 * has one dominant cluster; a two-column CV has two, each carrying a meaningful
 * share of the page's text.
 */
const singleColumn: CheckFn = (context) => {
  if (context.doc.source.fileType !== "pdf") return skip();

  let columnarPages = 0;

  for (const page of context.doc.pages) {
    const items = page.items.filter((item) => item.text.trim().length > 2);
    if (items.length < 12) continue;

    // Bucket item start edges into 5%-of-width bins.
    const binWidth = page.width / 20;
    const bins = new Map<number, number>();
    for (const item of items) {
      // In RTL text the "start" edge is the right edge of the box.
      const startEdge =
        context.language === "ar" ? item.x + item.width : item.x;
      const bin = Math.floor(startEdge / binWidth);
      bins.set(bin, (bins.get(bin) ?? 0) + 1);
    }

    const ranked = [...bins.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    if (!top) continue;

    // A genuine second column starts at a bin far from the first and holds at
    // least a fifth of the page's items.
    const second = ranked
      .slice(1)
      .find(([bin, count]) => Math.abs(bin - top[0]) >= 5 && count >= items.length * 0.2);

    if (second) columnarPages++;
  }

  return columnarPages === 0
    ? pass()
    : fail(undefined, { pages: columnarPages });
};

/**
 * Text placed in the page margins. Many parsers discard the header and footer
 * bands wholesale, so a phone number or email living there simply vanishes.
 */
const marginContent: CheckFn = (context) => {
  if (context.doc.source.fileType !== "pdf") return skip();

  const offenders: number[] = [];

  for (const line of context.doc.lines) {
    const page = context.doc.pages[line.pageIndex];
    if (!page || page.height === 0) continue;
    const margin = page.height * 0.06;
    const inMargin = line.y < margin || line.y + line.height > page.height - margin;
    if (inMargin && line.text.trim().length > 3) offenders.push(line.index);
  }

  if (offenders.length === 0) return pass();

  const evidence = offenders
    .slice(0, 3)
    .map((index) => evidenceFromLine(context, index))
    .filter((item) => item !== undefined);

  return warn(0.3, evidence, { count: offenders.length });
};

/**
 * Non-embedded fonts force the reader to substitute, which for Arabic often
 * means losing the character mapping entirely.
 */
const embeddedFonts: CheckFn = (context) => {
  if (context.doc.source.fileType !== "pdf") return skip();
  const missing = context.doc.meta.nonEmbeddedFonts;
  return missing.length === 0
    ? pass()
    : warn(0.4, undefined, { fonts: missing.slice(0, 3).join(", "), count: missing.length });
};

/**
 * The file stored Arabic as shaped glyphs in visual order. We repaired it, but
 * a plainer ATS will not, and will read the CV backwards.
 *
 * Informational: it costs no points, because it is a property of the exporting
 * tool rather than a mistake the candidate made — but they should know, since
 * re-exporting from a different tool fixes it.
 */
const arabicEncoding: CheckFn = (context) => {
  if (context.language === "en") return skip();
  return context.doc.meta.repairedVisualOrder ? warn(1) : pass();
};

/** A CV that is mostly pictures with a token amount of text. */
const textDensity: CheckFn = (context) => {
  const characters = context.doc.text.replace(/\s/g, "").length;
  const pages = Math.max(1, context.doc.pages.length);
  const perPage = characters / pages;

  // A sparse but real one-page CV sits around 900–1,500 characters per page.
  return gradeRatio(perPage, 600, undefined, {
    perPage: Math.round(perPage),
  });
};

/**
 * The Arabic text layer is corrupted by transposed ligatures.
 *
 * Unlike `arabic-encoding`, this one is not recoverable on our side and it
 * costs real points: the characters in the file are genuinely in the wrong
 * order, so every parser — ours included — reads "المملكة" as "اململكة". The
 * candidate's CV is silently full of misspelled words to any recruiter's
 * search, and they have no way of knowing, because it looks perfect on screen.
 */
const arabicLigatures: CheckFn = (context) => {
  if (context.language === "en") return skip();

  const occurrences = countImpossibleSequences(context.doc.text);
  if (!hasCorruptedLigatures(context.doc.text)) return pass();

  const offenders = context.doc.lines
    .filter((line) => countImpossibleSequences(line.text) > 0)
    .slice(0, 3)
    .map((line) => evidenceFromLine(context, line.index))
    .filter((item) => item !== undefined);

  return fail(offenders, {
    count: occurrences,
    producer: context.doc.meta.producer ?? "—",
  });
};

export const READABILITY_CHECKS: Record<string, CheckFn> = {
  "readability.text-layer": textLayer,
  "readability.single-column": singleColumn,
  "readability.margin-content": marginContent,
  "readability.embedded-fonts": embeddedFonts,
  "readability.arabic-encoding": arabicEncoding,
  "readability.arabic-ligatures": arabicLigatures,
  "readability.text-density": textDensity,
};
