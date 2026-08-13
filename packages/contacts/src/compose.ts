/**
 * Building the message and handing it to the user's own mail client.
 *
 * Nothing here sends anything. It produces a URL that opens a compose window
 * already filled in; the user reviews it and presses send themselves, from
 * their own mailbox. That is deliberate — mail leaves their address, lands in
 * their Sent folder, replies come back to them, and no credential of theirs is
 * ever stored anywhere.
 */

export interface ComposeInput {
  to?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

/**
 * `mailto:` cannot carry an attachment.
 *
 * RFC 6068 defines no attachment header, and mail clients ignore any `attach`
 * parameter that is bolted on. The CV therefore has to be added by hand in the
 * compose window that opens, and the UI has to say so plainly rather than let
 * someone send twenty applications with nothing attached.
 */
export const MAILTO_SUPPORTS_ATTACHMENTS = false;

/**
 * Ceiling for a `mailto:` URL on Windows.
 *
 * The binding constraint is not the browser but the OS protocol handler:
 * Windows caps the command line it hands to the mail client at roughly 2048
 * characters, and anything past that is truncated — silently, mid-address.
 * 1800 leaves room for the client's own wrapper.
 */
export const MAILTO_URL_BUDGET_WINDOWS = 1800;

/**
 * Ceiling elsewhere — macOS, Linux, Android, iOS.
 *
 * None of them route `mailto:` through a Windows-style command line, so the
 * 1800 figure does not apply to them. Applying it everywhere was a real bug:
 * it disabled the mail-app button for ordinary Arabic messages on phones,
 * where `mailto:` is the *only* thing that opens the installed mail app, and
 * left the user with two buttons that both did nothing.
 *
 * Still bounded rather than unlimited: handlers do have limits, they are just
 * not documented, and a truncated address is worse than a refused one.
 */
export const MAILTO_URL_BUDGET_DEFAULT = 8000;

/** Kept as the conservative default for callers that do not know the platform. */
export const MAILTO_URL_BUDGET = MAILTO_URL_BUDGET_WINDOWS;

export function mailtoBudgetFor(isWindows: boolean): number {
  return isWindows ? MAILTO_URL_BUDGET_WINDOWS : MAILTO_URL_BUDGET_DEFAULT;
}

/** Gmail's web compose is a normal URL, so the ceiling is the browser's. */
export const GMAIL_URL_BUDGET = 8000;

function encodeAddresses(addresses: readonly string[]): string {
  // Commas separate addresses and must stay literal; the addresses themselves
  // are percent-encoded.
  return addresses.map((address) => encodeURIComponent(address.trim())).join(",");
}

export function buildMailtoUrl(input: ComposeInput): string {
  const params: string[] = [];
  if (input.bcc?.length) params.push(`bcc=${encodeAddresses(input.bcc)}`);
  if (input.subject) params.push(`subject=${encodeURIComponent(input.subject)}`);
  if (input.body) params.push(`body=${encodeURIComponent(input.body)}`);

  const to = input.to?.length ? encodeAddresses(input.to) : "";
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${to}${query}`;
}

export function buildGmailUrl(input: ComposeInput): string {
  const params: string[] = ["view=cm", "fs=1"];
  if (input.to?.length) params.push(`to=${encodeAddresses(input.to)}`);
  if (input.bcc?.length) params.push(`bcc=${encodeAddresses(input.bcc)}`);
  if (input.subject) params.push(`su=${encodeURIComponent(input.subject)}`);
  if (input.body) params.push(`body=${encodeURIComponent(input.body)}`);

  return `https://mail.google.com/mail/?${params.join("&")}`;
}

// ---------------------------------------------------------------------------
// Merge fields
// ---------------------------------------------------------------------------

export const MERGE_FIELDS = ["company", "role", "name", "city"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

export interface RenderResult {
  text: string;
  /** Placeholders that had no value — the message is not ready to send. */
  unresolved: string[];
}

/**
 * Substitute `{{company}}`-style placeholders.
 *
 * Unresolved names are reported rather than blanked out. A template that
 * renders "Dear team at ," is worse than one that refuses to send.
 */
export function renderTemplate(
  template: string,
  values: Partial<Record<string, string>>,
): RenderResult {
  const unresolved: string[] = [];

  const text = template.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    if (value === undefined || value.trim() === "") {
      unresolved.push(name);
      return match;
    }
    return value;
  });

