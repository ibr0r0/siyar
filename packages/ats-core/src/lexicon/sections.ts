import { foldArabic } from "../text/arabic";

export const SECTION_KINDS = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
  "projects",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/**
 * Headings an applicant tracking system looks for, in both languages.
 *
 * These are matched against *folded* text, so orthographic variants (الخبرة /
 * الخبره, أ / ا) collapse automatically and do not need separate entries.
 */
const HEADINGS: Record<SectionKind, string[]> = {
  contact: [
    "معلومات الاتصال",
    "معلومات التواصل",
    "بيانات التواصل",
    "بيانات الاتصال",
    "التواصل",
    "معلومات شخصية",
    "البيانات الشخصية",
    "المعلومات الشخصية",
    "contact",
    "contact information",
    "contact details",
    "personal details",
    "personal information",
  ],
  summary: [
    "الملخص",
    "ملخص",
    "الملخص المهني",
    "نبذة",
    "نبذة مختصرة",
    "نبذة عني",
    "الملف الشخصي",
    "الهدف الوظيفي",
    "الهدف المهني",
    "summary",
    "professional summary",
    "career summary",
    "profile",
    "professional profile",
    "objective",
    "career objective",
    "about me",
    "about",
  ],
  experience: [
    "الخبرة",
    "الخبرات",
    "الخبرة العملية",
    "الخبرات العملية",
    "الخبرة المهنية",
    "الخبرات المهنية",
    "الخبرة الوظيفية",
    "الخبرات الوظيفية",
    "التاريخ الوظيفي",
    "المسار المهني",
    "السجل الوظيفي",
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "work history",
    "career history",
    "employment",
  ],
  education: [
    "التعليم",
    "المؤهل العلمي",
    "المؤهلات العلمية",
    "المؤهلات",
    "التحصيل العلمي",
    "الشهادات العلمية",
    "الدراسة",
    "education",
    "academic background",
    "academic qualifications",
    "qualifications",
    "educational background",
  ],
  skills: [
    "المهارات",
    "مهارات",
    "المهارات التقنية",
    "المهارات الشخصية",
    "المهارات الأساسية",
    "القدرات",
    "الكفاءات",
    "skills",
    "technical skills",
    "core skills",
    "key skills",
    "core competencies",
    "competencies",
    "areas of expertise",
  ],
  languages: ["اللغات", "لغات", "languages", "language skills"],
  certifications: [
    "الشهادات",
    "الشهادات المهنية",
    "الدورات",
    "الدورات التدريبية",
    "التدريب",
    "الرخص المهنية",
    "certifications",
    "certificates",
    "courses",
    "training",
    "licenses",
    "licences",
    "professional development",
  ],
  projects: [
    "المشاريع",
    "المشروعات",
    "الأعمال",
    "أعمال مختارة",
    "projects",
    "selected projects",
    "portfolio",
  ],
};

/** Folded heading → section kind. Built once at module load. */
const HEADING_INDEX: ReadonlyMap<string, SectionKind> = (() => {
  const index = new Map<string, SectionKind>();
  for (const kind of SECTION_KINDS) {
    for (const heading of HEADINGS[kind]) {
      index.set(foldArabic(heading), kind);
    }
  }
  return index;
})();

/** Punctuation and decoration people put around headings. */
const HEADING_TRIM = /^[\s•●▪*\-–—_|:،.]+|[\s•*\-–—_|:،.]+$/g;

/**
 * Identify a line as a section heading.
 *
 * Headings are short, so we refuse anything long enough to be a sentence — this
 * keeps "خبرة خمس سنوات في إدارة المشاريع" from registering as an *experience*
 * heading just because it opens with the word.
 */
export function matchSectionHeading(
  foldedLine: string,
): SectionKind | undefined {
  const cleaned = foldedLine.replace(HEADING_TRIM, "");
  if (cleaned.length === 0 || cleaned.length > 40) return undefined;
  return HEADING_INDEX.get(cleaned);
}

export function headingsFor(kind: SectionKind): readonly string[] {
  return HEADINGS[kind];
}
