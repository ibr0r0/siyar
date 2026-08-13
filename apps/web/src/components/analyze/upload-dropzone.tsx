"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MAX_FILE_BYTES } from "@/lib/analyzer";
import { cn } from "@/lib/cn";

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
}

/**
 * The drop target is the deepest recess on the page — a well you drop a file
 * into. Dragging over it deepens the well further, so the affordance is carried
 * by depth rather than by a dashed border, which the system does not allow.
 */
export function UploadDropzone({ onFile, onSample, disabled }: Props) {
  const t = useTranslations("analyze.dropzone");
  const format = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={cn(
        "neu-well rounded-card p-10 text-center transition-all duration-300 sm:p-16",
        dragging && "scale-[0.995]",
        disabled && "opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Allow re-selecting the same file after a failed attempt.
          event.target.value = "";
        }}
      />

      <span
        aria-hidden
        className={cn(
          "mx-auto grid size-20 place-items-center rounded-full bg-background text-accent shadow-raised transition-transform duration-300",
          dragging ? "-translate-y-1 scale-105" : "animate-float",
        )}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <p className="font-display mt-7 text-xl text-foreground sm:text-2xl">
        {dragging ? t("active") : t("idle")}
      </p>
      <p className="mt-2 text-sm text-muted">
        {t("hint", { limitMb: format.number(limitMb) })}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="btn btn-primary"
        >
          {t("browse")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onSample}
          className="btn"
        >
          {t("sample")}
        </button>
      </div>
    </div>
  );
}
