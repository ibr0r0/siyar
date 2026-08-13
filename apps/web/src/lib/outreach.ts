/**
 * Local record of who has already been approached.
 *
 * Lives in `localStorage` — there is no account and no server, so this is this
 * browser's memory alone. Its only job is to stop the same employer being
 * written to twice; there is no volume counter, by design.
 *
 * Note what it can and cannot know: we hand a composed window to the user's
 * mail client and lose sight of it there, so an address is recorded when its
 * batch is *opened*, not when a message is actually sent.
 */

const CONTACTED_KEY = "siyar.outreach.contacted";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled storage must never break the sender itself.
  }
}

export function recordOpened(recipients: string[]): void {
  const contacted = new Set(read<string[]>(CONTACTED_KEY, []));
  for (const email of recipients) contacted.add(email);
  write(CONTACTED_KEY, [...contacted]);
}

export function alreadyContacted(): Set<string> {
  return new Set(read<string[]>(CONTACTED_KEY, []));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONTACTED_KEY);
}
