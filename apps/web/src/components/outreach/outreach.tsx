"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  checkReadiness,
  chunkRecipients,
  DEFAULT_DAILY_CAP,
  renderTemplate,
  removeSuppressed,
  suppression,
  type SenderProfile,
  type SendMode,
} from "@siyar/contacts";
import { alreadyContacted, openedToday, recordOpened } from "@/lib/outreach";
import { buildDefaultTemplate } from "@/lib/default-template";
import { EMPTY_PROFILE, loadProfile, saveProfile } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { BatchList } from "./batch-list";
import { MessageComposer } from "./message-composer";
import { SenderProfileForm } from "./sender-profile-form";
import { BundledListBrowser } from "./bundled-list-browser";
import { PasteEmails } from "./paste-emails";
import { RecipientImport, type ImportSummary, type Recipient } from "./recipient-import";

const STEPS = ["recipients", "message", "send"] as const;
type Step = (typeof STEPS)[number];

export function Outreach() {
  const t = useTranslations("outreach");
  const tpl = useTranslations("outreach.template");
  const format = useFormatter();

  const [step, setStep] = useState<Step>("recipients");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [suppressed, setSuppressed] = useState(0);
  const [contactedSkipped, setContactedSkipped] = useState(0);

  const [mode, setMode] = useState<SendMode>("targeted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [sentToday, setSentToday] = useState(0);
  const [profile, setProfile] = useState<SenderProfile>(EMPTY_PROFILE);

  useEffect(() => {
    setSentToday(openedToday());
    setProfile(loadProfile());
  }, []);

  function updateProfile(next: SenderProfile) {
    setProfile(next);
    saveProfile(next);
  }

  /**
   * Fill the composer from the profile.
   *
   * Overwrites whatever is there, which is why it is an explicit button rather
   * than something that runs whenever the profile changes — silently replacing
   * a message someone has been editing would be worse than making them ask.
   */
  function applyDefaultTemplate() {
    const years = profile.years?.trim();
    const cvUrl = profile.cvUrl?.trim();

    const template = buildDefaultTemplate(
      profile,
      {
        greeting: tpl("greeting"),
        intro: tpl("intro", { name: profile.name, title: profile.title }),
        ...(years ? { experience: tpl("experience", { years }) } : {}),
        attachment: tpl("attachment"),
        ...(cvUrl ? { cvLink: tpl("cvLink", { url: cvUrl }) } : {}),
        closing: tpl("closing"),
        signOff: tpl("signOff"),
      },
      tpl("subject", { title: profile.title }),
    );

    setSubject(template.subject);
    setBody(template.body);
  }

  /**
   * The single gate every recipient passes through, whichever door they came
   * in by — CSV, paste, or a bundled list.
   *
   * Suppression is applied here and nowhere else, so no future source can
   * bypass it by accident. Already-contacted addresses are dropped too, which
   * is what stops someone mailing the same employer four times across a week.
   */
  async function addRecipients(incoming: Recipient[]): Promise<number> {
    const { allowed, removed } = await removeSuppressed(
      incoming.map((entry) => entry.email),
      suppression.hashes,
    );

    const contacted = alreadyContacted();
    const allowedSet = new Set(allowed);

    setRecipients((current) => {
      const existing = new Set(current.map((entry) => entry.email));
      const kept = incoming.filter(
        (entry) =>
          allowedSet.has(entry.email) &&
          !contacted.has(entry.email) &&
          !existing.has(entry.email),
      );
      return [...current, ...kept];
    });

    const blocked = incoming.filter(
      (entry) => !allowedSet.has(entry.email) || contacted.has(entry.email),
    ).length;

    setSuppressed((current) => current + removed.length);
    setContactedSkipped((current) => current + blocked - removed.length);
    return blocked;
  }

  async function handleImport(imported: ImportSummary) {
    await addRecipients(imported.recipients);
    setSummary(imported);
    // Deliberately does not advance. Rows get dropped here — invalid
    // addresses, duplicates, suppressed and already-contacted ones — and
    // skipping straight to the composer would hide that a list of 50 quietly
    // became 34. The user reads the summary and moves on themselves.
  }

  /**
   * Targeted mode sends one message per employer, merged with that employer's
   * details. Batch mode BCCs everyone the same letter. Both go through the same
   * chunker so the URL ceiling is enforced identically.
   */
  const { batches, unresolved, genericCompanyCount } = useMemo(() => {
    if (recipients.length === 0) {
      return { batches: [], unresolved: [], genericCompanyCount: 0 };
    }

    if (mode === "targeted") {
      const missing = new Set<string>();
      let generic = 0;
      const result = recipients.flatMap((recipient) => {
        // A pasted address has no organisation name. Leaving {{company}}
        // unresolved would block sending outright, so it falls back to neutral
        // wording that still reads like a real letter — and the count is
        // surfaced so nobody is surprised by how it went out.
        const company = recipient.company?.trim() || tpl("genericCompany");
        if (!recipient.company?.trim()) generic++;
        const rendered = renderTemplate(body, {
          company,
          role: recipient.role,
          name: recipient.name,
          city: recipient.city,
        });
        const renderedSubject = renderTemplate(subject, {
          company,
          role: recipient.role,
          name: recipient.name,
          city: recipient.city,
        });
        for (const field of [...rendered.unresolved, ...renderedSubject.unresolved]) {
          missing.add(field);
        }
        return chunkRecipients([recipient.email], {
          subject: renderedSubject.text,
          body: rendered.text,
          maxPerBatch: 1,
        });
      });
      return { batches: result, unresolved: [...missing], genericCompanyCount: generic };
    }

    // In batch mode there is no single recipient to merge against, so any
    // placeholder left in the template would go out literally.
    const rendered = renderTemplate(body, {});
    return {
      batches: chunkRecipients(
        recipients.map((entry) => entry.email),
        { subject, body: rendered.text, maxPerBatch: 25 },
      ),
      unresolved: rendered.unresolved,
      genericCompanyCount: 0,
    };
  }, [recipients, mode, subject, body, tpl]);

  const readiness = checkReadiness({
    mode,
    subject,
    body,
    template: body,
    recipientCount: recipients.length,
    sentToday,
    unresolved,
    overBudgetBatches: batches.filter((batch) => batch.overBudget).length,
    mailtoOverBudgetBatches: batches.filter((batch) => batch.mailtoOverBudget)
      .length,
    genericCompanyCount,
  });

  function handleOpen(index: number, batchRecipients: string[]) {
    recordOpened(batchRecipients);
    setSentToday(openedToday());
    setOpened((current) => new Set(current).add(index));
  }

  return (
    <div className="space-y-12">
      <ol className="flex flex-wrap gap-3">
        {STEPS.map((name, index) => {
          const active = step === name;
          const reachable =
            name === "recipients" ||
            (name === "message" && recipients.length > 0) ||
            (name === "send" && recipients.length > 0 && readiness.ok);

          return (
            <li key={name}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(name)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300",
                  active
                    ? "bg-background text-foreground shadow-raised"
                    : "text-muted shadow-inset-sm",
                  !reachable && "opacity-40",
                )}
              >
                <span className="font-display">{format.number(index + 1)}</span>
                {t(`steps.${name}`)}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "recipients" && (
        <section className="space-y-8">
          <RecipientImport onImport={handleImport} />

          {(summary || recipients.length > 0) && (
            <div className="neu-card p-8">
              <h3 className="font-display text-lg text-foreground">
                {t("import.summaryTitle")}
              </h3>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["ready", recipients.length],
                  ["invalid", summary?.invalid ?? 0],
                  ["duplicates", summary?.duplicates ?? 0],
                  ["skipped", suppressed + contactedSkipped],
                ].map(([key, value]) => (
                  <div key={key as string}>
                    <dt className="label">{t(`import.stats.${key}`)}</dt>
                    <dd className="font-display mt-1 text-2xl text-foreground">
                      {format.number(value as number)}
                    </dd>
                  </div>
                ))}
              </dl>
              {contactedSkipped > 0 && (
                <p className="mt-5 text-sm text-muted">
                  {t("import.alreadyContacted", {
                    count: format.number(contactedSkipped),
                  })}
                </p>
              )}

              <button
                type="button"
                disabled={recipients.length === 0}
                onClick={() => setStep("message")}
                className="btn btn-primary mt-7"
              >
                {t("import.continue", {
                  count: format.number(recipients.length),
                })}
              </button>
            </div>
          )}

          <PasteEmails onAdd={(added) => void addRecipients(added)} />

          <BundledListBrowser onAdd={(added) => void addRecipients(added)} />

          {/*
            The curated directory ships empty, and saying so is better than an
            empty list the user reads as a loading bug.
          */}
          <div className="neu-inset rounded-card p-8">
            <h3 className="font-display text-base text-foreground">
              {t("directory.title")}
            </h3>
            <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted">
              {t("directory.empty")}
            </p>
            <a
              href="https://github.com/ibr0r0/siyar/blob/main/packages/contacts/data/LICENSE"
              target="_blank"
              rel="noreferrer noopener"
              className="btn mt-6 text-sm"
            >
              {t("directory.contribute")}
            </a>
          </div>
        </section>
      )}

      {step === "message" && (
        <section className="space-y-10">
          <SenderProfileForm
            profile={profile}
            onChange={updateProfile}
            onApplyDefault={applyDefaultTemplate}
          />

          <MessageComposer
            mode={mode}
            onModeChange={setMode}
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
          />

          <Guardrails readiness={readiness} />

          <button
            type="button"
            disabled={!readiness.ok}
            onClick={() => setStep("send")}
            className="btn btn-primary"
          >
            {t("toSend", { count: format.number(batches.length) })}
          </button>
        </section>
      )}

      {step === "send" && (
        <section className="space-y-8">
          <div className="neu-card p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="label">{t("send.capLabel")}</p>
              <p className="font-display text-lg text-foreground">
                {format.number(sentToday)} / {format.number(DEFAULT_DAILY_CAP)}
              </p>
            </div>
            <div className="neu-track mt-3">
              <div
                className="neu-track-fill"
                style={{
                  width: `${Math.min(100, (sentToday / DEFAULT_DAILY_CAP) * 100)}%`,
                  background:
                    sentToday >= DEFAULT_DAILY_CAP
                      ? "var(--color-danger)"
                      : "var(--color-accent)",
                }}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {t("send.capHint")}
            </p>
          </div>

          <BatchList
            batches={batches}
            subject={subject}
            body={body}
            opened={opened}
            onOpen={handleOpen}
          />
        </section>
      )}
    </div>
  );
}

function Guardrails({
  readiness,
}: {
  readiness: ReturnType<typeof checkReadiness>;
}) {
  const t = useTranslations("outreach.guardrails");

  if (readiness.blockers.length === 0 && readiness.warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {readiness.blockers.map((code) => (
        <p
          key={code}
          role="alert"
          className="neu-inset rounded-2xl p-5 text-sm font-medium text-[color:var(--color-danger)]"
        >
          {t(code)}
        </p>
      ))}
      {readiness.warnings.map((code) => (
        <p
          key={code}
          className="neu-inset rounded-2xl p-5 text-sm text-[color:var(--color-warning)]"
        >
          {t(code)}
        </p>
      ))}
    </div>
  );
}
