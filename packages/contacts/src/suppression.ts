import { normalizeEmail } from "./compose";

/**
 * The permanent do-not-contact list.
 *
 * Stored as SHA-256 of the lowercased address, never the address itself:
 * honouring a removal request must not republish the address someone asked to
 * have taken down. It also means the list can live in a public repository
 * without becoming a mailing list of its own.
 *
 * `crypto.subtle` is used so the same code runs in the browser and in the CI
 * validator, which is why the API is async.
 */

export async function hashEmail(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashEmails(
  emails: readonly string[],
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    emails.map(async (email) => [normalizeEmail(email), await hashEmail(email)] as const),
  );
  return new Map(entries);
}

/**
 * Remove every suppressed address from a list.
 *
 * Always applied last, after import and after directory selection, so that no
 * path into the sender can bypass it — including a well-meaning contributor
 * re-adding a removed address to the directory from a public page.
 */
export async function removeSuppressed(
  emails: readonly string[],
  suppressedHashes: readonly string[],
): Promise<{ allowed: string[]; removed: string[] }> {
  const blocked = new Set(suppressedHashes);
  const hashes = await hashEmails(emails);

  const allowed: string[] = [];
  const removed: string[] = [];

  for (const email of emails) {
    const key = normalizeEmail(email);
    const hash = hashes.get(key);
    if (hash && blocked.has(hash)) removed.push(key);
    else allowed.push(key);
  }

  return { allowed, removed };
}
