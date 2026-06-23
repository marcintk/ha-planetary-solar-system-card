# Migration TODOs

Track progress of the JS → TypeScript → Lit migration. Status: `[ ]` open · `[x]` done · `[-]`
skipped

---

## Phase 1: JavaScript → TypeScript ✅ COMPLETE

### Tooling

- [x] Add `typescript` and `@rollup/plugin-typescript` to devDependencies
- [x] Create `tsconfig.json` (strict, ES2019, experimentalDecorators for Lit pre-empt)
- [x] Add `src/globals.d.ts` with `declare const __CARD_VERSION__: string` and Window.customCards
- [x] Update `rollup.config.mjs` — use TypeScript plugin, input `src/index.ts`
- [x] Update `vitest.config.mjs` — coverage include `src/**/*.ts`

### Source file renames (src/)

- [x] `src/index.js` → `src/index.ts`
- [x] `src/card/card.js` → `src/card/card.ts`
- [x] `src/card/card-styles.js` → `src/card/card-styles.ts`
- [x] `src/card/card-template.js` → `src/card/card-template.ts`
- [x] `src/card/card-view-state.js` → `src/card/card-view-state.ts`
- [x] `src/card/zoom-animator.js` → `src/card/zoom-animator.ts`
- [x] `src/renderer/index.js` → `src/renderer/index.ts`
- [x] `src/renderer/bodies.js` → `src/renderer/bodies.ts`
- [x] `src/renderer/comets.js` → `src/renderer/comets.ts`
- [x] `src/renderer/moon-phase.js` → `src/renderer/moon-phase.ts`
- [x] `src/renderer/observer.js` → `src/renderer/observer.ts`
- [x] `src/renderer/offscreen-markers.js` → `src/renderer/offscreen-markers.ts`
- [x] `src/renderer/seasons.js` → `src/renderer/seasons.ts`
- [x] `src/renderer/svg-utils.js` → `src/renderer/svg-utils.ts`
- [x] `src/astronomy/comet-data.js` → `src/astronomy/comet-data.ts`
- [x] `src/astronomy/moon-phase.js` → `src/astronomy/moon-phase.ts`
- [x] `src/astronomy/orbital-mechanics.js` → `src/astronomy/orbital-mechanics.ts`
- [x] `src/astronomy/planet-data.js` → `src/astronomy/planet-data.ts`
- [x] `src/astronomy/solar-position.js` → `src/astronomy/solar-position.ts`

### Test file renames (test/)

- [x] `test/index.test.js` → `test/index.test.ts`
- [x] `test/card/card.test.js` → `test/card/card.test.ts`
- [x] `test/card/card-template.test.js` → `test/card/card-template.test.ts`
- [x] `test/card/card-view-state.test.js` → `test/card/card-view-state.test.ts`
- [x] `test/card/zoom-animator.test.js` → `test/card/zoom-animator.test.ts`
- [x] `test/renderer/index.test.js` → `test/renderer/index.test.ts`
- [x] `test/renderer/bodies.test.js` → `test/renderer/bodies.test.ts`
- [x] `test/renderer/comets.test.js` → `test/renderer/comets.test.ts`
- [x] `test/renderer/moon-phase.test.js` → `test/renderer/moon-phase.test.ts`
- [x] `test/renderer/observer.test.js` → `test/renderer/observer.test.ts`
- [x] `test/renderer/offscreen-markers.test.js` → `test/renderer/offscreen-markers.test.ts`
- [x] `test/renderer/seasons.test.js` → `test/renderer/seasons.test.ts`
- [x] `test/renderer/svg-utils.test.js` → `test/renderer/svg-utils.test.ts`
- [x] `test/renderer/twilight-accuracy.test.js` → `test/renderer/twilight-accuracy.test.ts`
- [x] `test/astronomy/comet-data.test.js` → `test/astronomy/comet-data.test.ts`
- [x] `test/astronomy/moon-phase.test.js` → `test/astronomy/moon-phase.test.ts`
- [x] `test/astronomy/orbital-mechanics.test.js` → `test/astronomy/orbital-mechanics.test.ts`
- [x] `test/astronomy/planet-data.test.js` → `test/astronomy/planet-data.test.ts`
- [x] `test/astronomy/solar-position.test.js` → `test/astronomy/solar-position.test.ts`

