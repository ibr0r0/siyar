"use client";

import { useFormatter, useTranslations } from "next-intl";
import { notes as informationalNotes } from "@siyar/ats-core";
import type { CheckResult } from "@siyar/ats-core";
import { Link } from "@/i18n/navigation";
import type { Analysis } from "@/lib/analyzer";
import { CheckItem } from "./check-item";
import { FamilyMeter, ScoreHeadline } from "./score-headline";

export function ScoreReport({ analysis }: { analysis: Analysis }) {
  const t = useTranslations("analyze.result");
  const format = useFormatter();
  const { report } = analysis;

  // Informational findings carry no points and get their own list — mixing them
  // into the fixes would imply they cost something.
  const notes = informationalNotes(report);
  const noteIds = new Set(notes.map((note) => note.id));
  const fixes = report.fixes.filter((fix) => !noteIds.has(fix.id));
  const passed = report.checks.filter((check) => check.status === "pass");

  return (
    <div className="space-y-12">
      <section className="neu-card grid gap-12 p-8 sm:p-12 lg:grid-cols-[auto_1fr] lg:gap-16">
        <div className="flex flex-col items-center gap-6">
          <ScoreHeadline score={report.overall} band={report.band} />

          <dl className="space-y-1.5 text-center text-sm text-muted">
            <dd className="ltr-inline font-medium">{analysis.fileName}</dd>
            <dd>
              {t("pages", { count: analysis.pageCount })} ·{" "}
              {report.language.toUpperCase()}
            </dd>
            <dd>
              <Link
                href="/rubric"
                className="font-semibold text-accent underline-offset-4 hover:underline"
              >
                {t("rubricVersion", { version: report.rubricVersion })}
              </Link>
            </dd>
          </dl>
        </div>

        <div>
          <p className="label">{t("families")}</p>
          <div className="mt-4">
            {report.families.map((family) => (
              <FamilyMeter key={family.family} family={family} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-foreground sm:text-3xl">
          {t("fixes")}
        </h2>
        {fixes.length === 0 ? (
          <p className="neu-inset mt-6 rounded-card p-8 text-muted">
            {t("noFixes")}
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {fixes.map((check, index) => (
              <CheckItem key={check.id} check={check} index={index} />
            ))}
          </ul>
        )}
      </section>

      {notes.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-foreground sm:text-3xl">
            {t("notes")}
          </h2>
          <ul className="mt-8 space-y-6">
            {notes.map((check, index) => (
              <CheckItem
                key={check.id}
                check={check}
                index={index}
                showPoints={false}
              />
            ))}
          </ul>
        </section>
      )}

      <PassedList checks={passed} />
    </div>
  );
}

function PassedList({ checks }: { checks: CheckResult[] }) {
  const t = useTranslations("analyze.result");
  const tChecks = useTranslations("checks");
  const format = useFormatter();

  if (checks.length === 0) return null;

  return (
    <section className="neu-card p-8 sm:p-10">
      <details>
        <summary className="cursor-pointer font-display text-lg text-foreground">
          {t("passed")} ({format.number(checks.length)})
        </summary>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {checks.map((check) => (
            <li key={check.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className="neu-inset mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[color:var(--color-accent-secondary)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12.5l5 5L20 6.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-muted">
                {tChecks(`${check.id}.title`)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
