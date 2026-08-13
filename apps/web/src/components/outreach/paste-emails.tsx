"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { parseEmailList } from "@siyar/contacts";
import type { Recipient } from "./recipient-import";

/**
 * Adding addresses by hand.
 *
 * Most people do not have a CSV. They have a column copied out of a
 * spreadsheet, a few addresses from a WhatsApp message, or one they just
 * looked up. The parse is forgiving about separators and shows what it read
 * back before anything is added, because silently misreading a paste is how
 * mail reaches the wrong company.
 */
export function PasteEmails({
  onAdd,
}: {
  onAdd: (recipients: Recipient[]) => void;
}) {
  const t = useTranslations("outreach.paste");
  const format = useFormatter();
  const [text, setText] = useState("");

  const result = useMemo(() => parseEmailList(text), [text]);

  return (
    <div className="neu-card p-8">
      <h3 className="font-display text-lg text-foreground">{t("title")}</h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
        {t("hint")}
      </p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        dir="ltr"
        placeholder={t("placeholder")}
        className="neu-input mt-5 resize-y text-start font-mono text-sm"
        aria-label={t("title")}
      />

      {text.trim().length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="neu-pill text-[color:var(--color-success)]">
            {t("found", { count: format.number(result.emails.length) })}
          </span>
          {result.duplicates > 0 && (
            <span className="neu-pill text-muted">
              {t("duplicates", { count: format.number(result.duplicates) })}
            </span>
          )}
          {result.invalid.length > 0 && (
            <span className="neu-pill text-[color:var(--color-danger)]">
              {t("invalid", { count: format.number(result.invalid.length) })}
            </span>
          )}
        </div>
      )}

      {result.invalid.length > 0 && (
        <p className="neu-inset ltr-inline mt-4 rounded-2xl p-4 text-xs text-muted">
          {result.invalid.slice(0, 8).join("  ·  ")}
        </p>
      )}

      <button
        type="button"
        disabled={result.emails.length === 0}
        onClick={() => {
          onAdd(result.emails.map((email) => ({ email })));
          setText("");
        }}
        className="btn btn-primary mt-6"
      >
        {t("add", { count: format.number(result.emails.length) })}
      </button>
    </div>
  );
}
