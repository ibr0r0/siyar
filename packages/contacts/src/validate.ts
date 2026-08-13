/**
 * CI gate for the contact directory.
 *
 * Runs on every pull request. Its job is to make the rules in
 * `data/LICENSE` and `data/REMOVALS.md` mechanical rather than aspirational:
 * a record with no traceable source, or one re-adding a suppressed address,
 * fails the build instead of relying on a reviewer noticing.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundledListSchema, contactSchema, suppressionSchema } from "./schema";
import { hashEmail } from "./suppression";
import { normalizeEmail } from "./compose";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const problems: string[] = [];
const note = (message: string) => problems.push(message);

const [directoryRaw, suppressionRaw] = await Promise.all([
  readFile(join(dataDir, "directory.json"), "utf8"),
  readFile(join(dataDir, "suppression.json"), "utf8"),
]);

const rawEntries: unknown[] = JSON.parse(directoryRaw);
const suppressionParsed = suppressionSchema.safeParse(JSON.parse(suppressionRaw));

if (!suppressionParsed.success) {
  for (const issue of suppressionParsed.error.issues) {
    note(`suppression[${issue.path.join(".")}]: ${issue.message}`);
  }
}

/*
  Validate each record on its own rather than the array as a whole, and keep
  going after a failure. A contributor with three problems in one pull request
  should be told about all three now, not discover them one CI run at a time.
*/
const contacts: Array<{ index: number; contact: import("./schema").Contact }> = [];
for (const [index, entry] of rawEntries.entries()) {
  const parsed = contactSchema.safeParse(entry);
  if (parsed.success) {
    // Carry the original index so later messages point at the line the
    // contributor actually has to edit, not at a position in the filtered list.
    contacts.push({ index, contact: parsed.data });
    continue;
  }
  for (const issue of parsed.error.issues) {
    note(`directory[${index}].${issue.path.join(".")}: ${issue.message}`);
  }
}

if (suppressionParsed.success) {
  const blocked = new Set(suppressionParsed.data.hashes);
  const seen = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  for (const { index, contact } of contacts) {
    const email = normalizeEmail(contact.email);
    const where = `directory[${index}] ${email}`;

    if (seen.has(email)) note(`${where}: duplicate entry`);
    seen.add(email);

    // A removal is permanent. Re-adding the address from a public page, even
    // in good faith, must not undo it.
    if (blocked.has(await hashEmail(email))) {
      note(`${where}: this address is on the suppression list and cannot be re-added`);
    }

    // The source has to be the organisation's own site, not a directory,
    // aggregator, or job board that republished the address.
    let host: string;
    try {
      host = new URL(contact.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      note(`${where}: sourceUrl is not a valid URL`);
      continue;
    }

    const emailDomain = email.split("@")[1] ?? "";
    const sameOrg =
      host.endsWith(emailDomain) || emailDomain.endsWith(host.split(".").slice(-2).join("."));
    if (!sameOrg) {
      note(
        `${where}: sourceUrl host (${host}) does not match the address domain (${emailDomain}) — the source must be the organisation's own page`,
      );
    }

    if (contact.lastVerified > today) {
      note(`${where}: lastVerified is in the future`);
    }
  }

  console.log(
    `contacts: ${contacts.length} entr${contacts.length === 1 ? "y" : "ies"}, ` +
      `${suppressionParsed.data.hashes.length} suppressed`,
  );
}

// ---------------------------------------------------------------------------
// Bundled lists
// ---------------------------------------------------------------------------

const bundledDir = join(dataDir, "bundled");
let bundledFiles: string[] = [];
try {
  bundledFiles = (await readdir(bundledDir)).filter((name) => name.endsWith(".json"));
} catch {
  // No bundled lists is a perfectly valid state.
}

for (const file of bundledFiles) {
  const parsed = bundledListSchema.safeParse(
    JSON.parse(await readFile(join(bundledDir, file), "utf8")),
  );

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      note(`bundled/${file}[${issue.path.join(".")}]: ${issue.message}`);
    }
    continue;
  }

  const list = parsed.data;
  const seen = new Set<string>();

  for (const [index, entry] of list.entries.entries()) {
    const email = normalizeEmail(entry.email);
    const where = `bundled/${file}[${index}] ${email}`;

    if (seen.has(email)) note(`${where}: duplicate within the list`);
    seen.add(email);

    // Suppression outranks everything, including a bulk import.
    if (suppressionParsed.success) {
      if (suppressionParsed.data.hashes.includes(await hashEmail(email))) {
        note(`${where}: suppressed — a removal request must not be undone by a bulk list`);
      }
    }

    // The two tiers must stay disjoint. An address in both would inherit the
    // curated tier's "verified, sourced" promise without having earned it.
    if (contacts.some(({ contact }) => normalizeEmail(contact.email) === email)) {
      note(`${where}: also present in the curated directory — keep the tiers disjoint`);
    }
  }

  console.log(
    `bundled/${file}: ${list.entries.length} entries, verified=${list.verified}, ` +
      `${list.entries.filter((entry) => entry.flags?.includes("hiring")).length} hiring`,
  );
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("contact directory OK");
