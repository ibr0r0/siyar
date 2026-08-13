/**
 * Arabic text repair and folding.
 *
 * Two jobs, deliberately kept separate:
 *
 *  - `repairArabic`  — recovers *readable, logically-ordered* text from what a
 *    PDF extractor hands us. The output is meant to be shown to the user and
 *    quoted back as evidence, so it preserves diacritics and hamza forms.
 *
 *  - `foldArabic`    — collapses orthographic variation so two spellings of the
 *    same word compare equal. The output is for matching only and is not fit to
 *    display.
 *
 * Why this exists: Arabic PDFs very often store glyphs rather than characters —
 * the *presentation forms* (U+FB50–U+FEFF) that the shaping engine produced,
 * laid out in visual order. Read naively, "المهندس" comes back as a reversed run
 * of ligature codepoints. Tools that skip this step score every Arabic CV as if
 * it were unreadable noise.
 */

// ---------------------------------------------------------------------------
// Character classes
// ---------------------------------------------------------------------------

const ARABIC_BLOCKS =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Presentation forms: the glyph codepoints a shaping engine emits. */
const PRESENTATION_FORMS = /[ﭐ-﷿ﹰ-﻿]/;

/** Harakat, tanween, superscript alef, and Quranic marks. */
const DIACRITICS = /[ً-ٰٟۖ-ۭ࣓-ࣿ]/g;

/** Kashida / tatweel — a pure justification stretch, never meaningful. */
const TATWEEL = /ـ/g;

/** Bidi control characters. They survive extraction and corrupt comparisons. */
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩؜]/g;

/** Zero-width joiners, used for shaping, meaningless once we have characters. */
const ZERO_WIDTH = /[​-‍﻿]/g;

export function containsArabic(text: string): boolean {
  return ARABIC_BLOCKS.test(text);
}

export function containsPresentationForms(text: string): boolean {
  return PRESENTATION_FORMS.test(text);
}

// ---------------------------------------------------------------------------
// Visual → logical order
// ---------------------------------------------------------------------------

