/**
 * Copy the pdf.js worker into `public/` so the browser can load it from our own
 * origin.
 *
 * It has to be a real file rather than a bundled import: the worker is loaded
 * by URL at runtime, and serving it ourselves keeps the promise that analysis
 * touches no third-party host — a CDN reference would leak the fact that
 * someone is analysing a CV, which is exactly what this tool exists to avoid.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const source = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "build",
  "pdf.worker.min.mjs",
);
const destinationDir = join(here, "..", "public");
const destination = join(destinationDir, "pdf.worker.min.mjs");

await mkdir(destinationDir, { recursive: true });
await copyFile(source, destination);

console.log(`pdf.js worker → ${destination}`);
