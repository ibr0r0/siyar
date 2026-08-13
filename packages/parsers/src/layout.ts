import {
  containsArabic,
  containsPresentationForms,
  repairArabic,
} from "@siyar/ats-core";
import type { Direction, Line, TextItem } from "@siyar/ats-core";

/**
 * Turning positioned glyph runs into lines of text.
 *
 * Kept free of any pdf.js import so it can be tested directly: the hard parts
 * here are the coordinate flip, the right-to-left ordering and the word-gap
 * heuristic, none of which need a real PDF to exercise.
 */

/** The shape pdf.js `getTextContent()` returns for a text item. */
export interface RawTextItem {
  str: string;
  /** [scaleX, skewY, skewX, scaleY, translateX, translateY] */
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
  /** pdf.js resolves this per run and it is the only reliable direction signal. */
  dir?: string;
}

export interface PageGeometry {
  width: number;
  height: number;
}

export interface BuildLinesResult {
  items: TextItem[];
  lines: Omit<Line, "index">[];
  /** True when any line arrived as shaped glyphs and had to be reordered. */
  repairedVisualOrder: boolean;
}

/**
 * PDF places the origin at the bottom-left and measures up; every other part of
 * this codebase measures down from the top-left, which is what the margin and
 * column checks assume. Convert once, here.
 */
function toTopLeftY(
  transform: number[],
  itemHeight: number,
  pageHeight: number,
): number {
  const baselineFromBottom = transform[5] ?? 0;
  return pageHeight - baselineFromBottom - itemHeight;
}

function fontSizeOf(item: RawTextItem): number {
  // The vertical scale component is the font size for unrotated text; fall back
  // to the reported height for rotated or skewed runs.
  const scaleY = Math.abs(item.transform[3] ?? 0);
  return scaleY > 0.01 ? scaleY : item.height;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (sorted.length % 2 === 1) return upper ?? 0;
  return ((lower ?? 0) + (upper ?? 0)) / 2;
}

/** Whitespace, punctuation and symbols — no direction of their own. */
const NEUTRAL_ONLY = /^[^\p{L}\p{N}]+$/u;

function directionOf(item: RawTextItem): Direction {
  if (NEUTRAL_ONLY.test(item.str)) return "neutral";
  if (item.dir === "rtl") return "rtl";
  if (item.dir === "ltr") return "ltr";
  // No signal from the extractor (DOCX, fixtures): fall back to the script.
  return containsArabic(item.str) ? "rtl" : "ltr";
}

export function toTextItems(
  raw: RawTextItem[],
  page: PageGeometry,
): TextItem[] {
  return raw
    .filter((item) => item.str.length > 0)
    .map((item) => {
      const fontSize = fontSizeOf(item);
      const height = item.height > 0 ? item.height : fontSize;
      return {
        text: repairArabic(item.str),
        raw: item.str,
        x: item.transform[4] ?? 0,
        y: toTopLeftY(item.transform, height, page.height),
        width: item.width,
        height,
        fontName: item.fontName ?? null,
        fontSize,
        dir: directionOf(item),
      } satisfies TextItem;
    });
}

/**
 * Group items sharing a baseline into a line.
 *
 * Tolerance scales with the text size rather than being a fixed number of
 * points, so a heading and a footnote are both grouped correctly.
 */
