"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { MERGE_FIELDS, type SendMode } from "@siyar/contacts";
import { cn } from "@/lib/cn";

interface Props {
  mode: SendMode;
  onModeChange: (mode: SendMode) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
}

export function MessageComposer({
  mode,
  onModeChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
}: Props) {
  const t = useTranslations("outreach.compose");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /** Insert a placeholder where the cursor is, not at the end. */
  function insertField(field: string) {
    const element = bodyRef.current;
    const token = `{{${field}}}`;
    if (!element) {
      onBodyChange(`${body}${token}`);
      return;
    }
    const start = element.selectionStart ?? body.length;
    const end = element.selectionEnd ?? body.length;
    onBodyChange(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label">{t("modeLabel")}</p>
        <div
          className="neu-inset mt-3 inline-flex gap-1 rounded-full p-1.5"
          role="group"
        >
          {(["targeted", "batch"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => onModeChange(option)}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300",
                mode === option
                  ? "bg-background text-foreground shadow-raised-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {t(`mode.${option}`)}
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-[62ch] text-sm text-muted">
          {t(`modeHint.${mode}`)}
        </p>
      </div>

      <label className="block">
        <span className="label">{t("subject")}</span>
        <input
          type="text"
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          placeholder={t("subjectPlaceholder")}
          className="neu-input mt-3"
        />
      </label>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="label">{t("body")}</span>
          <div className="flex flex-wrap gap-2">
            {MERGE_FIELDS.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => insertField(field)}
                className="neu-pill transition-all duration-300 hover:shadow-raised-sm"
              >
                {`{{${field}}}`}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={bodyRef}
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          rows={10}
          placeholder={t("bodyPlaceholder")}
          className="neu-input mt-3 resize-y font-sans leading-relaxed"
        />
      </div>

      {/*
        The single most important sentence on this page. `mailto:` has no
        attachment parameter — RFC 6068 defines none and clients ignore any that
        is invented — so the CV must be dragged into the compose window that
        opens. Without saying so, someone sends twenty applications with nothing
        attached and never finds out.
      */}
      <p className="neu-inset rounded-2xl p-5 text-sm leading-relaxed text-foreground">
        <span className="font-semibold">{t("attachTitle")}</span>{" "}
        {t("attachBody")}
      </p>
    </div>
  );
}