### Type annotations

- [x] Add `src/types.ts` with shared interfaces: `Planet`, `CelestialBody`, `Comet`, `LocationData`,
      `Colors`, `ZoomLevel`, `Hemisphere`, `ViewPosition`, `HASSConfig`, `CardConfig`, and more
- [x] Annotate `src/astronomy/planet-data.ts` — `PLANETS: Planet[]`, `SUN`, `MOON`
- [x] Annotate `src/astronomy/comet-data.ts` — `COMETS: Comet[]`
- [x] Annotate `src/astronomy/orbital-mechanics.ts` — all function params/returns
- [x] Annotate `src/astronomy/moon-phase.ts`
- [x] Annotate `src/astronomy/solar-position.ts`
- [x] Annotate `src/renderer/svg-utils.ts`
- [x] Annotate `src/renderer/bodies.ts`
- [x] Annotate `src/renderer/comets.ts`
- [x] Annotate `src/renderer/moon-phase.ts`
- [x] Annotate `src/renderer/observer.ts`
- [x] Annotate `src/renderer/offscreen-markers.ts`
- [x] Annotate `src/renderer/seasons.ts`
- [x] Annotate `src/renderer/index.ts` — return type
      `{ svg: SVGSVGElement; bounds: Bounds; positions: ViewPosition[] }`
- [x] Annotate `src/card/card-view-state.ts` — all methods
- [x] Annotate `src/card/zoom-animator.ts`
- [x] Annotate `src/card/card-template.ts` — `buildStatusBarHtml`, `buildCardHtml`
- [x] Annotate `src/card/card.ts` — fields, `set hass`, config types

### Validation

- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npm test` passes (424/424)
- [x] `npm run check` (Biome) passes
- [x] `npm run build` produces `dist/card.js`

---

## Phase 2: TypeScript → Lit ✅ COMPLETE (PR #37)

### Tooling

- [x] Add `lit` (v3.x) as a runtime dependency
- [x] Verify `tsconfig.json` has `experimentalDecorators: true` (set in Phase 1)

### Source changes

- [x] `src/card/card-styles.ts` — replaced string constant with `css\`\`` tagged template
- [x] `src/card/card.ts` — extend `LitElement` instead of `HTMLElement`
  - [x] Removed manual `attachShadow()` call (handled by Lit)
  - [x] Added `static styles = cardStyles`
  - [x] Kept manual property fields; reactive updates via `_render()` shim (`requestUpdate()` +
        `performUpdate()` for synchronous renders)
  - [x] Added `render()` method returning `html\`\`` template
  - [x] Dissolved `buildCardHtml()` inline into `render()`; `buildStatusBarHtml()` bridged via
        `unsafeHTML` directive
  - [x] SVG appended imperatively in `updated()` lifecycle hook (renderer untouched)
  - [x] Inline `@click` handlers in nav buttons; pointer events bound in `updated()` on SVG
  - [x] `connectedCallback()` / `disconnectedCallback()` kept with `super.*` calls
  - [x] Added `onComplete` callback to `ZoomAnimator.animateTo()` for post-animation re-sync
  - [x] Fixed ChildPart corruption in `_applyZoom()` — use `_render()` not `.textContent`
- [x] `src/card/card-template.ts` — `buildCardHtml` dissolved; `buildStatusBarHtml` kept

### Test changes

- [x] `test/card/card-template.test.ts` — removed `buildCardHtml` tests (function dissolved)
- [x] All card tests kept synchronous — no `await updateComplete` rewrites needed (synchronous
      `_render()` shim makes Lit behave like the old imperative render)

### Validation

- [x] `npm test` passes (413/413)
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npm run check` (Biome) passes
- [x] `npm run build` produces `dist/card.js` (with Lit bundled)
- [ ] Manual browser test: card renders correctly, nav buttons work, zoom works, drag works
