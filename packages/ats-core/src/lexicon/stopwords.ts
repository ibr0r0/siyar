import { foldArabic } from "../text/arabic";

const ENGLISH = `a about above after again against all am an and any are as at be because been
before being below between both but by can cannot could did do does doing down during each few for
from further had has have having he her here hers herself him himself his how i if in into is it its
itself me more most my myself no nor not of off on once only or other ought our ours ourselves out
over own same she should so some such than that the their theirs them themselves then there these
they this those through to too under until up very was we were what when where which while who whom
why with would you your yours yourself yourselves will shall may might must able within across per
also using use used work working job role position company team years year month new strong good
excellent ability skills experience knowledge understanding responsible required requirements
preferred plus etc'`.split(/\s+/);

const ARABIC = `من إلى في على عن مع هذا هذه ذلك تلك الذي التي الذين اللاتي و أو ثم بل لكن حتى إذا
إن أن كان كانت يكون تكون قد لقد ما لا لم لن هل أي كل بعض غير بين عند لدى نحو خلال بعد قبل فوق تحت
أمام خلف حول ضمن عبر منذ سوف هو هي هم هن أنا نحن أنت أنتم له لها لهم به بها فيه فيها ذات ذو مثل
أيضا كذلك حيث بحيث بما لما كما وفق حسب عبر ونحو الى او فى العمل الوظيفة الشركة الفريق سنة سنوات
شهر خبرة مهارات معرفة القدرة القدرات المطلوب مطلوب يفضل متطلبات مسؤوليات المهام`.split(/\s+/);

export const STOPWORDS: ReadonlySet<string> = new Set(
  [...ENGLISH, ...ARABIC].map((word) => foldArabic(word)).filter(Boolean),
);

/** Split folded text into comparable tokens, dropping stopwords and noise. */
export function tokenize(foldedText: string): string[] {
  return foldedText
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((token) => token.replace(/^[.]+|[.]+$/g, ""))
    .filter(
      (token) =>
        token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token),
    );
}

/**
 * Terms worth matching a CV against, ranked by frequency in the job
 * description. Bigrams are kept alongside unigrams so "machine learning" and
 * "إدارة المشاريع" survive as single concepts.
 */
export function extractKeyTerms(foldedText: string, limit = 30): string[] {
  const tokens = tokenize(foldedText);
  const counts = new Map<string, number>();

  const bump = (term: string, by: number) =>
    counts.set(term, (counts.get(term) ?? 0) + by);

  for (const token of tokens) bump(token, 1);

  for (let i = 0; i + 1 < tokens.length; i++) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (!first || !second) continue;
    // Weight bigrams above their parts so multi-word skills rank first.
    bump(`${first} ${second}`, 1.6);
  }

  return [...counts.entries()]
    .filter(([term, count]) => count > (term.includes(" ") ? 1.6 : 1))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}
