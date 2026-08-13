/**
 * Root layout. The real <html>/<body> live in `[locale]/layout.tsx`, because the
 * `dir` and `lang` attributes depend on the resolved locale.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
