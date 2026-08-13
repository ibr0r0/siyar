import { z } from "zod";

/**
 * A recruitment address an organisation has published itself.
 *
 * `sourceUrl` and `lastVerified` are required, and CI rejects any record
 * missing them. That is the whole safeguard: an entry nobody can trace back to
 * a page the organisation actually published is indistinguishable from a
 * scraped or purchased one, and this directory must never become either.
 */
export const contactSchema = z.object({
  /** Lowercased. Role addresses only — never a named individual's mailbox. */
  email: z
    .string()
    .email()
    .refine((value) => value === value.toLowerCase(), {
      message: "email must be lowercase",
    }),
  /** The organisation, as it writes its own name. */
  org: z.string().min(2),
  city: z.string().min(2).optional(),
  country: z.string().length(2).optional(),
  sector: z.string().min(2).optional(),
  /** The organisation's own page where this address is published. */
  sourceUrl: z.string().url(),
  /** ISO date the source was last checked. */
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type Contact = z.infer<typeof contactSchema>;

export const directorySchema = z.array(contactSchema);

/**
 * Addresses that must never be sent to again.
 *
 * Stored as SHA-256 of the lowercased address rather than the address itself,
 * so that honouring a removal request does not republish the very address
 * someone asked to have taken down.
 */
export const suppressionSchema = z.object({
  algorithm: z.literal("sha256"),
  hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)),
});

export type Suppression = z.infer<typeof suppressionSchema>;

/** A recipient the user brought themselves, from a CSV or a paste. */
export interface ImportedContact {
  email: string;
  org?: string;
  role?: string;
  name?: string;
  city?: string;
}

// ---------------------------------------------------------------------------
// Bundled lists — the second, explicitly unverified tier
// ---------------------------------------------------------------------------

/**
 * Properties of an address worth warning a user about before they write to it.
 *
 * `hiring` is the only positive signal: the local part names a recruitment
 * mailbox. The other two are reasons to expect a bounce or an unwelcome
 * arrival, and the UI surfaces both rather than hiding them behind a count.
 */
export const ENTRY_FLAGS = ["hiring", "free-webmail", "legacy-domain"] as const;
export type EntryFlag = (typeof ENTRY_FLAGS)[number];

export const bundledEntrySchema = z.object({
  email: z.string().email(),
  /** May be a company name, or just the domain when the source had no name. */
  org: z.string().optional(),
  sector: z.string().optional(),
  city: z.string().optional(),
  flags: z.array(z.enum(ENTRY_FLAGS)).optional(),
});

export type BundledEntry = z.infer<typeof bundledEntrySchema>;

/**
 * A third-party compiled list.
 *
 * Deliberately a different shape from `contactSchema`. The curated directory
 * demands a `sourceUrl` per record pointing at the organisation's own careers
 * page; a bulk list cannot honour that, and pretending otherwise would make the
 * guarantee meaningless for the records that *do* carry it. So bulk lists live
 * in their own tier, carry provenance for the list as a whole, and are marked
 * unverified everywhere they surface.
 */
export const bundledListSchema = z.object({
  id: z.string().min(2),
  title: z.object({ ar: z.string().min(2), en: z.string().min(2) }),
  /** Where the list came from, in plain words. */
  provenance: z.object({ ar: z.string().min(10), en: z.string().min(10) }),
  /** Always false. A verified list belongs in the curated directory instead. */
  verified: z.literal(false),
  /** Roughly when the underlying data was compiled, if known. */
  approximateVintage: z.string().optional(),
  entries: z.array(bundledEntrySchema),
});

export type BundledList = z.infer<typeof bundledListSchema>;
