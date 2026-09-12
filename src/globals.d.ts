// Ambient globals for this card. `__CARD_VERSION__` is injected by rollup.config.mjs (intro)
// and vitest.config.mjs (define).
declare const __CARD_VERSION__: string;

interface Window {
  customCards: Array<{
    type: string;
    name: string;
    description: string;
    preview: boolean;
  }>;
}
