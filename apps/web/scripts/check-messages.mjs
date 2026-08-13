/**
 * Validate the message catalogues before they can reach a page.
 *
 * Two failure modes have already shipped from this directory, both invisible
 * until a component rendered the string:
 *
 *   - Malformed ICU. `{` opens an argument, so a literal `{{company}}` in an
 *     example is a broken argument, and `<sara@firm.com>` parses as a
 *     rich-text tag. next-intl then renders the key path instead of the text.
 *   - A key present in one locale and missing in the other, which fails only
 *     for whichever language nobody checked.
 *
 * Neither is caught by typecheck, tests, or `next build`. This is.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@formatjs/icu-messageformat-parser";

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const LOCALES = ["ar", "en"];

const problems = [];

/** Walk a catalogue, yielding every leaf string with its dotted key path. */
function* strings(node, path = []) {
  if (typeof node === "string") {
    yield [path.join("."), node];
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      yield* strings(value, [...path, key]);
    }
  }
}

const catalogues = new Map();
for (const locale of LOCALES) {
  catalogues.set(
    locale,
    JSON.parse(await readFile(join(messagesDir, `${locale}.json`), "utf8")),
  );
}

// 1. Every message must be parseable ICU.
for (const [locale, catalogue] of catalogues) {
  for (const [key, message] of strings(catalogue)) {
    try {
      parse(message);
    } catch (error) {
      problems.push(
        `${locale}: ${key} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

// 2. The locales must describe the same set of keys.
const keysByLocale = new Map(
  [...catalogues].map(([locale, catalogue]) => [
    locale,
    new Set([...strings(catalogue)].map(([key]) => key)),
  ]),
);

for (const locale of LOCALES) {
  for (const other of LOCALES) {
    if (locale === other) continue;
    for (const key of keysByLocale.get(locale) ?? []) {
      if (!keysByLocale.get(other)?.has(key)) {
        problems.push(`${other}: missing key present in ${locale} — ${key}`);
      }
    }
  }
}

const total = [...(keysByLocale.get(LOCALES[0]) ?? [])].length;

if (problems.length > 0) {
  console.error(`messages: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`messages OK — ${total} keys × ${LOCALES.length} locales`);
