import { usesMergeFields } from "./compose";

/**
 * What stops this from being a mass-mailer.
 *
 * The `mailto:` design already removes most of the risk — nothing leaves the
 * machine without the user personally pressing send in their own client. These
 * are the remaining checks, and they exist for the user's benefit as much as
 * the recipients': a mailbox provider that sees five hundred identical BCC'd
 * messages in an afternoon suspends the account sending them.
 */

/** Conservative enough to keep a personal mailbox out of trouble. */
export const DEFAULT_DAILY_CAP = 50;

export type SendMode = "targeted" | "batch";

export interface ReadinessInput {
  mode: SendMode;
  subject: string;
  body: string;
  template: string;
  recipientCount: number;
  /** How many this mailbox has already been given today. */
  sentToday: number;
  dailyCap?: number;
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
  | "dailyCapReached"
  | "unresolvedFields"
  | "urlTooLong"
  | "notPersonalised"
  | "genericCompany"
  | "mailAppUnavailable";

export interface Readiness {
  ok: boolean;
  blockers: BlockerCode[];
  warnings: BlockerCode[];
  remainingToday: number;
}

export function checkReadiness(input: ReadinessInput): Readiness {
  const cap = input.dailyCap ?? DEFAULT_DAILY_CAP;
  const remainingToday = Math.max(0, cap - input.sentToday);

  const blockers: BlockerCode[] = [];
  const warnings: BlockerCode[] = [];

  if (input.recipientCount === 0) blockers.push("noRecipients");
  if (input.subject.trim().length === 0) blockers.push("noSubject");
  if (input.body.trim().length === 0) blockers.push("noBody");
  if (remainingToday === 0) blockers.push("dailyCapReached");
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

  return { ok: blockers.length === 0, blockers, warnings, remainingToday };
}

/** Local-day key for the send counter, so the cap resets at midnight. */
export function todayKey(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
