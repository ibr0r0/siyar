import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-24 px-5 pb-10">
      <div className="neu-card mx-auto flex max-w-7xl flex-col gap-3 p-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t("privacy")}</p>
        <p>
          {t.rich("license", {
            link: (chunks) => (
              <a
                className="font-semibold text-accent underline-offset-4 hover:underline"
                href="https://github.com/siyar-app/siyar"
                target="_blank"
                rel="noreferrer noopener"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