function groupIntoRows(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  const tolerance = Math.max(2, median(items.map((item) => item.height)) * 0.6);
  const rows: TextItem[][] = [];

  // Walk the items in the order the extractor produced them and drop each into
  // a matching row, rather than sorting by y first. Sorting would reorder
  // fragments *within* a line whenever their baselines differ by a fraction of
  // a point, which is exactly the order we need to preserve.
  for (const item of items) {
    const row = rows.find((candidate) => {
      const reference = candidate[0];
      return reference !== undefined && Math.abs(item.y - reference.y) <= tolerance;
    });
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows.sort((a, b) => (a[0]?.y ?? 0) - (b[0]?.y ?? 0));
}

/**
 * A row's overall direction. One right-to-left fragment is enough: a line
 * containing any Arabic reads right-to-left, however much Latin sits inside it.
 *
 * Note this must be decided from `dir`, not from "does the row contain Arabic
 * characters". A skills line reading "Java، Spring Boot، Kafka" is punctuated
 * with Arabic commas but is a left-to-right line; treating it as right-to-left
 * emits "Kafka، Boot Spring، Java".
 */
function rowDirection(row: TextItem[]): "rtl" | "ltr" {
  return row.some((item) => item.dir === "rtl") ? "rtl" : "ltr";
}

/**
 * Reorder one row from visual order into reading order.
 *
 * This is the Unicode bidi reordering rule applied at fragment granularity.
 * Items are first put in unambiguous visual order by horizontal position, then
 * grouped into maximal same-direction runs, then the run *sequence* is reversed
 * for a right-to-left line while each run's own internal order is set by its
 * own direction. That last part is what keeps "+966 551234567" and "Spring
 * Boot" intact inside an otherwise Arabic line — reversing the whole row would
 * turn them into "551234567 +966" and "Boot Spring".
 *
 * Neutral fragments (spaces, dashes, bullets) inherit the direction of the run
 * they follow, so a separator between two Arabic fragments travels with them.
 */
function toReadingOrder(row: TextItem[]): TextItem[] {
  const lineDir = rowDirection(row);
  const visual = [...row].sort((a, b) => a.x - b.x);

  // Resolve neutrals against their neighbours, falling back to the line.
  const resolved: Array<{ item: TextItem; dir: "ltr" | "rtl" }> = [];
  for (const [index, item] of visual.entries()) {
    let dir: "ltr" | "rtl";
    if (item.dir === "neutral") {
      const before = resolved.at(-1)?.dir;
      const after = visual.slice(index + 1).find((next) => next.dir !== "neutral")?.dir;
      dir = before && after && before === after ? before : lineDir;
    } else {
      dir = item.dir;
    }
    resolved.push({ item, dir });
  }

  // Group into maximal same-direction runs.
  const runs: Array<{ dir: "ltr" | "rtl"; items: TextItem[] }> = [];
  for (const { item, dir } of resolved) {
    const last = runs.at(-1);
    if (last && last.dir === dir) last.items.push(item);
    else runs.push({ dir, items: [item] });
  }

  const ordered = lineDir === "rtl" ? runs.reverse() : runs;
  return ordered.flatMap((run) =>
    run.dir === "rtl" ? [...run.items].reverse() : run.items,
  );
}

function joinRow(row: TextItem[]): string {
  let text = "";
  let previous: TextItem | undefined;

  for (const item of toReadingOrder(row)) {
    if (previous) {
      // Insert a space when the fragments sit further apart than a quarter of
      // the type size — producers routinely split words across items and rely
      // on positioning rather than emitting a space glyph. Measured as the
      // distance between the two boxes, whichever side each is on, so it works
      // in both directions.
      const gap = Math.max(
        item.x - (previous.x + previous.width),
        previous.x - (item.x + item.width),
      );
      const needsSpace = gap > previous.fontSize * 0.25;
      const alreadySpaced = /\s$/.test(text) || /^\s/.test(item.raw);
      if (needsSpace && !alreadySpaced) text += " ";
    }
    text += item.raw;
    previous = item;
  }

  return text;
}

/** A line is emphasised if it is notably larger than the document's body text. */
function isEmphasised(row: TextItem[], bodyFontSize: number): boolean {
  const size = Math.max(...row.map((item) => item.fontSize));
  if (size > bodyFontSize * 1.15) return true;
  const names = row.map((item) => item.fontName ?? "");
  return names.some((name) => /bold|black|heavy|semibold/i.test(name));
}

export function buildLines(
  raw: RawTextItem[],
  page: PageGeometry,
  pageIndex: number,
): BuildLinesResult {
  const items = toTextItems(raw, page);
  const rows = groupIntoRows(items);
  const bodyFontSize = median(items.map((item) => item.fontSize));

  let repairedVisualOrder = false;
  const lines: Omit<Line, "index">[] = [];

  for (const row of rows) {
    const joined = joinRow(row);
    if (containsPresentationForms(joined)) repairedVisualOrder = true;

    const text = repairArabic(joined).trim();
    if (text.length === 0) continue;

    const left = Math.min(...row.map((item) => item.x));
    const right = Math.max(...row.map((item) => item.x + item.width));
    const top = Math.min(...row.map((item) => item.y));
    const bottom = Math.max(...row.map((item) => item.y + item.height));

    lines.push({
      text,
      pageIndex,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      fontSize: median(row.map((item) => item.fontSize)),
      fontNames: [...new Set(row.map((item) => item.fontName ?? "unknown"))],
      emphasised: isEmphasised(row, bodyFontSize),
    });
  }

  return { items, lines, repairedVisualOrder };
}
