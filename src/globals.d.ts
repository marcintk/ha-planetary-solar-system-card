// Ambient globals for this card. `__CARD_VERSION__` is injected by rollup.config.mjs (intro)
// and vitest.config.mjs (define). Vendored from ha-card-shared/globals.d.ts (issue #243).
declare const __CARD_VERSION__: string;

interface Window {
  customCards: Array<{
    type: string;
    name: string;
    description: string;
    preview: boolean;
  }>;
}
