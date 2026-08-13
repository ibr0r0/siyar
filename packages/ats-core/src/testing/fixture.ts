import { detectLanguage } from "../text/arabic";
import type { DocumentMeta, DocumentModel, Line, Page, TextItem } from "../types";

export interface FixtureOptions {
  fileName?: string;
  fileType?: "pdf" | "docx";
  /** Lines per synthetic page. */
  linesPerPage?: number;
  meta?: Partial<DocumentMeta>;
  /** Images on the first page, used to simulate a CV carrying a photo. */
  imageCount?: number;
}

const PAGE_WIDTH = 595; // A4 at 72dpi
const PAGE_HEIGHT = 842;
const LINE_HEIGHT = 14;

/**
 * Build a `DocumentModel` from plain text, laid out as a plausible single
 * column. Used by the rubric tests and by the demo in the web app, so that
 * neither needs a binary fixture checked into the repo.
 */
export function buildFixtureDocument(
  text: string,
  options: FixtureOptions = {},
): DocumentModel {
  const {
    fileName = "ahmed-alqahtani-cv.pdf",
    fileType = "pdf",
    linesPerPage = 50,
    imageCount = 0,
  } = options;

  const rawLines = text.split("\n").map((line) => line.trim());
  const pageCount = Math.max(1, Math.ceil(rawLines.length / linesPerPage));

  const pages: Page[] = Array.from({ length: pageCount }, (_, index) => ({
    index,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    items: [],
    imageCount: index === 0 ? imageCount : 0,
  }));

  const lines: Line[] = rawLines.map((content, index) => {
    const pageIndex = Math.floor(index / linesPerPage);
    const rowOnPage = index % linesPerPage;
    // Leave a 60pt top margin so nothing lands in the header band by accident.
    const y = 60 + rowOnPage * LINE_HEIGHT;
    const width = Math.min(PAGE_WIDTH - 120, content.length * 6);

    const item: TextItem = {
      text: content,
      raw: content,
      x: 60,
      y,
      width,
      height: LINE_HEIGHT,
      fontName: "IBMPlexSansArabic",
      fontSize: 11,
      dir: "neutral",
    };
    pages[pageIndex]?.items.push(item);

    return {
      text: content,
      pageIndex,
      index,
      x: 60,
      y,
      width,
      height: LINE_HEIGHT,
      fontSize: 11,
      fontNames: ["IBMPlexSansArabic"],
      emphasised: false,
    };
  });

  const joined = lines.map((line) => line.text).join("\n");

  return {
    source: { fileName, fileType, byteLength: joined.length },
    meta: {
      producer: "fixture",
      hasTextLayer: joined.trim().length > 0,
      nonEmbeddedFonts: [],
      repairedVisualOrder: false,
      ...options.meta,
    },
    pages,
    lines,
    text: joined,
    language: detectLanguage(joined),
  };
}
