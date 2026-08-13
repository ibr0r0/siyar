"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  buildGmailUrl,
  buildMailtoUrl,
  GMAIL_URL_BUDGET,
  MAILTO_URL_BUDGET,
  type Batch,
} from "@siyar/contacts";
import { cn } from "@/lib/cn";

interface Props {
  batches: Batch[];
  subject: string;
  body: string;
  opened: Set<number>;
  onOpen: (index: number, recipients: string[]) => void;
}

export function BatchList({ batches, subject, body, opened, onOpen }: Props) {
  const t = useTranslations("outreach.send");
  const format = useFormatter();
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, token: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <ul className="space-y-6">
      {batches.map((batch, index) => {
        const isOpen = opened.has(index);
        const overMailto = batch.mailtoOverBudget;
        // Once mailto is out of the picture, showing its ceiling is misleading;
        // measure against the transport that will actually be used.
        const ceiling = overMailto ? GMAIL_URL_BUDGET : MAILTO_URL_BUDGET;
        const measured = overMailto ? batch.gmailLength : batch.length;
        const usage = Math.min(100, (measured / ceiling) * 100);
        const gmailUrl = buildGmailUrl({
          bcc: batch.recipients,
          subject,
          body,
        });
        const mailtoUrl = buildMailtoUrl({
          bcc: batch.recipients,
          subject,
          body,
        });

        return (
          <li key={index} className="neu-card p-7">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                aria-hidden
                className="neu-well grid size-11 shrink-0 place-items-center font-display text-sm text-accent"
              >
                {format.number(index + 1)}
              </span>
              <h3 className="font-display text-base text-foreground">
                {t("batch", {
                  count: format.number(batch.recipients.length),
                })}
              </h3>
              {isOpen && (
                <span className="neu-pill text-[color:var(--color-success)]">
                  {t("opened")}
                </span>
              )}
            </div>

            {/*
              The length meter is not decoration. A `mailto:` URL past roughly
              2048 characters is truncated by the OS protocol handler, silently
              and mid-address, so the user must see the headroom before they
              click rather than discover a mangled recipient afterwards.
            */}
            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between text-xs text-muted">
                <span>{t("urlLength")}</span>
                <span className="font-display">
                  {format.number(measured)} / {format.number(ceiling)}
                </span>
              </div>
              <div className="neu-track">
                <div
                  className="neu-track-fill"
                  style={{
                    width: `${Math.max(2, usage)}%`,
                    background: batch.overBudget
                      ? "var(--color-danger)"
                      : usage > 85
                        ? "var(--color-warning)"
                        : "var(--color-success)",
                  }}
                />
              </div>
            </div>

            {batch.overBudget ? (
              <p
                role="alert"
                className="neu-inset mt-4 rounded-2xl p-4 text-sm text-[color:var(--color-danger)]"
              >
                {t("overBudget")}
              </p>
            ) : batch.mailtoOverBudget ? (
              /* Only the mail-app route is closed. Say which one and why,
                 rather than greying out a button with no explanation. */
              <p className="neu-inset mt-4 rounded-2xl p-4 text-sm text-[color:var(--color-warning)]">
                {t("mailtoTooLong")}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={gmailUrl}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => onOpen(index, batch.recipients)}
                className={cn("btn btn-primary text-sm", batch.overBudget && "pointer-events-none opacity-50")}
              >
                {t("openGmail")}
              </a>
              <a
                href={mailtoUrl}
                onClick={() => onOpen(index, batch.recipients)}
                className={cn(
                  "btn text-sm",
                  (batch.overBudget || batch.mailtoOverBudget) &&
                    "pointer-events-none opacity-50",
                )}
              >
                {t("openMailApp")}
              </a>

              {/* Always available: if both handlers fail — no default client,
                  a locked-down browser — copy still works. */}
              <button
                type="button"
                onClick={() => copy(batch.recipients.join(", "), `bcc-${index}`)}
                className="btn text-sm"
              >
                {copied === `bcc-${index}` ? t("copied") : t("copyBcc")}
              </button>
              <button
                type="button"
                onClick={() => copy(body, `body-${index}`)}
                className="btn text-sm"
              >
                {copied === `body-${index}` ? t("copied") : t("copyBody")}
              </button>
            </div>

            <details className="mt-5">
              <summary className="cursor-pointer text-sm text-muted">
                {t("showRecipients")}
              </summary>
              <p className="ltr-inline neu-inset mt-3 max-h-40 overflow-y-auto rounded-2xl p-4 text-xs leading-relaxed text-muted">
                {batch.recipients.join(", ")}
              </p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
