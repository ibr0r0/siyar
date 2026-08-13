import type { SenderProfile } from "@siyar/contacts";

/**
 * The sender's own details, kept in this browser.
 *
 * Local-first like everything else here: there is no account to hang it on,
 * and a name and phone number are exactly the sort of thing that should not be
 * sitting on someone else's server for a tool that does not need it.
 */

const KEY = "siyar.profile";

export const EMPTY_PROFILE: SenderProfile = { name: "", title: "" };

export function loadProfile(): SenderProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<SenderProfile>;
    return { ...EMPTY_PROFILE, ...parsed };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(profile: SenderProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage being full or disabled must not break the composer.
  }
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
