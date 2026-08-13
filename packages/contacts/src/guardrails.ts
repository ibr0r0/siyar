import { usesMergeFields } from "./compose";

/**
 * Checks run before a batch can be opened.
 *
 * The `mailto:` design carries most of the safety by itself — nothing leaves
 * the machine without the user personally pressing send in their own client.
 * What remains here is about the message being fit to send: addressed to
 * someone, with a subject and a body, and short enough for a transport that
 * can carry it.
 *
 * There is no volume cap. One was removed at the project owner's request; the
 * dedupe against already-contacted addresses is a separate guardrail and still
 * applies, so the same employer is not written to twice.
 */

export type SendMode = "targeted" | "batch";

export interface ReadinessInput {
  mode: SendMode;
  subject: string;
  body: string;
  template: string;
  recipientCount: number;
  /** Placeholders left unfilled after merging. */
  unresolved: string[];
  /** Batches too long for every transport, including Gmail. Blocking. */
  overBudgetBatches: number;
  /**
   * Batches too long for `mailto:` but fine in Gmail — the norm for Arabic,
   * which percent-encodes about five times its character count.
   */
  mailtoOverBudgetBatches?: number;
  /**
   * Recipients for whom no organisation name was known, so the message falls
   * back to neutral wording ("your company") in place of `{{company}}`.
   */
  genericCompanyCount?: number;
}

export type BlockerCode =
  | "noRecipients"
  | "noSubject"
  | "noBody"
  | "unresolvedFields"
  | "urlTooLong"
  | "notPersonalised"
  | "genericCompany"
  | "mailAppUnavailable";

export interface Readiness {
  ok: boolean;
  blockers: BlockerCode[];
  warnings: BlockerCode[];
}

export function checkReadiness(input: ReadinessInput): Readiness {
  const blockers: BlockerCode[] = [];
  const warnings: BlockerCode[] = [];

  if (input.recipientCount === 0) blockers.push("noRecipients");
  if (input.subject.trim().length === 0) blockers.push("noSubject");
  if (input.body.trim().length === 0) blockers.push("noBody");
  if (input.overBudgetBatches > 0) blockers.push("urlTooLong");

  // Only the mail-app button is unusable here. Blocking the send would refuse
  // a message that Gmail and copy-paste carry perfectly well.
  if (
    input.overBudgetBatches === 0 &&
    (input.mailtoOverBudgetBatches ?? 0) > 0
  ) {
    warnings.push("mailAppUnavailable");
  }

  // In targeted mode a placeholder that never resolved would go out literally,
  // addressing someone as "{{company}}".
  if (input.mode === "targeted" && input.unresolved.length > 0) {
    blockers.push("unresolvedFields");
  }

  // A batch with no merge fields at all is the same letter to everyone. It is
  // allowed — sometimes that is genuinely what someone wants — but it is the
  // single biggest reason outreach gets ignored, so it is said out loud.
  if (input.mode === "batch" && !usesMergeFields(input.template)) {
    warnings.push("notPersonalised");
  }

  // Pasted addresses carry no organisation name, so the letter falls back to
  // neutral wording. That must not block — it is the commonest way people add
  // recipients — but they should know how many will read as generic.
  if ((input.genericCompanyCount ?? 0) > 0) warnings.push("genericCompany");

  return { ok: blockers.length === 0, blockers, warnings };
}

