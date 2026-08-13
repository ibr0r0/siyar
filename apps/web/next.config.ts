import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /*
    Defaults to `.next`, which is what Vercel, every other host, and every
    contributor expects — a build that writes somewhere else fails deployment
    with "output directory not found" even though it compiled perfectly.

    `NEXT_DIST_DIR` is an opt-in escape hatch for one local situation: building
    while a dev server is running. They otherwise write incompatible chunk
    graphs to the same directory and the loser dies with
    `__webpack_modules__[moduleId] is not a function`, which reads like a code
    fault and is not one. Use `pnpm build:isolated` for that.
  */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Workspace packages ship raw TypeScript; Next compiles them for us.
  transpilePackages: ["@siyar/ats-core", "@siyar/parsers", "@siyar/contacts"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  experimental: {
    // pdf.js and mammoth are large; keep them out of the initial bundle.
    optimizePackageImports: ["pdfjs-dist", "mammoth"],
  },
};

export default withNextIntl(nextConfig);
