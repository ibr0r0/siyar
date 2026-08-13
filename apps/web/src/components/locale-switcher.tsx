"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

const labels: Record<Locale, string> = {
  ar: "ع",
  en: "EN",
};

/**
 * Segmented control built the neumorphic way: an inset track with the selected
 * segment extruded out of it. The state is legible from the depth alone, so it
 * does not depend on the accent colour being perceivable.
 */
export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className="neu-inset flex items-center gap-1 rounded-full p-1.5"
      role="group"
    >
      {locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => router.replace(pathname, { locale: code })}
            className={cn(
              "min-w-11 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-300",
              active
                ? "bg-background text-foreground shadow-raised-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {labels[code]}
          </button>
        );
      })}
    </div>
  );
}
