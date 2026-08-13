import { todayKey } from "@siyar/contacts";

/**
 * Local record of outreach activity.
 *
 * Two honest limits are baked in here. First, everything lives in
 * `localStorage` — there is no account and no server, so the history is this
 * browser's alone. Second, we cannot know whether a message was actually sent:
 * we hand a composed window to the user's mail client and lose sight of it
 * there. What is counted is *batches opened*, and the UI is worded that way
 * rather than claiming a delivery it cannot observe.
 */

const OPENED_KEY = "siyar.outreach.opened";
const CONTACTED_KEY = "siyar.outreach.contacted";

interface OpenedLog {
  /** Local date → number of recipients in batches opened that day. */
  [day: string]: number;
}

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

export function openedToday(now = new Date()): number {
  const log = read<OpenedLog>(OPENED_KEY, {});
  return log[todayKey(now)] ?? 0;
}

export function recordOpened(recipients: string[], now = new Date()): void {
  const day = todayKey(now);
  const log = read<OpenedLog>(OPENED_KEY, {});
  log[day] = (log[day] ?? 0) + recipients.length;

  // Keep a fortnight; the counter only needs today, the rest is for the user's
  // own sense of pace.
  const cutoff = new Date(now.getTime() - 14 * 86_400_000);
  const keepFrom = todayKey(cutoff);
  for (const key of Object.keys(log)) if (key < keepFrom) delete log[key];

  write(OPENED_KEY, log);

  // Remember who has already been approached so the next import can skip them.
  const contacted = new Set(read<string[]>(CONTACTED_KEY, []));
  for (const email of recipients) contacted.add(email);
  write(CONTACTED_KEY, [...contacted]);
}

export function alreadyContacted(): Set<string> {
  return new Set(read<string[]>(CONTACTED_KEY, []));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OPENED_KEY);
  window.localStorage.removeItem(CONTACTED_KEY);
}
