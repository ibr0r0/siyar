"use client";

import { useTranslations } from "next-intl";
import { isProfileComplete, type SenderProfile } from "@siyar/contacts";

const FIELDS = [
  { key: "name", required: true, type: "text" },
  { key: "title", required: true, type: "text" },
  { key: "years", required: false, type: "text" },
  { key: "city", required: false, type: "text" },
  { key: "phone", required: false, type: "tel", ltr: true },
  { key: "linkedin", required: false, type: "text", ltr: true },
  { key: "cvUrl", required: false, type: "url", ltr: true },
] as const;

interface Props {
  profile: SenderProfile;
  onChange: (profile: SenderProfile) => void;
  onApplyDefault: () => void;
}

export function SenderProfileForm({ profile, onChange, onApplyDefault }: Props) {
  const t = useTranslations("outreach.profile");
  const complete = isProfileComplete(profile);

  return (
    <div className="neu-card p-8">
      <h3 className="font-display text-lg text-foreground">{t("title")}</h3>
      <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">
        {t("hint")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="label">
              {t(`fields.${field.key}`)}
              {!field.required && (
                <span className="ms-2 font-normal normal-case tracking-normal opacity-70">
                  {t("optional")}
                </span>
              )}
            </span>
            <input
              type={field.type}
              value={profile[field.key] ?? ""}
              required={field.required}
              // Latin-only values keep their own direction inside an RTL form,
              // otherwise a phone number renders with the country code at the
              // wrong end.
              dir={"ltr" in field && field.ltr ? "ltr" : undefined}
              onChange={(event) =>
                onChange({ ...profile, [field.key]: event.target.value })
              }
              placeholder={t(`placeholders.${field.key}`)}
              className="neu-input mt-2"
            />
          </label>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!complete}
          onClick={onApplyDefault}
          className="btn btn-primary"
        >
          {t("applyDefault")}
        </button>
        {!complete && (
          <span className="text-sm text-muted">{t("needNameAndTitle")}</span>
        )}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted">{t("storage")}</p>
    </div>
  );
}
