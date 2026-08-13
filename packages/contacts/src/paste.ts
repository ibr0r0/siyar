import { isValidEmail } from "./csv";
import { normalizeEmail } from "./compose";

/**
 * Reading addresses out of whatever someone pastes.
 *
 * People do not paste clean lists. They paste a column copied out of a
 * spreadsheet, a signature block, a WhatsApp message, or a row of `Name
 * <addr@x.com>` pairs — separated by commas, semicolons, newlines, tabs, or
 * nothing but spaces. Splitting on a single separator gets one of those right
 * and mangles the rest.
 */

export interface PasteResult {
  emails: string[];
  /** Fragments that looked like an attempt at an address but were not valid. */
  invalid: string[];
  duplicates: number;
}

/** `Sara <sara@x.com>` and `"Sara" <sara@x.com>` both yield the address. */
const ANGLE_BRACKETS = /<([^>]+)>/g;

export function parseEmailList(input: string): PasteResult {
  const text = input.replace(ANGLE_BRACKETS, " $1 ");

  const tokens = text
    .split(/[\s,;،؛\n\r\t"'()[\]]+/)
    .map((token) => token.trim().replace(/^[.<:]+|[.>:,;]+$/g, ""))
    .filter((token) => token.length > 0);

  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const token of tokens) {
    if (!token.includes("@")) {
      // Stray words — names, labels, column headers — are not reported as
      // errors, only fragments that were clearly meant to be an address.
      continue;
    }
    if (!isValidEmail(token)) {
      invalid.push(token);
      continue;
    }
    const email = normalizeEmail(token);
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid, duplicates };
}
