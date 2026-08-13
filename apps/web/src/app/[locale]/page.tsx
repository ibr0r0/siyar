import { useFormatter, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { FAMILIES, rubric } from "@siyar/ats-core";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}

function Home() {
  const t = useTranslations("home");
  const tFamilies = useTranslations("families");
  const format = useFormatter();

  // Read off the rubric so the headline figure cannot drift from the engine.
  const checkCount = rubric.checks.length;

  const stats = [
    { value: format.number(checkCount), label: t("stats.checks"), note: t("stats.checksNote") },
    { value: format.number(0), label: t("stats.cost"), note: t("stats.costNote") },
    { value: "100%", label: t("stats.local"), note: t("stats.localNote") },
  ];

  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-16 px-5 py-20 lg:grid-cols-2 lg:py-32">
        <div>
          <p className="neu-pill text-muted">{t("badge")}</p>

          <h1 className="font-display mt-7 text-balance text-4xl leading-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("headline")}
          </h1>

          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
            {t("subhead")}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/analyze" className="btn btn-primary">
              {t("ctaPrimary")}
            </Link>
            <Link href="/rubric" className="btn">
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>

        <HeroVisual score={87} label={t("heroScore")} />
      </section>

      <section className="mx-auto max-w-7xl px-5">
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="neu-card neu-card-interactive p-8 text-center"
            >
              <p className="font-display text-5xl text-accent">{stat.value}</p>
              <p className="mt-3 font-bold text-foreground">{stat.label}</p>
              <p className="mt-1.5 text-sm text-muted">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <h2 className="font-display text-3xl text-foreground">
          {t("checksTitle")}
        </h2>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILIES.map((family, index) => {
            const checks = rubric.checks.filter(
              (check) => check.family === family,
            );
            const weight = checks.reduce(
              (total, check) => total + check.weight,
              0,
            );

            return (
              <li
                key={family}
                className="neu-card neu-card-interactive flex items-start gap-5 p-7"
              >
                {/* Icon well: drilled into the card, so the number sits below
                    the surface while the card itself sits above it. */}
                <span
                  aria-hidden
                  className="neu-well grid size-12 shrink-0 place-items-center font-display text-lg text-accent"
                >
                  {format.number(index + 1)}
                </span>

                <span>
                  <span className="block font-bold text-foreground">
                    {tFamilies(family)}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {t("weight", { weight: format.number(weight) })} ·{" "}
                    {t("checkCount", { count: format.number(checks.length) })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/**
 * The hero visual, built from the system's nested-depth idiom: a raised card
 * holding a carved well, holding a raised disc. It is the clearest statement of
 * the physics, and it doubles as an honest preview of the actual product — a
 * score with its severity meters, not an abstract illustration.
 */
function HeroVisual({ score, label }: { score: number; label: string }) {
  const bars = [
    { width: "100%", color: "var(--color-success)" },
    { width: "78%", color: "var(--color-accent)" },
    { width: "46%", color: "var(--color-warning)" },
  ];

  return (
    <div className="neu-card mx-auto w-full max-w-md p-10 lg:max-w-none">
      {/* `w-fit` matters: a block-level well stretches to the card and the
          "circle" renders as a pill. It has to hug the disc it contains. */}
      <div className="neu-well mx-auto grid w-fit place-items-center rounded-full p-8">
        <div
          className="grid size-40 place-items-center rounded-full shadow-raised transition-transform duration-500 hover:scale-105 sm:size-48"
          style={{ background: "var(--color-background)" }}
        >
          <span className="font-display text-6xl text-foreground">{score}</span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">
            {label}
          </span>
        </div>
      </div>

      <div className="mt-10 space-y-4" aria-hidden>
        {bars.map((bar) => (
          <div key={bar.width} className="neu-track">
            <div
              className="neu-track-fill"
              style={{ width: bar.width, background: bar.color }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
