import { assembleBody, signatureLines, type SenderProfile } from "@siyar/contacts";

/**
 * Build the starting message from the sender's profile.
 *
 * The sentences arrive already translated and already interpolated by
 * next-intl, so this only decides which blocks exist and in what order. The
 * sender's own details are written in as literal text; `{{company}}` is the
 * only placeholder that survives, because it is the only value that changes
 * per recipient — and leaving the optional ones as placeholders would trip the
 * unresolved-field guardrail for anyone who left a field blank.
 */
export interface TemplateSentences {
  greeting: string;
  intro: string;
  /** Only supplied when the profile states years of experience. */
  experience?: string;
  attachment: string;
  cvLink?: string;
  closing: string;
  signOff: string;
}

export interface DefaultTemplate {
  subject: string;
  body: string;
}

export function buildDefaultTemplate(
  profile: SenderProfile,
  sentences: TemplateSentences,
  subject: string,
): DefaultTemplate {
  return {
    subject,
    body: assembleBody([
      sentences.greeting,
      sentences.intro,
      sentences.experience,
      sentences.attachment,
      sentences.cvLink,
      sentences.closing,
      [sentences.signOff, ...signatureLines(profile)].join("\n"),
    ]),
  };
}