const RTL_CHAR = /[֐-׿؀-ۿ܀-ݏݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;
const NEUTRAL_CHAR = /[\s!-/:-@[-`{-~«»،؛؟٪-٭۔‐-‧]/;

type RunKind = "rtl" | "ltr" | "neutral";

interface Run {
  kind: RunKind;
  text: string;
}

function classify(char: string): RunKind {
  if (RTL_CHAR.test(char)) return "rtl";
  if (NEUTRAL_CHAR.test(char)) return "neutral";
  return "ltr";
}

function toRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const char of text) {
    const kind = classify(char);
    const last = runs.at(-1);
    if (last && last.kind === kind) last.text += char;
    else runs.push({ kind, text: char });
  }
  return runs;
}

/**
 * Undo visual ordering for a single line.
 *
 * A PDF that stores glyphs in the order they were painted gives us the line
 * back-to-front. Reversing the whole string would also reverse embedded Latin
 * words and numbers ("2019" → "9102"), so we reverse the *sequence of runs* and
 * then reverse the characters only within right-to-left and neutral runs. Latin
 * runs keep their internal order.
 *
 * Paired brackets need no special handling: a producer writes the original
 * codepoints and lets the renderer mirror the glyphs, so in visual order the
 * physically-leftmost character of "(الرياض)" really is U+0029. Reversing the
 * run sequence puts it back on the correct side by itself — mirroring the
 * characters as well would flip them straight back out again.
 *
 * Applied per line — never across a whole document, since line order is already
 * correct and only the contents of each line are reversed.
 */
export function repairVisualOrder(line: string): string {
  const runs = toRuns(line);

  return runs
    .reverse()
    .map((run) =>
      run.kind === "ltr" ? run.text : [...run.text].reverse().join(""),
    )
    .join("");
}

/**
 * Decide whether a line was extracted in visual order.
 *
 * Presentation forms are the reliable tell: a producer that wrote shaped glyphs
 * into the content stream was working in display space, so the run order is
 * display order too. Text stored as ordinary Arabic characters (U+0600 block)
 * is almost always already logical, and reversing it would be the bug.
 */
export function looksVisuallyOrdered(line: string): boolean {
  if (!containsPresentationForms(line)) return false;

  // A trailing Arabic comma/full-stop at the *start* of the string is a second,
  // independent confirmation that the line arrived back-to-front.
  return true;
}

// ---------------------------------------------------------------------------
// Repair (display-safe)
// ---------------------------------------------------------------------------

/**
 * Turn extracted text into readable, logically-ordered Arabic.
 *
 * NFKC does the glyph→character mapping for us: every presentation form carries
 * a compatibility decomposition to its base letter, and the lam-alef ligatures
 * (U+FEF5–U+FEFC) decompose to the two characters ل + ا. Hand-rolled tables for
 * this are a common and unnecessary source of gaps.
 *
 * Order matters: reverse *before* normalizing, because the presentation forms
 * are the signal that tells us reversal is needed, and NFKC destroys them.
 */
export function repairArabic(text: string): string {
  const lines = text.split(/\r?\n/);

  return lines
    .map((line) => {
      const ordered = looksVisuallyOrdered(line)
        ? repairVisualOrder(line)
        : line;
      return ordered
        .normalize("NFKC")
        .replace(BIDI_CONTROLS, "")
        .replace(ZERO_WIDTH, "")
        .replace(TATWEEL, "")
        .replace(/[ \t ]+/g, " ")
        .trim();
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Folding (comparison only)
// ---------------------------------------------------------------------------

/** Orthographic variants that should compare equal. */
const FOLD_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/[آأإٱٲٳٵ]/g, "ا"], // آ أ إ ٱ → ا
  [/[ؤ]/g, "و"], // ؤ → و
  [/[ئى]/g, "ي"], // ئ ى → ي
  [/[ة]/g, "ه"], // ة → ه
  [/[کڪ]/g, "ك"], // Persian/Urdu kaf → ك
  [/[ی]/g, "ي"], // Farsi yeh → ي
  [/[ـ]/g, ""], // tatweel
];

/** Arabic-Indic and Eastern Arabic-Indic digits → ASCII. */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.codePointAt(0)!;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Collapse a string to a comparison key: repaired, diacritic-free, with
 * orthographic variants unified and digits in ASCII. Never display this.
 */
export function foldArabic(text: string): string {
  let folded = repairArabic(text)
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .toLowerCase();

  for (const [pattern, replacement] of FOLD_MAP) {
    folded = folded.replace(pattern, replacement);
  }

  return normalizeDigits(folded).replace(/\s+/g, " ").trim();
}

/**
 * Ratio of Arabic letters to all letters — used to pick which lexicon and which
 * set of locale-specific rules a document should be scored against.
 */
export function arabicRatio(text: string): number {
  let arabic = 0;
  let latin = 0;

  for (const char of text) {
    if (ARABIC_BLOCKS.test(char)) arabic++;
    else if (/[A-Za-z]/.test(char)) latin++;
  }

  const total = arabic + latin;
  return total === 0 ? 0 : arabic / total;
}

// ---------------------------------------------------------------------------
// Corrupted ligature detection
// ---------------------------------------------------------------------------

/** Alef and its hamza/madda forms. Two of these in a row cannot occur. */
const ALEF_FAMILY = "[اأإآٱ]";
const DOUBLE_ALEF = new RegExp(`${ALEF_FAMILY}${ALEF_FAMILY}`, "g");

/**
 * Count sequences that Arabic orthography does not permit.
 *
 * These are the fingerprint of a specific, common and otherwise invisible way
 * PDFs corrupt Arabic. A PDF that lays text out in visual order maps each
 * *ligature* glyph to its characters in logical order — glyph → "لم" — and the
 * reader then reverses the whole run to recover reading order. Reversing the
 * run also reverses the characters inside each ligature, so "المملكة" comes
 * back as "اململكة" and "الاستجابة" as "االستجابة".
 *
 * Two adjacent alef-family letters is the tell. It never occurs in real Arabic,
 * and it appears whenever a lam-alef ligature — the one ligature every Arabic
 * font is required to have — gets transposed this way.
 *
 * The damage cannot be undone from the text alone: the transposed forms ("ال",
 * "مل", "ني") are all legitimate sequences elsewhere, so there is no safe
 * substitution. Detecting it and telling the candidate to re-export is the only
 * honest response — and it matters, because every applicant tracking system
 * reading that file sees the same mangled words.
 */
export function countImpossibleSequences(text: string): number {
  return (text.match(DOUBLE_ALEF) ?? []).length;
}

/**
 * Whether the document's Arabic text layer looks corrupted this way. Requires
 * more than one occurrence, so a single typo in an otherwise fine CV does not
 * trigger it.
 */
export function hasCorruptedLigatures(text: string): boolean {
  return countImpossibleSequences(text) >= 2;
}

export type DocumentLanguage = "ar" | "en" | "mixed";

export function detectLanguage(text: string): DocumentLanguage {
  const ratio = arabicRatio(text);
  if (ratio >= 0.7) return "ar";
  if (ratio <= 0.15) return "en";
  return "mixed";
}
