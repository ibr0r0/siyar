import { getTranslations, setRequestLocale } from "next-intl/server";
import { Outreach } from "@/components/outreach/outreach";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OutreachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("outreach");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <header className="mb-14">
        <h1 className="font-display text-3xl text-foreground sm:text-4xl lg:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
          {t("intro")}
        </p>
      </header>

      <Outreach />
    </div>
  );
}
