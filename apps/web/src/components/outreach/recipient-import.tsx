"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  dedupeEmails,
  guessMapping,
  isValidEmail,
  parseCsv,
  toSheet,
  type Sheet,
} from "@siyar/contacts";
import { cn } from "@/lib/cn";

export interface Recipient {
  email: string;
  company?: string;
  role?: string;
  name?: string;
  city?: string;
}

export interface ImportSummary {
  recipients: Recipient[];
  totalRows: number;
  invalid: number;
  duplicates: number;
}

const FIELDS = ["email", "org", "role", "name", "city"] as const;
type Field = (typeof FIELDS)[number];

export function RecipientImport({
  onImport,
}: {
  onImport: (summary: ImportSummary) => void;
}) {
  const t = useTranslations("outreach.import");
  const format = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File) {
    setError(null);
    try {
      const parsed = toSheet(parseCsv(await file.text()));
      if (parsed.rows.length === 0) {
        setError(t("empty"));
        return;
      }
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers));
    } catch {
      setError(t("unreadable"));
    }
  }

  function confirm() {
    if (!sheet) return;
    const emailColumn = mapping.email;
    if (emailColumn === undefined) {
      setError(t("needEmailColumn"));
      return;
    }

    const cell = (row: string[], field: Field) => {
      const index = mapping[field];
      return index === undefined ? undefined : row[index]?.trim() || undefined;
    };

    const rows = sheet.rows;
    const valid: Recipient[] = [];
    let invalid = 0;

    for (const row of rows) {
      const email = row[emailColumn]?.trim() ?? "";
      if (!isValidEmail(email)) {
        invalid++;
        continue;
      }
      valid.push({
        email: email.toLowerCase(),
        company: cell(row, "org"),
        role: cell(row, "role"),
        name: cell(row, "name"),
        city: cell(row, "city"),
      });
    }

    // Dedupe on the address, keeping the first row's merge values.
    const unique = dedupeEmails(valid.map((entry) => entry.email));
    const byEmail = new Map(valid.map((entry) => [entry.email, entry]));
    const recipients = unique
      .map((email) => byEmail.get(email))
      .filter((entry) => entry !== undefined);

    onImport({
      recipients,
      totalRows: rows.length,
      invalid,
      duplicates: valid.length - recipients.length,
    });
    setSheet(null);
  }

  if (sheet) {
    return (
      <div className="neu-card p-8">
        <h3 className="font-display text-lg text-foreground">{t("mapTitle")}</h3>
        <p className="mt-2 text-sm text-muted">{t("mapHint")}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field} className="block">
              <span className="label">{t(`fields.${field}`)}</span>
              <select
                value={mapping[field] ?? ""}
                onChange={(event) =>
                  setMapping((current) => {
                    const next = { ...current };
                    if (event.target.value === "") delete next[field];
                    else next[field] = Number(event.target.value);
                    return next;
                  })
                }
                className="neu-input mt-2 appearance-none"
              >
                <option value="">{t("noColumn")}</option>
                {sheet.headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={index}>
                    {header || `#${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {/* A preview, because a wrong column mapping is invisible until mail
            goes out addressed to a city name. */}
        <div className="neu-inset mt-6 overflow-x-auto rounded-2xl p-5">
          <p className="label">{t("preview")}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {sheet.rows.slice(0, 3).map((row, index) => (
              <li key={index} className="ltr-inline">
                {mapping.email !== undefined ? row[mapping.email] : "—"}
                {mapping.org !== undefined && ` · ${row[mapping.org]}`}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[color:var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-4">
          <button type="button" onClick={confirm} className="btn btn-primary">
            {t("confirm", { count: format.number(sheet.rows.length) })}
          </button>
          <button type="button" onClick={() => setSheet(null)} className="btn">
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void readFile(file);
      }}
      className={cn(
        "neu-well rounded-card p-10 text-center transition-all duration-300",
        dragging && "scale-[0.995]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.tsv,text/tab-separated-values"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
          event.target.value = "";
        }}
      />

      <p className="font-display text-xl text-foreground">{t("idle")}</p>
      <p className="mt-2 text-sm text-muted">{t("hint")}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn btn-primary mt-7"
      >
        {t("browse")}
      </button>

      {error && (
        <p role="alert" className="mt-4 text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
