import { detectSections, findSection } from "../analysis/structure";
import type { SectionKind } from "../lexicon/sections";
import type { Context } from "../types";
import { evidenceFromLine, fail, gradeRatio, pass, warn, type CheckFn } from "./kinds";

/**
 * Section structure. An ATS maps a CV onto a schema — employment, education,
 * skills — by finding headings it recognises. Creative headings ("My Journey")
 * parse as free text and their contents are attributed to nothing.
 */

function sectionCheck(kind: SectionKind, minimumLines: number): CheckFn {
  return (context) => {
    const sections = detectSections(context);
    const section = findSection(sections, kind);

    // `lines: 0` rather than no params at all: the translated message
    // interpolates it, and an absent argument renders as a formatting error
    // instead of a sentence.
    if (!section) return fail(undefined, { lines: 0 });

    const evidence = evidenceFromLine(context, section.headingIndex);
    const body = evidence ? [evidence] : undefined;

    // A heading with nothing under it is worse than no heading — it tells the
    // parser to expect content and then hands it an empty region.
    if (section.bodyIndices.length < minimumLines) {
      return warn(0.4, body, { lines: section.bodyIndices.length });
    }

    return pass(body);
  };
}

const experienceSection = sectionCheck("experience", 2);
const educationSection = sectionCheck("education", 1);
const skillsSection = sectionCheck("skills", 1);
const summarySection = sectionCheck("summary", 1);

/**
 * How much of the document sits under a heading we recognise. A CV with three
 * good headings and four invented ones still loses most of its content.
 */
const headingCoverage: CheckFn = (context) => {
  const sections = detectSections(context);
  const contentLines = context.foldedLines.filter(
    (line) => line.trim().length > 0,
  ).length;
  if (contentLines === 0) {
    return fail(undefined, { covered: 0, total: 0, sections: 0 });
  }

  const covered = sections.reduce(
    (total, section) => total + section.bodyIndices.length + 1,
    0,
  );

  return gradeRatio(covered / contentLines, 0.75, undefined, {
    covered,
    total: contentLines,
    sections: sections.length,
  });
};

/**
 * Section ordering. Experience above education is the convention for anyone
 * past their first job, and some parsers weight the first block more heavily.
 *
 * Skipped for CVs with no experience section at all — a new graduate leading
 * with education is doing the right thing.
 */
const sectionOrder: CheckFn = (context) => {
  const sections = detectSections(context);
  const experience = findSection(sections, "experience");
  const education = findSection(sections, "education");
  if (!experience || !education) return pass();

  // A CV whose experience section is thin is probably a graduate CV, where
  // education-first is correct.
  if (experience.bodyIndices.length < 4) return pass();

  return experience.headingIndex < education.headingIndex ? pass() : warn(0.5);
};

export const STRUCTURE_CHECKS: Record<string, CheckFn> = {
  "structure.experience-section": experienceSection,
  "structure.education-section": educationSection,
  "structure.skills-section": skillsSection,
  "structure.summary-section": summarySection,
  "structure.heading-coverage": headingCoverage,
  "structure.section-order": sectionOrder,
};
