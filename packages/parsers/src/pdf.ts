import type { DocumentModel, Line, Page } from "@siyar/ats-core";
import { detectLanguage } from "@siyar/ats-core";
import { buildLines, type RawTextItem } from "./layout";

/**
 * pdf.js glue. Deliberately thin — everything that can be reasoned about
 * without a real PDF lives in `layout.ts` and is unit-tested there.
 */

/** The slice of the pdf.js module surface this parser uses. */
export interface PdfjsModule {
  getDocument: (params: { data: Uint8Array; disableAutoFetch?: boolean }) => {
    promise: Promise<PdfDocument>;
  };
  GlobalWorkerOptions: { workerSrc: string };
  OPS: Record<string, number>;
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  getMetadata: () => Promise<{ info?: unknown }>;
  destroy: () => Promise<void>;
}

interface PdfPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[]; styles?: unknown }>;
  getOperatorList: () => Promise<OperatorList>;
  cleanup: () => void;
}

export interface ParsePdfOptions {
  fileName: string;
  /**
   * URL of the pdf.js worker script. Required in the browser; the caller owns
   * this because the URL depends on how the app bundles its assets.
   */
  workerSrc?: string;
  /** Give up after this many pages. Guards against a pathological upload. */
  maxPages?: number;
  /**
   * The pdf.js module to use. Defaults to the browser build, which is what the
   * app wants. Node callers must pass the legacy build —
   * `await import("pdfjs-dist/legacy/build/pdf.mjs")` — because the default
   * build reaches for `DOMMatrix` and other browser globals at module scope.
   */
  pdfjs?: PdfjsModule;
}

/** Fonts from the PDF standard 14, which are never embedded in the file. */
const STANDARD_14 =
  /^(Helvetica|Courier|Times|Symbol|ZapfDingbats|Arial|TimesNewRoman)/i;

interface TextStyle {
  fontFamily?: string;
}

function isTextItem(item: unknown): item is RawTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

export async function parsePdf(
  data: ArrayBuffer | Uint8Array,
  options: ParsePdfOptions,
): Promise<DocumentModel> {
  const pdfjs =
    options.pdfjs ?? ((await import("pdfjs-dist")) as unknown as PdfjsModule);

  if (options.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc;
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const document = await pdfjs.getDocument({
    data: bytes,
    // A CV has no business reaching out to the network mid-parse.
    disableAutoFetch: true,
  }).promise;

  const pageCount = Math.min(document.numPages, options.maxPages ?? 15);
  const pages: Page[] = [];
  const lines: Line[] = [];
  const nonEmbeddedFonts = new Set<string>();
  let repairedVisualOrder = false;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const geometry = { width: viewport.width, height: viewport.height };

    const content = await page.getTextContent();
    // `items` mixes text runs with marked-content markers; `isTextItem` picks
    // out the runs by shape rather than by trusting the declared union.
    const raw = (content.items as unknown[]).filter(isTextItem);

    const styles = content.styles as Record<string, TextStyle> | undefined;
    for (const style of Object.values(styles ?? {})) {
      const family = style.fontFamily ?? "";
      if (STANDARD_14.test(family.replace(/\s/g, ""))) {
        nonEmbeddedFonts.add(family);
      }
    }

    const built = buildLines(raw, geometry, pageNumber - 1);
    if (built.repairedVisualOrder) repairedVisualOrder = true;

    for (const line of built.lines) {
      lines.push({ ...line, index: lines.length });
    }

    pages.push({
      index: pageNumber - 1,
      width: geometry.width,
      height: geometry.height,
      items: built.items,
      imageCount: await countImages(page, pdfjs.OPS),
    });

    page.cleanup();
  }

  const metadata = await document.getMetadata().catch(() => null);
  const info = metadata?.info as { Producer?: string; Creator?: string } | undefined;
  const text = lines.map((line) => line.text).join("\n");

  await document.destroy();

  return {
    source: {
      fileName: options.fileName,
      fileType: "pdf",
      byteLength: bytes.byteLength,
    },
    meta: {
      producer: info?.Producer ?? info?.Creator ?? null,
      hasTextLayer: text.trim().length > 0,
      nonEmbeddedFonts: [...nonEmbeddedFonts],
      repairedVisualOrder,
    },
    pages,
    lines,
    text,
    language: detectLanguage(text),
  };
}

interface OperatorList {
  fnArray: number[];
}

/**
 * Count raster images on a page — used to spot a CV that is a photograph of a
 * document, and to notice a portrait photo in the header.
 */
async function countImages(
  page: { getOperatorList: () => Promise<OperatorList> },
  ops: Record<string, number>,
): Promise<number> {
  try {
    const operators = await page.getOperatorList();
    const imageOps = new Set(
      [
        ops.paintImageXObject,
        ops.paintJpegXObject,
        ops.paintInlineImageXObject,
        ops.paintImageMaskXObject,
      ].filter((op): op is number => typeof op === "number"),
    );
    return operators.fnArray.filter((fn) => imageOps.has(fn)).length;
  } catch {
    // Image counting is a nice-to-have; never fail an analysis over it.
    return 0;
  }
}
