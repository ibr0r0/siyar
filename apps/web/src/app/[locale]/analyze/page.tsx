import { setRequestLocale } from "next-intl/server";
import { Analyzer } from "@/components/analyze/analyzer";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <Analyzer />
    </div>
  );
}
