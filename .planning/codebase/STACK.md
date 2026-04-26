# Technology Stack

**Analysis Date:** 2026-04-26

## Languages

**Primary:**

- JavaScript (ES6+) - All source code in `src/`
- No TypeScript configuration

**Secondary:**

- HTML - Inline via shadow DOM in `src/card/card-template.js`
- CSS - Inline styles in `src/card/card-styles.js`

## Runtime

**Environment:**

- Browser (Modern Web Components support required)
- Home Assistant Lovelace integration (custom element registration at window level)

**Package Manager:**

- npm (v3 lockfile format)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- Web Components (native HTML elements) - Custom element `ha-solar-view-card` extending
  `HTMLElement` (`src/card/card.js`)
- Shadow DOM - Used for style isolation in card (`src/card/card.js` line 10)

**Testing:**

- Vitest 4.1.0 - Test runner with v8 coverage provider
  - Config: `vitest.config.mjs`
  - Environment: jsdom (browser-like DOM for testing)
  - Coverage: v8 reporter with HTML, text, JSON outputs

**Build/Dev:**

- Rollup 4.57.1 - Module bundler
  - Config: `rollup.config.mjs`
  - Input: `src/index.js`
  - Output: `dist/ha-solar-view-card.js` (ES module, unminified by default)
  - Plugins: `@rollup/plugin-node-resolve` 16.0.3, `@rollup/plugin-terser` 0.4.4 (production only)

**Code Quality:**

- Biome 2.4.6 - Formatter and linter
  - Config: `biome.json`
  - Linting rules enabled (recommended ruleset + custom rules)
  - Formatting: double quotes, always semicolons, ES5 trailing commas
- Prettier 3.8.1 - Markdown formatter (secondary)
  - Config: `.prettierrc`

## Key Dependencies

**No production runtime dependencies** — all dependencies are dev-only.

**Build/Bundling:**

- Rollup plugin node-resolve 16.0.3 - Resolves Node modules (used with no-op for web components)
- Rollup plugin terser 0.4.4 - Minifies output in production

**Testing Infrastructure:**

- jsdom 28.0.0 - Browser environment emulation for tests
- @vitest/coverage-v8 4.1.0 - Code coverage reporting

## Configuration

**Environment:**

- Card consumes from Home Assistant instance: latitude, longitude, time_zone, location_name
  (accessed via `hass.config` in `src/card/card.js` lines 41-44)
- No environment variables required for deployment; configuration via YAML in Home Assistant
  dashboard

**Build:**

- `rollup.config.mjs` - Rollup module config (ES module format)
- `vitest.config.mjs` - Vitest module config with jsdom environment
- `biome.json` - Biome formatter/linter config (line width 100, 2-space indent)
- `package.json` - Scripts: `build`, `build:prod`, `test`, `test:watch`, `test:coverage`,
  linting/formatting commands

## NPM Scripts

```bash
npm run build            # Unminified ES module bundle
npm run build:prod       # Production bundle with minification
npm test                 # Run all tests once
npm run test:watch      # Watch mode testing
npm run test:coverage   # Coverage report
npm run lint            # Biome linting
npm run lint:fix        # Fix linting issues
npm run format          # Biome formatting
npm run check           # Full Biome check
```

## Platform Requirements

**Development:**

- Node.js with npm
- No version lock (.nvmrc not present; assumes recent Node.js LTS)

**Production:**

- Home Assistant instance with Lovelace UI
- Modern browser with Web Components, Shadow DOM, and ES modules support
- Bundle deployed to `<config>/www/ha-solar-view-card/ha-solar-view-card.js`

---

_Stack analysis: 2026-04-26_
