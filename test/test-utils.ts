// Normalizes Lit's per-render `lit$<random>$` marker IDs so HTML snapshots don't churn on every
// run.
export function snapHtml(html: string): string {
  return html.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->").replace(/lit\$\d+\$/g, "lit$");
}
