import type { DocumentModel, Line, Page } from "@siyar/ats-core";
import { detectLanguage, repairArabic } from "@siyar/ats-core";

/**
 * DOCX parsing.
 *
 * Word documents carry no page geometry we can see without laying them out, so
 * the model gets synthetic coordinates and an estimated page count. The checks
 * that depend on real geometry — columns, margin content, embedded fonts —
 * detect `fileType === "docx"` and skip rather than guess.
 */

export interface ParseDocxOptions {
  fileName: string;
}

/** Roughly how many lines Word fits on a page at normal margins and 11pt. */
const LINES_PER_PAGE = 46;
const LINE_HEIGHT = 16;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;

/**
 * Convert mammoth's HTML to plain lines.
 *
 * A regex rather than a DOM walk on purpose: this package runs in the browser
 * and in Node test runs, and mammoth's output is a small, known set of block
 * tags rather than arbitrary markup.
 */
export function htmlToLines(html: string): string[] {
  const withMarkers = html
    // List items become bullet lines so the impact checks can see them.
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Table cells become space-separated rather than running together.
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(withMarkers)
    .split("\n")
    .map((line) => repairArabic(line).trim())
    .filter((line) => line.length > 0);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Build a `DocumentModel` from plain lines, with synthetic geometry. */
export function linesToDocument(
  textLines: string[],
  options: ParseDocxOptions & { byteLength: number; imageCount?: number },
): DocumentModel {
  const pageCount = Math.max(1, Math.ceil(textLines.length / LINES_PER_PAGE));

  const pages: Page[] = Array.from({ length: pageCount }, (_, index) => ({
    index,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    items: [],
    imageCount: index === 0 ? (options.imageCount ?? 0) : 0,
  }));

  const lines: Line[] = textLines.map((text, index) => {
    const pageIndex = Math.floor(index / LINES_PER_PAGE);
    const y = MARGIN + (index % LINES_PER_PAGE) * LINE_HEIGHT;
    const width = Math.min(PAGE_WIDTH - MARGIN * 2, text.length * 6);

    pages[pageIndex]?.items.push({
      text,
      raw: text,
      x: MARGIN,
      y,
      width,
      height: LINE_HEIGHT,
      fontName: null,
      fontSize: 11,
      dir: "neutral",
    });

    return {
      text,
      pageIndex,
      index,
      x: MARGIN,
      y,
      width,
      height: LINE_HEIGHT,
      fontSize: 11,
      fontNames: [],
      emphasised: false,
    };
  });

  const text = textLines.join("\n");

  return {
    source: {
      fileName: options.fileName,
      fileType: "docx",
      byteLength: options.byteLength,
    },
    meta: {
      producer: "docx",
      hasTextLayer: text.trim().length > 0,
      nonEmbeddedFonts: [],
      repairedVisualOrder: false,
    },
    pages,
    lines,
    text,
    language: detectLanguage(text),
  };
}

export async function parseDocx(
  data: ArrayBuffer,
  options: ParseDocxOptions,
): Promise<DocumentModel> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: data });
  const imageCount = (result.value.match(/<img\b/gi) ?? []).length;

  return linesToDocument(htmlToLines(result.value), {
    ...options,
    byteLength: data.byteLength,
    imageCount,
  });
}
