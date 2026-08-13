import { useFormatter, useTranslations } from "next-intl";
import type { FamilyScore, ScoreBand } from "@siyar/ats-core";

const BAND_COLOR: Record<ScoreBand, string> = {
  good: "var(--color-success)",
  fair: "var(--color-warning)",
  poor: "var(--color-danger)",
};

/**
 * The score, expressed with the system's nested-depth idiom: a carved well
 * holding a raised disc. The number is the one thing on the page that should
 * feel like a physical object you could pick up.
 */
export function ScoreHeadline({
  score,
  band,
}: {
  score: number;
  band: ScoreBand;
}) {
  const t = useTranslations("analyze.result");
  const tBands = useTranslations("analyze.bands");
  const format = useFormatter();

  return (
    <figure className="flex flex-col items-center">
      <div className="neu-well grid place-items-center rounded-full p-6">
        <div className="grid size-44 place-items-center rounded-full bg-background shadow-raised">
          <span
            className="font-display text-6xl leading-none"
            style={{ color: BAND_COLOR[band] }}
          >
            {format.number(Math.round(score))}
          </span>
          <span className="mt-2 text-xs font-semibold text-muted">
            {t("of")}
          </span>
        </div>
      </div>

      <figcaption
        className="neu-pill mt-6"
        style={{ color: BAND_COLOR[band] }}
      >
        {tBands(band)}
      </figcaption>
    </figure>
  );
}

/** Inset channel with a raised bar riding inside it. */
export function FamilyMeter({ family }: { family: FamilyScore }) {
  const t = useTranslations("families");
  const tResult = useTranslations("analyze.result");
  const format = useFormatter();

  const percent = family.percent;
  const skipped = percent === null;

  const color =
    percent === null
      ? "transparent"
      : percent >= 80
        ? "var(--color-success)"
        : percent >= 60
          ? "var(--color-warning)"
          : "var(--color-danger)";

  return (
    <div className="py-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="font-medium text-foreground">{t(family.family)}</span>
        <span className="font-display text-sm text-muted">
          {skipped ? "—" : `${format.number(Math.round(percent))}%`}
        </span>
      </div>

      <div
        className="neu-track"
        role="meter"
        aria-valuenow={percent ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(family.family)}
      >
        {!skipped && (
          <div
            className="neu-track-fill"
            style={{ width: `${Math.max(2, percent)}%`, background: color }}
          />
        )}
      </div>

      {skipped && (
        <p className="mt-2 text-xs text-muted">{tResult("skippedHint")}</p>
      )}
    </div>
  );
}
