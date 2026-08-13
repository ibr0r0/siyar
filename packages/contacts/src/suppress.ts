/**
 * Add an address to the permanent do-not-contact list.
 *
 *   pnpm --filter @siyar/contacts suppress careers@example.com
 *
 * Also removes it from the directory if it is there, so a removal request is
 * satisfied in one step.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { directorySchema, suppressionSchema } from "./schema";
import { hashEmail } from "./suppression";
import { normalizeEmail } from "./compose";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const input = process.argv[2];
if (!input) {
  console.error("usage: suppress <email>");
  process.exit(1);
}

const email = normalizeEmail(input);
const hash = await hashEmail(email);

const suppressionPath = join(dataDir, "suppression.json");
const directoryPath = join(dataDir, "directory.json");

const suppression = suppressionSchema.parse(
  JSON.parse(await readFile(suppressionPath, "utf8")),
);
const directory = directorySchema.parse(
  JSON.parse(await readFile(directoryPath, "utf8")),
);

if (!suppression.hashes.includes(hash)) {
  suppression.hashes.push(hash);
  suppression.hashes.sort();
  await writeFile(
    suppressionPath,
    `${JSON.stringify(suppression, null, 2)}\n`,
    "utf8",
  );
  console.log(`suppressed ${email}`);
} else {
  console.log(`${email} was already suppressed`);
}

const remaining = directory.filter(
  (contact) => normalizeEmail(contact.email) !== email,
);
if (remaining.length !== directory.length) {
  await writeFile(directoryPath, `${JSON.stringify(remaining, null, 2)}\n`, "utf8");
  console.log(`removed ${directory.length - remaining.length} directory entry`);
}
