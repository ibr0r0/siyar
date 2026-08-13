import type { Metadata } from "next";
import {
  Alexandria,
  DM_Sans,
  Plus_Jakarta_Sans,
  Readex_Pro,
} from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { direction, routing, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

/*
 * Four faces, two roles, two scripts.
 *
 * The design system specifies Plus Jakarta Sans for display and DM Sans for
 * body — neither of which carries a single Arabic glyph. Each is therefore
 * paired with an Arabic companion sitting directly behind it in the font stack,
 * and the browser selects between them per glyph. The components never switch
 * fonts by locale; a bilingual line sets each script in the face built for it.
 *
 * The companions are chosen to hold the system's soft geometric personality in
 * Arabic: Alexandria's rounded, even geometry answers Plus Jakarta Sans, and
 * Readex Pro was drawn for exactly this job of pairing with a Latin UI sans.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-alexandria",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-readex",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: { default: t("title"), template: `%s · ${t("shortTitle")}` },
    description: t("description"),
    applicationName: t("shortTitle"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const dir = direction[locale as Locale];

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${alexandria.variable} ${dmSans.variable} ${readex.variable} flex min-h-dvh flex-col`}
      >
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
