/**
 * A small RFC 4180 CSV reader.
 *
 * Hand-written rather than pulled in as a dependency: the app is local-first
 * and every kilobyte ships to the browser, and the format people actually
 * export from Excel and Google Sheets needs exactly three behaviours — quoted
 * fields, doubled quotes inside them, and newlines inside quotes. A regex split
 * on commas silently mangles all three, which for a contact list means sending
 * mail to a mis-parsed address.
 */

export type Row = string[];

export function parseCsv(input: string): Row[] {
  // Strip a UTF-8 BOM, which Excel writes and which otherwise becomes part of
  // the first header name.
  const text = input.replace(/^﻿/, "");

  const rows: Row[] = [];
  let row: Row = [];
  let field = "";
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index]!;

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index++;
        continue;
      }
      field += char;
      index++;
      continue;
    }

    if (char === '"') {
      quoted = true;
      index++;
      continue;
    }
    if (char === "," || char === ";" || char === "\t") {
      endField();
      index++;
      continue;
    }
    if (char === "\r") {
      index++;
      continue;
    }
    if (char === "\n") {
      endRow();
      index++;
      continue;
    }

    field += char;
    index++;
  }

  // Trailing field, unless the file simply ended with a newline.
  if (field.length > 0 || row.length > 0) endRow();

  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

export interface Sheet {
  headers: string[];
  rows: Row[];
}

/** Split a parsed CSV into a header row and the rest. */
export function toSheet(rows: Row[]): Sheet {
  const [headers = [], ...rest] = rows;
  return { headers: headers.map((header) => header.trim()), rows: rest };
}

/** Column names people actually use, per field we care about. */
const COLUMN_HINTS: Record<string, string[]> = {
  email: ["email", "e-mail", "mail", "email address", "بريد", "الايميل", "الإيميل", "البريد"],
  org: ["company", "organisation", "organization", "employer", "org", "شركة", "الشركة", "جهة", "الجهة"],
  role: ["role", "title", "position", "job", "وظيفة", "الوظيفة", "المسمى"],
  name: ["name", "contact", "person", "اسم", "الاسم"],
  city: ["city", "location", "مدينة", "المدينة", "الموقع"],
};

/**
 * Guess which column holds which field, so the mapping UI opens with sensible
 * defaults instead of an empty form.
 */
export function guessMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
      if (mapping[field] !== undefined) continue;
      if (hints.some((hint) => normalized === hint || normalized.includes(hint))) {
        mapping[field] = index;
      }
    }
  });

  // A file with no usable header row still usually has the address in a column
  // somewhere; find the first that looks like one.
  if (mapping.email === undefined) {
    const guess = headers.findIndex((header) => header.includes("@"));
    if (guess >= 0) mapping.email = guess;
  }

  return mapping;
}

export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
