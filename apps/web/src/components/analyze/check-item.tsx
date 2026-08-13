"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { CheckResult, Severity } from "@siyar/ats-core";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-danger)",
  major: "var(--color-warning)",
  minor: "var(--color-accent)",
  info: "var(--color-muted)",
};

interface Props {
  check: CheckResult;
  index: number;
  /** Informational findings carry no points, so the points line is suppressed. */
  showPoints?: boolean;
}

/**
 * One finding as a raised card with the rank drilled into it as a well.
 *
 * Severity is carried by the colour of the number *inside* that well rather
 * than by tinting the card: neumorphism depends on every surface being the same
 * material, and a coloured card would read as a different object dropped onto
 * the page. Colour is never the only signal — the severity is also named in
 * words beside it.
 */
export function CheckItem({ check, index, showPoints = true }: Props) {
  const t = useTranslations("checks");
  const tSeverity = useTranslations("severity");
  const tResult = useTranslations("analyze.result");
  const format = useFormatter();
  const [open, setOpen] = useState(false);

  const params = check.params ?? {};
  const lost = Math.round((check.weight - check.earned) * 10) / 10;
  const color = SEVERITY_COLOR[check.severity];

  return (
    <li className="neu-card neu-card-interactive p-7 sm:p-9">
      <div className="flex gap-5">
        <span
          aria-hidden
          className="neu-well grid size-12 shrink-0 place-items-center font-display text-base"
          style={{ color }}
        >
          {format.number(index + 1)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="font-display text-lg text-foreground">
              {t(`${check.id}.title`)}
            </h3>
            <span className="neu-pill" style={{ color }}>
              {tSeverity(check.severity)}
            </span>
            {showPoints && lost > 0 && (
              <span className="text-xs text-muted">
                {tResult("worth", { points: format.number(lost) })}
              </span>
            )}
          </div>

          <p className="mt-3 leading-relaxed text-muted">
            {t(`${check.id}.problem`, params)}
          </p>

          {/* The remedy is carved into the card — a distinct region without
              introducing a second material. */}
          <div className="neu-inset mt-5 rounded-2xl p-5">
            <p className="label">{tResult("fix")}</p>
            <p className="mt-2 leading-relaxed text-foreground">
              {t(`${check.id}.fix`, params)}
            </p>
          </div>

          {check.evidence.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="btn text-sm"
              >
                {tResult("evidence")} ({format.number(check.evidence.length)})
              </button>

              {open && (
                <ul className="mt-4 space-y-3">
                  {check.evidence.map((item, position) => (
                    <li
                      key={`${item.lineIndex ?? position}-${position}`}
                      className="neu-inset rounded-2xl px-5 py-3 text-sm text-muted"
                    >
                      <q>{item.text}</q>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
