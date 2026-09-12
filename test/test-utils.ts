// Vendored from ha-card-shared/test-utils (issue #243 — the dependency is gone; this repo owns
// its copy now). Normalizes Lit's per-render `lit$<random>$` marker IDs so HTML snapshots don't
// churn on every run.
export function snapHtml(html: string): string {
  return html.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->").replace(/lit\$\d+\$/g, "lit$");
}
