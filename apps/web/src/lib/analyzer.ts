import { analyze, type AnalyzeOptions, type ScoreReport } from "@siyar/ats-core";
import {
  FileTooLargeError,
  MAX_FILE_BYTES,
  UnsupportedFileError,
  parseDocument,
} from "@siyar/parsers";

/**
 * Runs entirely in the browser. Nothing here touches the network, and the
 * `File` object is never sent anywhere — that promise is the whole reason the
 * parsing and scoring packages are isomorphic.
 */

/** Served from our own origin by `scripts/copy-pdf-worker.mjs`. */
const PDF_WORKER_SRC = "/pdf.worker.min.mjs";

export type AnalysisErrorCode = "unsupported" | "tooLarge" | "unreadable";

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "AnalysisError";
  }
}

export interface Analysis {
  report: ScoreReport;
  fileName: string;
  /** Repaired plain text, kept in memory so the report can quote it. */
  text: string;
  pageCount: number;
}

export async function analyzeFile(
  file: File,
  options: AnalyzeOptions = {},
): Promise<Analysis> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new AnalysisError("unreadable");
  }

  try {
    const doc = await parseDocument(buffer, {
      fileName: file.name,
      workerSrc: PDF_WORKER_SRC,
    });

    return {
      report: analyze(doc, options),
      fileName: doc.source.fileName,
      text: doc.text,
      pageCount: doc.pages.length,
    };
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      throw new AnalysisError("unsupported");
    }
    if (error instanceof FileTooLargeError) {
      throw new AnalysisError("tooLarge", {
        limitMb: Math.round(MAX_FILE_BYTES / (1024 * 1024)),
      });
    }
    throw new AnalysisError("unreadable");
  }
}

export { MAX_FILE_BYTES };
