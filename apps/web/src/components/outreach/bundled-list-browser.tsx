"use client";

import { useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { bundledFacets, bundledLists, type BundledEntry } from "@siyar/contacts";
import { cn } from "@/lib/cn";
import type { Recipient } from "./recipient-import";

const FLAG_COLOR: Record<string, string> = {
  hiring: "var(--color-success)",
  "free-webmail": "var(--color-warning)",
  "legacy-domain": "var(--color-danger)",
};

/**
 * Browsing a bundled third-party list.
 *
 * Gated behind an explicit acknowledgement rather than an inline note. These
 * are unverified, largely non-recruitment addresses, and a good share are
 * probably dead — someone should decide to use them knowing that, not discover
 * it in a bounce folder. The per-entry flags stay visible while browsing so
 * the caution is attached to the actual rows, not just the door.
 */
export function BundledListBrowser({
  onAdd,
}: {
  onAdd: (recipients: Recipient[]) => void;
}) {
  const t = useTranslations("outreach.bundled");
  const locale = useLocale() as "ar" | "en";
  const format = useFormatter();

  const list = bundledLists[0];
  const [acknowledged, setAcknowledged] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [sector, setSector] = useState("");
  const [hiringOnly, setHiringOnly] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets = useMemo(
    () => (list ? bundledFacets(list) : null),
    [list],
  );

  const filtered = useMemo(() => {
    if (!list) return [];
    const needle = query.trim().toLowerCase();
    return list.entries.filter((entry) => {
      if (hiringOnly && !entry.flags?.includes("hiring")) return false;
      if (city && entry.city !== city) return false;
      if (sector && entry.sector !== sector) return false;
      if (needle) {
        const haystack = `${entry.email} ${entry.org ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [list, query, city, sector, hiringOnly]);

  if (!list || !facets) return null;

  if (list.entries.length === 0) {
    return (
      <div className="neu-inset rounded-card p-8">
        <h3 className="font-display text-base text-foreground">
          {list.title[locale]}
        </h3>
        <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted">
          {t("notLoaded")}
        </p>
      </div>
    );
  }

  if (!acknowledged) {
    return (
      <div className="neu-card p-8">
        <h3 className="font-display text-lg text-foreground">
          {list.title[locale]}
        </h3>

        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ["total", facets.total],
            ["hiring", facets.hiring],
            ["cities", facets.cities.length],
          ].map(([key, value]) => (
            <div key={key as string}>
              <dt className="label">{t(`stats.${key}`)}</dt>
              <dd className="font-display mt-1 text-2xl text-foreground">
                {format.number(value as number)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="neu-inset mt-7 rounded-2xl p-6">
          <p className="label" style={{ color: "var(--color-warning)" }}>
            {t("warningTitle")}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
            {["unverified", "notHiring", "stale", "bounces"].map((key) => (
              <li key={key} className="flex gap-3">
                <span aria-hidden style={{ color: "var(--color-warning)" }}>
                  —
                </span>
                <span>{t(`warning.${key}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            {list.provenance[locale]}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAcknowledged(true)}
          className="btn mt-7"
        >
          {t("acknowledge")}
        </button>
      </div>
    );
  }

  const toggle = (email: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  return (
    <div className="neu-card p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-foreground">
          {list.title[locale]}
        </h3>
        <span className="neu-pill" style={{ color: "var(--color-warning)" }}>
          {t("unverifiedBadge")}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          className="neu-input"
          aria-label={t("search")}
        />
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="neu-input appearance-none"
          aria-label={t("stats.cities")}
        >
          <option value="">{t("allCities")}</option>
          {facets.cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={sector}
          onChange={(event) => setSector(event.target.value)}
          className="neu-input appearance-none"
          aria-label={t("allSectors")}
        >
          <option value="">{t("allSectors")}</option>
          {facets.sectors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Defaults to hiring addresses only. The rest are general company
          mailboxes, and making someone opt in to those is the honest default. */}
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={hiringOnly}
          onChange={(event) => setHiringOnly(event.target.checked)}
          className="size-5 accent-[color:var(--color-accent)]"
        />
        <span className="text-foreground">
          {t("hiringOnly", { count: format.number(facets.hiring) })}
        </span>
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">
          {t("showing", {
            shown: format.number(filtered.length),
            total: format.number(facets.total),
          })}
        </span>
        <button
          type="button"
          onClick={() =>
            setSelected(new Set(filtered.map((entry) => entry.email)))
          }
          className="btn text-sm"
        >
          {t("selectAll")}
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="btn text-sm"
        >
          {t("clear")}
        </button>
      </div>

      <ul className="neu-inset mt-5 max-h-96 overflow-y-auto rounded-2xl p-3">
        {filtered.slice(0, 400).map((entry) => (
          <li key={entry.email}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-200",
                selected.has(entry.email) && "shadow-raised-sm",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(entry.email)}
                onChange={() => toggle(entry.email)}
                className="size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="ltr-inline block truncate text-sm text-foreground">
                  {entry.email}
                </span>
                {entry.org && (
                  <span className="block truncate text-xs text-muted">
                    {entry.org}
                    {entry.city ? ` · ${entry.city}` : ""}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-1.5">
                {(entry.flags ?? []).map((flag) => (
                  <span
                    key={flag}
                    title={t(`flags.${flag}`)}
                    className="text-[10px] font-semibold"
                    style={{ color: FLAG_COLOR[flag] }}
                  >
                    {t(`flags.${flag}`)}
                  </span>
                ))}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={selected.size === 0}
        onClick={() => {
          const chosen = new Map(
            list.entries.map((entry) => [entry.email, entry] as const),
          );
          onAdd(
            [...selected].map((email) => toRecipient(chosen.get(email), email)),
          );
          setSelected(new Set());
        }}
        className="btn btn-primary mt-6"
      >
        {t("add", { count: format.number(selected.size) })}
      </button>
    </div>
  );
}

function toRecipient(
  entry: BundledEntry | undefined,
  email: string,
): Recipient {
  const recipient: Recipient = { email };
  if (entry?.org) recipient.company = entry.org;
  if (entry?.city) recipient.city = entry.city;
  return recipient;
}
