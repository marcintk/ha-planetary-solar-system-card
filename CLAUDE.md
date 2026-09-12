# CLAUDE.md

Home Assistant Lovelace custom card rendering a planetary solar system / sky view. TypeScript + Lit,
bundled with Rollup to `dist/card.js`, distributed via HACS.

## Project map

- `src/astronomy/` - ephemeris math (planet/moon/comet positions, orbital mechanics, solar position,
  parallax)
- `src/renderer/` - SVG rendering of bodies, orbits, labels, comets, seasons
- `src/card/` - the Lovelace card itself (config, template, styles, zoom, navigation, theming)
- `src/index.ts` - registers the custom element and `window.customCards` entry
- `test/` - Vitest specs mirroring `src/`, plus `test/fixtures` and `test/helpers`
- `scripts/demo/` - Playwright-based demo GIF recorder
- `docs/` - GitHub Pages demo (`docs/index.html`, `docs/card.js`)

<important if="you need to run commands to build, test, lint, or generate code">

| Command                 | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run build`         | Build `dist/card.js` via Rollup                                        |
| `npm run dev`           | Rollup in watch mode                                                   |
| `npm test`              | Run Vitest once                                                        |
| `npm run test:coverage` | Run tests with coverage report                                         |
| `npm run check`         | Biome lint + format, writes fixes                                      |
| `npm run check:ci`      | Exact CI gate: typecheck + biome check (no writes) + prettier md check |
| `npm run demo:record`   | Regenerate `docs/demo.gif` via Playwright                              |

`check:ci` is what CI (`.github/workflows/card-build-and-test.yml`) runs verbatim, alongside `build`
and `test:coverage` — run it locally before considering work done. Other granular scripts (`lint`,
`format`, `typecheck`, etc.) exist in `package.json` if you need finer control. </important>

<important if="you are writing or modifying tests, or about to report a task complete">

Coverage thresholds in `vitest.config.mjs` are set to 100% (statements, branches, functions, lines)
for `src/**/*.ts`. Any new or changed source code needs matching test coverage — run
`npm run test:coverage` before considering work done. </important>

<important if="you are working on astronomy calculations (src/astronomy/) or renderer accuracy (src/renderer/), or a test in accuracy-*.test.ts is failing">

`accuracy-*.test.ts` files (e.g. `test/astronomy/accuracy-ephemeris.test.ts`,
`test/renderer/accuracy-horizon.test.ts`) check computed values against external reference ephemeris
data — they are ground truth, not adjustable expectations. If one fails, the bug is in the source
math; fix the implementation. Never loosen a tolerance, change an expected value, or edit these
tests to make them pass. </important>

<important if="you are changing the HACS manifest, release workflow, or how the card is distributed/versioned">

- `hacs.json` names the distributed file as `card.js`; HACS renders the repo's README at the release
  tag, not `main` — relative asset paths in README.md must resolve correctly from an old tag too.
- Releases are read from GitHub Releases (see README release badges); the publish workflow is
`.github/workflows/card-publish-release.yml`.
</important>
