import { describe, expect, it } from "vitest";
import { analyze, notes } from "./analyze";
import { rubric } from "./rubric";
import { buildFixtureDocument } from "./testing/fixture";
import {
  GOOD_ARABIC_CV,
  GOOD_ENGLISH_CV,
  SAMPLE_JOB_DESCRIPTION,
  WEAK_ARABIC_CV,
} from "./testing/samples";
import type { CheckResult, ScoreReport } from "./types";

const report = (text: string) => analyze(buildFixtureDocument(text));

function check(result: ScoreReport, id: string): CheckResult {
  const found = result.checks.find((item) => item.id === id);
  if (!found) throw new Error(`no check ${id} in report`);
  return found;
}

describe("rubric integrity", () => {
  it("has an implementation for every declared check", () => {
    // `analyze` throws on a missing implementation; running it proves the
    // rubric and the code have not drifted apart.
    expect(() => report(GOOD_ARABIC_CV)).not.toThrow();
  });

  it("uses unique check ids", () => {
    const ids = rubric.checks.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every non-informational check a positive weight", () => {
    const wrong = rubric.checks.filter(
      (item) => !item.informational && item.weight <= 0,
    );
    expect(wrong).toEqual([]);
  });
});

describe("a well-written Arabic CV", () => {
  const result = report(GOOD_ARABIC_CV);

  it("is detected as Arabic", () => {
    expect(result.language).toBe("ar");
  });

  it("scores in the good band", () => {
    expect(result.overall).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe("good");
  });

  it("finds the contact details", () => {
    expect(check(result, "contact.email").status).toBe("pass");
    expect(check(result, "contact.phone").status).toBe("pass");
    expect(check(result, "contact.linkedin").status).toBe("pass");
    expect(check(result, "contact.location").status).toBe("pass");
  });

  it("finds the standard sections", () => {
    expect(check(result, "structure.experience-section").status).toBe("pass");
    expect(check(result, "structure.education-section").status).toBe("pass");
    expect(check(result, "structure.skills-section").status).toBe("pass");
    expect(check(result, "structure.summary-section").status).toBe("pass");
  });

  it("reads the Arabic date ranges, including 'حتى الآن'", () => {
    expect(check(result, "dates.present").status).toBe("pass");
    expect(check(result, "dates.current-role").status).toBe("pass");
  });

  it("credits quantified, action-led Arabic bullets", () => {
    expect(check(result, "impact.quantified").status).toBe("pass");
    expect(check(result, "impact.action-openers").earned).toBeGreaterThan(0);
  });
});

describe("a weak Arabic CV", () => {
  const result = report(WEAK_ARABIC_CV);

  it("scores in the poor band", () => {
    expect(result.overall).toBeLessThan(60);
    expect(result.band).toBe("poor");
  });

  it("reports the missing contact details", () => {
    expect(check(result, "contact.email").status).toBe("fail");
    expect(check(result, "contact.phone").status).toBe("fail");
  });

  it("reports the missing standard headings", () => {
    expect(check(result, "structure.experience-section").status).toBe("fail");
    expect(check(result, "structure.skills-section").status).toBe("fail");
  });

  it("catches duty-based bullet openers", () => {
    const duties = check(result, "impact.no-duty-openers");
    expect(duties.status).not.toBe("pass");
    expect(duties.evidence.length).toBeGreaterThan(0);
  });

  it("catches the overlong bullet", () => {
    expect(check(result, "impact.bullet-length").status).not.toBe("pass");
  });

  it("catches first-person prose", () => {
    expect(check(result, "impact.first-person").status).not.toBe("pass");
  });

  it("puts the unreadable-to-a-parser problems at the top of the fix list", () => {
    expect(result.fixes[0]?.severity).toBe("critical");
  });

  it("reports personal details as a note, not a deduction", () => {
    const personal = check(result, "contact.personal-details");
    expect(personal.status).toBe("warn");
    expect(personal.weight).toBe(0);
    expect(personal.params?.fields).toContain("dateOfBirth");
    expect(notes(result).map((item) => item.id)).toContain(
      "contact.personal-details",
    );
  });

  it("scores the good CV well above the weak one", () => {
    expect(report(GOOD_ARABIC_CV).overall).toBeGreaterThan(result.overall + 25);
  });
});

describe("an English CV", () => {
  const result = report(GOOD_ENGLISH_CV);

  it("is detected as English", () => {
    expect(result.language).toBe("en");
  });

  it("scores in the good band", () => {
    expect(result.overall).toBeGreaterThanOrEqual(80);
  });

  it("skips the Arabic-only encoding check", () => {
    expect(check(result, "readability.arabic-encoding").status).toBe("skipped");
  });

  it("reads English month-and-year ranges", () => {
    expect(check(result, "dates.present").status).toBe("pass");
    expect(check(result, "dates.consistent-precision").status).toBe("pass");
  });
});

