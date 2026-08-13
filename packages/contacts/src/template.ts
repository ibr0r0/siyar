/**
 * Assembling the default message from the sender's own details.
 *
 * The sender's name, title and contact lines are substituted **now**, when the
 * template is generated, rather than left as merge fields. Only `{{company}}`
 * survives into the template, because that is the one value that genuinely
 * varies per recipient.
 *
 * The reason is the guardrail: an unresolved placeholder blocks sending, and
 * every optional detail someone leaves blank — no LinkedIn, no years of
 * experience — would otherwise sit unresolved in the body and stop them. Baking
 * the sender's details in means a half-filled profile still produces a message
 * that reads correctly; the blank lines simply are not there.
 */

export interface SenderProfile {
  /** Required — the message is signed with it. */
  name: string;
  /** Required — the specialism or job title being applied for. */
  title: string;
  years?: string;
  city?: string;
  phone?: string;
  linkedin?: string;
  /** A link to a hosted CV, for the many clients that cannot attach one. */
  cvUrl?: string;
}

export function isProfileComplete(profile: SenderProfile): boolean {
  return profile.name.trim().length > 0 && profile.title.trim().length > 0;
}

/**
 * Join prepared blocks into a body.
 *
 * Blocks are already-localised sentences; anything empty is dropped so an
 * unfilled optional field leaves no gap, and runs of blank lines are collapsed
 * so the result never arrives with a hole in the middle of it.
 */
export function assembleBody(
  blocks: ReadonlyArray<string | undefined | null>,
): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const text = block?.trim();
    if (!text) continue;
    // A block may itself be multi-line (a signature, say).
    for (const line of text.split("\n")) lines.push(line.trimEnd());
    lines.push("");
  }

  // Drop the trailing separator, then collapse any doubled blanks.
  while (lines.at(-1) === "") lines.pop();

  return lines
    .filter((line, index) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

/** The contact lines under the signature, in the order people expect them. */
export function signatureLines(profile: SenderProfile): string[] {
  return [profile.name, profile.phone, profile.linkedin, profile.cvUrl]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}
