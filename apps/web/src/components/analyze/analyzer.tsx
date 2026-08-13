"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { analyze } from "@siyar/ats-core";
import { buildFixtureDocument } from "@siyar/ats-core/fixture";
import { GOOD_ARABIC_CV, GOOD_ENGLISH_CV } from "@siyar/ats-core/samples";
import { AnalysisError, analyzeFile, type Analysis } from "@/lib/analyzer";
import { ScoreReport } from "./score-report";
import { UploadDropzone } from "./upload-dropzone";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; analysis: Analysis }
  | { kind: "error"; code: string; params: Record<string, string | number> };

export function Analyzer() {
  const t = useTranslations("analyze");
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [jobDescription, setJobDescription] = useState("");
  const [, startTransition] = useTransition();

  const targetOptions = jobDescription.trim()
    ? { targetJobDescription: jobDescription }
    : {};

  async function run(file: File) {
    setState({ kind: "running" });
    try {
      const analysis = await analyzeFile(file, targetOptions);
      startTransition(() => setState({ kind: "done", analysis }));
    } catch (error) {
      const failure =
        error instanceof AnalysisError ? error : new AnalysisError("unreadable");
      setState({ kind: "error", code: failure.code, params: failure.params });
    }
  }

  /**
   * The example runs through the same rubric as a real upload — it only skips
   * the parser, since there is no file. Nothing about the scoring differs.
   */
  function runSample() {
    const sample = locale === "en" ? GOOD_ENGLISH_CV : GOOD_ARABIC_CV;
    const fileName =
      locale === "en" ? "sara-alotaibi-cv.pdf" : "ahmed-alqahtani-cv.pdf";
    const doc = buildFixtureDocument(sample, { fileName });

    setState({
      kind: "done",
      analysis: {
        report: analyze(doc, targetOptions),
        fileName,
        text: doc.text,
        pageCount: doc.pages.length,
      },
    });
  }

  if (state.kind === "done") {
    return (
      <div className="space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="btn"
          >
            {t("again")}
          </button>
        </div>
        <ScoreReport analysis={state.analysis} />
      </div>
    );
  }

  return (
    <div>
      <header className="text-center">
        <h1 className="font-display text-3xl text-foreground sm:text-4xl lg:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg text-muted">
          {t("subtitle")}
        </p>
      </header>

      <div className="mt-12">
        <UploadDropzone
          onFile={run}
          onSample={runSample}
          disabled={state.kind === "running"}
        />
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="neu-inset mt-8 rounded-2xl p-5 text-center font-medium text-[color:var(--color-danger)]"
        >
          {t(`errors.${state.code}`, state.params)}
        </p>
      )}

      {state.kind === "running" && (
        <p
          role="status"
          className="neu-inset mt-8 rounded-2xl p-5 text-center font-medium text-muted"
        >
          {t("analyzing")}
        </p>
      )}

      <div className="neu-card mt-12 p-8 sm:p-10">
        <label htmlFor="job-description" className="label">
          {t("jobDescription.label")}
        </label>
        <p className="mt-3 max-w-[64ch] text-sm text-muted">
          {t("jobDescription.hint")}
        </p>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          rows={6}
          placeholder={t("jobDescription.placeholder")}
          className="neu-input mt-5 resize-y"
        />
      </div>
    </div>
  );
}