describe("keyword coverage", () => {
  const doc = buildFixtureDocument(GOOD_ARABIC_CV);

  it("skips the whole family when no job description is given", () => {
    const result = analyze(doc);
    for (const id of [
      "keywords.coverage",
      "keywords.title-match",
      "keywords.skills-section-coverage",
    ]) {
      expect(check(result, id).status).toBe("skipped");
    }
    expect(
      result.families.find((family) => family.family === "keywords")?.percent,
    ).toBeNull();
  });

  it("scores coverage once a job description is supplied", () => {
    const result = analyze(doc, {
      targetJobDescription: SAMPLE_JOB_DESCRIPTION,
    });
    const coverage = check(result, "keywords.coverage");
    expect(coverage.status).not.toBe("skipped");
    expect(coverage.earned).toBeGreaterThan(0);
    expect(check(result, "keywords.title-match").status).toBe("pass");
  });

  it("does not punish a CV for the absence of an optional field", () => {
    // The same document, with and without a job description, must not differ
    // simply because the optional input was left blank.
    const without = analyze(doc).overall;
    const with_ = analyze(doc, {
      targetJobDescription: SAMPLE_JOB_DESCRIPTION,
    }).overall;
    expect(Math.abs(with_ - without)).toBeLessThan(15);
  });
});

describe("corrupted Arabic ligatures", () => {
  // What Chrome's print-to-PDF actually produces for a correct Arabic CV: the
  // characters inside each ligature come back transposed.
  const CORRUPTED = GOOD_ARABIC_CV.replaceAll("المملكة", "اململكة")
    .replaceAll("الاستجابة", "االستجابة")
    .replaceAll("الآن", "اآلن")
    .replaceAll("الاتصالات", "االتصاالت");

  it("passes a clean Arabic CV", () => {
    expect(check(report(GOOD_ARABIC_CV), "readability.arabic-ligatures").status).toBe(
      "pass",
    );
  });

  it("fails a corrupted one and quotes the damaged lines", () => {
    const result = report(CORRUPTED);
    const finding = check(result, "readability.arabic-ligatures");

    expect(finding.status).toBe("fail");
    expect(finding.severity).toBe("critical");
    expect(Number(finding.params?.count)).toBeGreaterThanOrEqual(2);
    expect(finding.evidence.length).toBeGreaterThan(0);
  });

  it("raises it to the top of the fix list", () => {
    expect(report(CORRUPTED).fixes[0]?.id).toBe("readability.arabic-ligatures");
  });

  it("does not apply to an English CV", () => {
    expect(
      check(report(GOOD_ENGLISH_CV), "readability.arabic-ligatures").status,
    ).toBe("skipped");
  });

  it("tolerates a single stray sequence without crying wolf", () => {
    const oneOff = GOOD_ARABIC_CV.replace("المملكة", "اململكة");
    expect(check(report(oneOff), "readability.arabic-ligatures").status).toBe(
      "pass",
    );
  });
});

describe("bullets a PDF exporter dropped the markers from", () => {
  it("still finds the achievements under the experience heading", () => {
    // Chrome's print-to-PDF draws list markers as decoration and leaves them
    // out of the text layer, so the bullets arrive as bare lines.
    const withoutMarkers = GOOD_ARABIC_CV.replaceAll("• ", "");
    const result = report(withoutMarkers);

    expect(check(result, "impact.uses-bullets").status).not.toBe("warn");
    expect(check(result, "impact.quantified").earned).toBeGreaterThan(0);
  });

  it("does not sweep up the summary paragraph as a bullet", () => {
    const withoutMarkers = GOOD_ARABIC_CV.replaceAll("• ", "");
    const bullets = check(report(withoutMarkers), "impact.uses-bullets");
    // Seven real bullets in the fixture; the summary must not become an eighth.
    expect(Number(bullets.params?.count)).toBeLessThanOrEqual(7);
  });
});

describe("scanned documents", () => {
  it("fails the critical text-layer check and says so first", () => {
    const scanned = buildFixtureDocument("", {
      meta: { hasTextLayer: false },
    });
    const result = analyze(scanned);

    expect(check(result, "readability.text-layer").status).toBe("fail");
    expect(result.fixes[0]?.id).toBe("readability.text-layer");
    expect(result.band).toBe("poor");
  });
});

describe("informational findings", () => {
  it("does not let a photo or date of birth change the score", () => {
    const plain = analyze(buildFixtureDocument(GOOD_ARABIC_CV));
    const withPhoto = analyze(
      buildFixtureDocument(GOOD_ARABIC_CV, { imageCount: 1 }),
    );
    expect(withPhoto.overall).toBe(plain.overall);
    expect(check(withPhoto, "contact.personal-details").params?.fields).toContain(
      "photo",
    );
  });
});