  return { text, unresolved: [...new Set(unresolved)] };
}

/** Does this template actually address the recipient, or is it a form letter? */
export function usesMergeFields(template: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(template);
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

export interface Batch {
  recipients: string[];
  /** The `mailto:` URL. */
  url: string;
  /** Length of the `mailto:` URL. */
  length: number;
  /** Length of the equivalent Gmail compose URL. */
  gmailLength: number;
  /**
   * Too long for `mailto:`, so the mail-app button cannot be used — but Gmail
   * and copy still can.
   *
   * This is routine for Arabic rather than exceptional: percent-encoding
   * inflates Arabic roughly fivefold against 1.4× for Latin, so an ordinary
   * three-paragraph Arabic message clears 1800 characters on its own, before a
   * single recipient is added. Chunking cannot help — the body is the problem —
   * so the answer is to steer to a transport that fits, not to refuse to send.
   */
  mailtoOverBudget: boolean;
  /**
   * Too long even for Gmail. Nothing can carry it, so this really does block.
   */
  overBudget: boolean;
}

export interface ChunkOptions {
  subject: string;
  body: string;
  /** Hard cap regardless of URL length. */
  maxPerBatch?: number;
  urlBudget?: number;
  /** Which URL shape to measure — the two have very different ceilings. */
  target?: "mailto" | "gmail";
  /**
   * The `mailto:` ceiling to judge against. Defaults to the Windows figure,
   * which is the strictest, so a caller that does not know the platform is
   * never told a message will fit when it might not.
   */
  mailtoBudget?: number;
}

/**
 * Split recipients into batches that each fit inside a usable URL.
 *
 * Measured against the real encoded URL rather than an estimate of it: Arabic
 * subject lines and bodies expand to nine characters per letter once
 * percent-encoded, so a message that looks short can blow the budget on its
 * own.
 */
export function chunkRecipients(
  emails: readonly string[],
  options: ChunkOptions,
): Batch[] {
  const target = options.target ?? "mailto";
  const build = target === "gmail" ? buildGmailUrl : buildMailtoUrl;
  const budget =
    options.urlBudget ??
    (target === "gmail"
      ? GMAIL_URL_BUDGET
      : (options.mailtoBudget ?? MAILTO_URL_BUDGET_WINDOWS));
  const maxPerBatch = options.maxPerBatch ?? 25;

  const batches: Batch[] = [];
  let current: string[] = [];

  const mailtoCeiling = options.mailtoBudget ?? MAILTO_URL_BUDGET_WINDOWS;

  const finalise = () => {
    if (current.length === 0) return;
    const input = { bcc: current, subject: options.subject, body: options.body };
    const mailto = buildMailtoUrl(input);
    const gmail = buildGmailUrl(input);

    batches.push({
      recipients: current,
      url: mailto,
      length: mailto.length,
      gmailLength: gmail.length,
      mailtoOverBudget: mailto.length > mailtoCeiling,
      overBudget: gmail.length > GMAIL_URL_BUDGET,
    });
    current = [];
  };

  for (const email of emails) {
    const candidate = [...current, email];
    const url = build({
      bcc: candidate,
      subject: options.subject,
      body: options.body,
    });

    const tooLong = url.length > budget && current.length > 0;
    const tooMany = candidate.length > maxPerBatch;

    if (tooLong || tooMany) {
      finalise();
      current = [email];
    } else {
      current = candidate;
    }
  }

  finalise();
  return batches;
}

// ---------------------------------------------------------------------------
// Address hygiene
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deduplicate case-insensitively, preserving the order they arrived in. */
export function dedupeEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const email of emails) {
    const key = normalizeEmail(email);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }

  return result;
}
