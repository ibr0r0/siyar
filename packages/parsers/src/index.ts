import type { DocumentModel } from "@siyar/ats-core";
import { parseDocx } from "./docx";
import { parsePdf, type ParsePdfOptions } from "./pdf";

export { buildLines, toTextItems } from "./layout";
export type { BuildLinesResult, PageGeometry, RawTextItem } from "./layout";
export { htmlToLines, linesToDocument, parseDocx } from "./docx";
export { parsePdf } from "./pdf";
export type { ParsePdfOptions } from "./pdf";

/** 8 MB. Twice what the paid tools allow, and still far more than a CV needs. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export class UnsupportedFileError extends Error {
  constructor(readonly fileName: string) {
    super(`Unsupported file type: ${fileName}`);
    this.name = "UnsupportedFileError";
  }
}

export class FileTooLargeError extends Error {
  constructor(
    readonly byteLength: number,
    readonly limit: number,
  ) {
    super(`File is ${byteLength} bytes, over the ${limit} byte limit`);
    this.name = "FileTooLargeError";
  }
}

export type SupportedType = "pdf" | "docx";

/**
 * Identify the file from its magic bytes rather than its extension — a
 * mislabelled `.pdf` that is really a Word document should still work, and an
 * extension is not evidence of anything.
 */
export function detectFileType(
  bytes: Uint8Array,
  fileName: string,
): SupportedType | null {
  // "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  // "PK\x03\x04" — a zip, which is what a .docx is.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "docx";
  }
  // Fall back to the extension for anything the signature does not cover.
  if (/\.pdf$/i.test(fileName)) return "pdf";
  if (/\.docx$/i.test(fileName)) return "docx";
  return null;
}

export interface ParseOptions {
  fileName: string;
  workerSrc?: string;
  maxBytes?: number;
}

/** Parse an uploaded CV into the model the rubric engine consumes. */
export async function parseDocument(
  data: ArrayBuffer,
  options: ParseOptions,
): Promise<DocumentModel> {
  const limit = options.maxBytes ?? MAX_FILE_BYTES;
  if (data.byteLength > limit) {
    throw new FileTooLargeError(data.byteLength, limit);
  }

  const bytes = new Uint8Array(data);
  const type = detectFileType(bytes, options.fileName);

  switch (type) {
    case "pdf": {
      const pdfOptions: ParsePdfOptions = { fileName: options.fileName };
      if (options.workerSrc) pdfOptions.workerSrc = options.workerSrc;
      return parsePdf(bytes, pdfOptions);
    }
    case "docx":
      return parseDocx(data, { fileName: options.fileName });
    default:
      throw new UnsupportedFileError(options.fileName);
  }
}
