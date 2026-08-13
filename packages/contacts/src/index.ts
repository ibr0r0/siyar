import directoryData from "../data/directory.json";
import suppressionData from "../data/suppression.json";
import saudiCompanies from "../data/bundled/saudi-companies.json";
import {
  bundledListSchema,
  directorySchema,
  suppressionSchema,
  type BundledList,
  type Contact,
} from "./schema";

export {
  bundledEntrySchema,
  bundledListSchema,
  contactSchema,
  directorySchema,
  ENTRY_FLAGS,
  suppressionSchema,
  type BundledEntry,
  type BundledList,
  type Contact,
  type EntryFlag,
  type ImportedContact,
  type Suppression,
} from "./schema";

export { parseEmailList, type PasteResult } from "./paste";

export {
  assembleBody,
  isProfileComplete,
  signatureLines,
  type SenderProfile,
} from "./template";

export {
  EMAIL_PATTERN,
  guessMapping,
  isValidEmail,
  parseCsv,
  toSheet,
  type Row,
  type Sheet,
} from "./csv";

export {
  buildGmailUrl,
  buildMailtoUrl,
  chunkRecipients,
  dedupeEmails,
  GMAIL_URL_BUDGET,
  MAILTO_SUPPORTS_ATTACHMENTS,
  MAILTO_URL_BUDGET,
  MERGE_FIELDS,
  normalizeEmail,
  renderTemplate,
  usesMergeFields,
  type Batch,
  type ChunkOptions,
  type ComposeInput,
  type MergeField,
  type RenderResult,
} from "./compose";

export { hashEmail, hashEmails, removeSuppressed } from "./suppression";

export {
  checkReadiness,
  DEFAULT_DAILY_CAP,
  todayKey,
  type BlockerCode,
  type Readiness,
  type ReadinessInput,
  type SendMode,
} from "./guardrails";

/**
 * The community directory.
 *
 * Ships empty on purpose. Every record must carry a `sourceUrl` pointing at a
 * page the organisation itself published, and there is no honest way to
 * populate that by generating addresses — an invented `careers@` that happens
 * to bounce, or worse, happens to reach someone, is exactly the failure this
 * project exists to avoid. Entries arrive by pull request with their source,
 * and CI rejects any that do not. Until then, importing your own CSV is the
 * supported path, and the UI says so.
 */
export const directory: Contact[] = directorySchema.parse(directoryData);

export const suppression = suppressionSchema.parse(suppressionData);

/**
 * Third-party compiled lists.
 *
 * A separate tier from `directory`, and never merged into it. These are bulk
 * lists nobody has verified entry by entry, so every surface that shows them
 * has to say so — the value of the curated directory's per-record source
 * guarantee depends entirely on not quietly diluting it with these.
 */
export const bundledLists: BundledList[] = [
  bundledListSchema.parse(saudiCompanies),
];

export function bundledListById(id: string): BundledList | undefined {
  return bundledLists.find((list) => list.id === id);
}

/** Facets for filtering a bundled list in the UI. */
export function bundledFacets(list: BundledList) {
  const cities = new Set<string>();
  const sectors = new Set<string>();
  const flags = new Set<string>();

  for (const entry of list.entries) {
    if (entry.city) cities.add(entry.city);
    if (entry.sector) sectors.add(entry.sector);
    for (const flag of entry.flags ?? []) flags.add(flag);
  }

  return {
    cities: [...cities].sort(),
    sectors: [...sectors].sort(),
    flags: [...flags].sort(),
    total: list.entries.length,
    hiring: list.entries.filter((entry) => entry.flags?.includes("hiring")).length,
  };
}

export interface DirectoryFilter {
  city?: string;
  sector?: string;
  query?: string;
}

export function filterDirectory(
  contacts: readonly Contact[],
  filter: DirectoryFilter,
): Contact[] {
  const query = filter.query?.trim().toLowerCase();

  return contacts.filter((contact) => {
    if (filter.city && contact.city !== filter.city) return false;
    if (filter.sector && contact.sector !== filter.sector) return false;
    if (query) {
      const haystack = `${contact.org} ${contact.email} ${contact.city ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function directoryFacets(contacts: readonly Contact[]) {
  const cities = new Set<string>();
  const sectors = new Set<string>();

  for (const contact of contacts) {
    if (contact.city) cities.add(contact.city);
    if (contact.sector) sectors.add(contact.sector);
  }

  return {
    cities: [...cities].sort(),
    sectors: [...sectors].sort(),
  };
}
