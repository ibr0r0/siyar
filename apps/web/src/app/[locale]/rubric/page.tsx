import {
  getFormatter,
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { FAMILIES, rubric } from "@siyar/ats-core";
import type { Severity } from "@siyar/ats-core";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-danger)",
  major: "var(--color-warning)",
  minor: "var(--color-accent)",
  info: "var(--color-muted)",
};

/**
 * The rubric, rendered from the same JSON the engine scores against.
 *
 * This page is the point of the project: a candidate can read every rule that
 * produced their number, see what it is worth, and disagree with it in public.
 */
export default async function RubricPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("rubric");
  const tChecks = await getTranslations("checks");
  const tFamilies = await getTranslations("families");
  const tSeverity = await getTranslations("severity");
  const format = await getFormatter();

  const fallbackParams = placeholdersIn(await getMessages());
  const total = rubric.checks.reduce((sum, check) => sum + check.weight, 0);

  const facts = [
    [t("version"), rubric.version],
    [t("totalWeight"), format.number(total)],
    [
      t("bands"),
      `≥ ${format.number(rubric.bands.good)} · ≥ ${format.number(rubric.bands.fair)}`,
    ],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-3xl text-foreground sm:text-4xl lg:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">{t("intro")}</p>
      </header>

      <dl className="mt-12 grid gap-6 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="neu-card p-7 text-center">
            <dt className="label">{label}</dt>
            <dd className="font-display mt-3 text-2xl text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="neu-inset mx-auto mt-8 max-w-4xl rounded-card p-7 text-sm leading-relaxed text-muted">
        {t("skipNote")}
      </p>

      <div className="mt-16 space-y-14">
        {FAMILIES.map((family) => {
          const checks = rubric.checks.filter((item) => item.family === family);
          if (checks.length === 0) return null;
          const weight = checks.reduce((sum, item) => sum + item.weight, 0);

          return (
            <section key={family}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-2xl text-foreground">
                  {tFamilies(family)}
                </h2>
                <span className="neu-pill text-muted">
                  {format.number(weight)} {t("points")}
                </span>
              </div>

              <ul className="mt-7 grid gap-6 lg:grid-cols-2">
                {checks.map((check) => (
                  <li key={check.id} className="neu-card neu-card-interactive p-7">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h3 className="font-display text-base text-foreground">
                        {tChecks(`${check.id}.title`)}
                      </h3>
                      <span
                        className="neu-pill"
                        style={{ color: SEVERITY_COLOR[check.severity] }}
                      >
                        {tSeverity(check.severity)}
                      </span>
                      <span className="text-xs text-muted">
                        {check.informational
                          ? t("informational")
                          : `${format.number(check.weight)} ${t("points")}`}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {tChecks(`${check.id}.fix`, fallbackParams)}
                    </p>

                    <code className="ltr-inline mt-4 text-xs text-muted opacity-60">
                      {check.id}
                    </code>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The rubric page shows each rule's advice out of context, with no document to
 * draw real values from, so every interpolated name needs a neutral
 * placeholder.
 *
 * The names are read out of the message catalogue rather than listed by hand.
 * This page renders *every* check in the rubric, so a hand-written list goes
 * stale the moment someone adds a rule whose message interpolates a new value —
 * and the failure mode is a broken build, discovered late. Deriving them keeps
 * the two in step by construction.
 */
function placeholdersIn(messages: unknown): Record<string, string> {
  const params: Record<string, string> = {};

  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      for (const [, name] of node.matchAll(/\{\s*(\w+)\s*[,}]/g)) {
        if (name) params[name] = "—";
      }
      return;
    }
    if (node && typeof node === "object") Object.values(node).forEach(walk);
  };

  walk(messages);
  return params;
}
