import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

/** Text direction per locale. Arabic is the default, so the app is RTL by default. */
export const direction: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  // Arabic is served from `/` unprefixed; English lives under `/en`.
  localePrefix: "as-needed",
});
