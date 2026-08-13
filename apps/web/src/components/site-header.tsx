"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LocaleSwitcher } from "./locale-switcher";

const ROUTES = ["analyze", "outreach", "rubric"] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-5">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-display text-xl text-foreground"
        >
          {t("brand")}
        </Link>

        {/* Desktop navigation: an inset channel with the active item raised out
            of it, so the current page reads as a physical position. */}
        <nav className="ms-8 hidden md:block">
          <ul className="neu-inset flex items-center gap-1 rounded-full p-1.5">
            {ROUTES.map((route) => {
              const active = pathname === `/${route}`;
              return (
                <li key={route}>
                  <Link
                    href={`/${route}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                      active
                        ? "bg-background text-foreground shadow-raised-sm"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    {t(route)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <LocaleSwitcher />

          <a
            href="https://github.com/ibr0r0/siyar"
            target="_blank"
            rel="noreferrer noopener"
            className="btn hidden text-sm md:inline-flex"
          >
            {t("source")}
          </a>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={t(open ? "closeMenu" : "openMenu")}
            className={cn("btn btn-icon md:hidden", open && "shadow-inset")}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="neu-card mx-5 mb-4 rounded-card p-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {ROUTES.map((route) => (
              <li key={route}>
                <Link
                  href={`/${route}`}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === `/${route}` ? "page" : undefined}
                  className={cn(
                    "block rounded-2xl px-4 py-3 font-medium transition-all duration-300",
                    pathname === `/${route}`
                      ? "shadow-inset-sm text-foreground"
                      : "text-muted",
                  )}
                >
                  {t(route)}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://github.com/ibr0r0/siyar"
                target="_blank"
                rel="noreferrer noopener"
                className="block rounded-2xl px-4 py-3 font-medium text-muted"
              >
                {t("source")}
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
