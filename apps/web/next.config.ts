import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /*
    A production build must not share a directory with a running dev server.
    They write incompatible chunk graphs to the same place, and the loser dies
    with `__webpack_modules__[moduleId] is not a function` or a missing
    vendor chunk — an error that looks like a code fault and is not one.
    `pnpm build` sets NEXT_DIST_DIR so the two can coexist.
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
