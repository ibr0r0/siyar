import { describe, expect, it } from "vitest";
import {
  arabicRatio,
  containsArabic,
  containsPresentationForms,
  detectLanguage,
  foldArabic,
  normalizeDigits,
  repairArabic,
  repairVisualOrder,
} from "./arabic";

/**
 * Build the reverse of NFKC's compatibility mapping: base letter → isolated
 * presentation form. Deriving it from Unicode data rather than hardcoding it
 * means the fixtures below are real glyph sequences, not hand-typed guesses.
 */
const isolatedForms = (() => {
  const map = new Map<string, string>();
  for (let code = 0xfe70; code <= 0xfefc; code++) {
    const glyph = String.fromCodePoint(code);
    const base = glyph.normalize("NFKC");
    // Only single-character bases; skip the lam-alef ligatures.
    if ([...base].length === 1 && !map.has(base)) map.set(base, glyph);
  }
  return map;
})();

/** Simulate a PDF that stored shaped glyphs in visual (painted) order. */
function asVisualGlyphs(logical: string): string {
  const shaped = [...logical]
    .map((char) => isolatedForms.get(char) ?? char)
    .join("");
  return [...shaped].reverse().join("");
}

describe("character classification", () => {
  it("detects Arabic", () => {
    expect(containsArabic("مهندس برمجيات")).toBe(true);
    expect(containsArabic("Software Engineer")).toBe(false);
  });

  it("detects presentation forms only when glyphs are present", () => {
    expect(containsPresentationForms("الرياض")).toBe(false);
    expect(containsPresentationForms(asVisualGlyphs("الرياض"))).toBe(true);
  });
});

describe("repairVisualOrder", () => {
  it("reverses an Arabic run", () => {
    expect(repairVisualOrder("دمحم")).toBe("محمد");
  });

  it("keeps Latin words and numbers readable", () => {
    // Visual order: the year sits to the left of the Arabic phrase.
    expect(repairVisualOrder("2019 ذنم Python")).toBe("Python منذ 2019");
  });

  it("puts paired brackets back on the correct sides", () => {
    // In visual order the physically-leftmost codepoint of "(الرياض)" is the
    // closing paren, so reversing the run sequence is the whole fix.
    expect(repairVisualOrder(")ضايرلا(")).toBe("(الرياض)");
  });
});

describe("repairArabic", () => {
  it("recovers logical text from shaped, visually-ordered glyphs", () => {
    const logical = "مهندس برمجيات";
    expect(repairArabic(asVisualGlyphs(logical))).toBe(logical);
  });

  it("leaves already-logical Arabic untouched", () => {
    // The regression that matters most: reversing correct text would be worse
    // than doing nothing at all.
    const logical = "خبرة خمس سنوات في تطوير الويب";
    expect(repairArabic(logical)).toBe(logical);
  });

  it("decomposes lam-alef ligatures", () => {
    expect(repairArabic("ﻻ")).toBe("لا");
  });

  it("strips tatweel, bidi controls and zero-width joiners", () => {
    expect(repairArabic("مـــهندس‏​")).toBe("مهندس");
  });

  it("preserves diacritics, which are meaningful to a reader", () => {
    expect(repairArabic("سِيَر")).toBe("سِيَر");
  });

  it("repairs each line independently", () => {
    const input = `${asVisualGlyphs("الرياض")}\nSoftware Engineer`;
    expect(repairArabic(input)).toBe("الرياض\nSoftware Engineer");
  });

  it("collapses runs of spaces left by glyph positioning", () => {
    expect(repairArabic("مهندس     برمجيات")).toBe("مهندس برمجيات");
  });
});

describe("foldArabic", () => {
  it("unifies alef variants", () => {
    expect(foldArabic("أحمد")).toBe(foldArabic("احمد"));
    expect(foldArabic("إدارة")).toBe(foldArabic("ادارة"));
  });

  it("unifies ta-marbuta with ha, and alef-maqsura with ya", () => {
    expect(foldArabic("خبرة")).toBe(foldArabic("خبره"));
    expect(foldArabic("مستوى")).toBe(foldArabic("مستوي"));
  });

  it("removes diacritics", () => {
    expect(foldArabic("مُهَنْدِس")).toBe(foldArabic("مهندس"));
  });

  it("folds shaped glyphs and plain text to the same key", () => {
    expect(foldArabic(asVisualGlyphs("مهندس"))).toBe(foldArabic("مهندس"));
  });

  it("lowercases Latin so mixed CVs match", () => {
    expect(foldArabic("Python")).toBe(foldArabic("python"));
  });
});

describe("normalizeDigits", () => {
  it("converts Arabic-Indic digits", () => {
    expect(normalizeDigits("٢٠١٩")).toBe("2019");
  });

  it("converts Eastern Arabic-Indic digits", () => {
    expect(normalizeDigits("۲۰۱۹")).toBe("2019");
  });

  it("leaves ASCII digits alone", () => {
    expect(normalizeDigits("2019")).toBe("2019");
  });
});

describe("language detection", () => {
  it("scores an Arabic CV as Arabic", () => {
    expect(detectLanguage("مهندس برمجيات لدى شركة أرامكو السعودية")).toBe("ar");
  });

  it("scores an English CV as English", () => {
    expect(detectLanguage("Senior Software Engineer at Saudi Aramco")).toBe(
      "en",
    );
  });

  it("recognises a bilingual CV", () => {
    expect(detectLanguage("مهندس برمجيات — Software Engineer at Aramco")).toBe(
      "mixed",
    );
  });

  it("ignores digits and punctuation when measuring", () => {
    expect(arabicRatio("2019 — 2024")).toBe(0);
  });
});
