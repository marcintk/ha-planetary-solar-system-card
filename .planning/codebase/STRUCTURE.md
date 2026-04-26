<!-- refreshed: 2026-04-26 -->

# Codebase Structure

**Analysis Date:** 2026-04-26

## Directory Layout

```
ha-planetary-solar-system-card/
├── src/                           # Source code (ES6 modules)
│   ├── index.js                   # Entry point: registers <ha-solar-view-card>
│   ├── card/                      # Card lifecycle & UI state
│   │   ├── card.js                # Main SolarViewCard class
│   │   ├── card-view-state.js     # Pan/zoom state container
│   │   ├── card-template.js       # HTML template generator
│   │   ├── card-styles.js         # CSS for shadow DOM
│   │   └── zoom-animator.js       # Zoom transition animator
│   ├── renderer/                  # SVG rendering modules
│   │   ├── index.js               # Main renderSolarSystem() orchestrator
│   │   ├── bodies.js              # Planets, Sun, Moon, orbits, labels
│   │   ├── comets.js              # Comet bodies and orbits
│   │   ├── observer.js            # Observer needle, day/night split, visibility cones
│   │   ├── seasons.js             # Seasonal quadrant overlay
│   │   ├── moon-phase.js          # Moon phase indicator graphic
│   │   ├── offscreen-markers.js   # Out-of-viewport body markers
│   │   └── svg-utils.js           # SVG element creation, coordinate transforms
│   └── astronomy/                 # Pure calculation modules
│       ├── orbital-mechanics.js   # Planet/moon/comet position calculations
│       ├── solar-position.js      # Sun elevation, twilight, sky classification
│       ├── planet-data.js         # Orbital elements and visual properties
│       ├── moon-phase.js          # Moon phase calculation
│       └── comet-data.js          # Halley's comet orbital parameters
│
├── test/                          # Vitest test suites (mirror src/ structure)
│   ├── card/
│   │   ├── card.test.js
│   │   ├── card-view-state.test.js
│   │   ├── card-template.test.js
│   │   └── zoom-animator.test.js
│   ├── renderer/
│   │   ├── index.test.js
│   │   ├── bodies.test.js
│   │   ├── comets.test.js
│   │   ├── observer.test.js
│   │   ├── seasons.test.js
│   │   ├── moon-phase.test.js
│   │   ├── offscreen-markers.test.js
│   │   ├── svg-utils.test.js
│   │   └── twilight-accuracy.test.js  # Solar position accuracy tests
│   └── astronomy/
│       ├── orbital-mechanics.test.js
│       ├── solar-position.test.js
│       ├── planet-data.test.js
│       ├── moon-phase.test.js
│       └── comet-data.test.js
│
├── dist/                          # Build output (bundled & minified)
│   └── ha-solar-view-card.js      # Final product for HA installation
│
├── .planning/                     # GSD planning artifacts
│   └── codebase/                  # Architecture & structure docs
│       ├── ARCHITECTURE.md        # Data flow, layers, abstractions
│       └── STRUCTURE.md           # This file
│
├── docs/                          # User documentation
│
├── package.json                   # Dependencies: vitest, rollup, biome, prettier
├── package-lock.json              # Pinned versions
├── rollup.config.mjs              # Build config (ES6 input → ES6 output)
├── vitest.config.mjs              # Test runner config (jsdom environment)
├── biome.json                     # Formatter/linter rules (double quotes, 2-space indent)
├── .prettierrc                    # Markdown formatter
├── .prettierignore                # Paths excluded from prettier
│
├── .env                           # Environment variables (NOT for secrets)
├── .gitignore                     # Excludes node_modules, coverage, dist
├── .github/                       # GitHub workflows (if any)
├── .serena/                       # Serena MCP workspace state
├── .claude/                       # Claude workspace state
│
├── README.md                      # Project overview
├── CLAUDE.md                      # Project instructions & tool rules
├── TEAM.md                        # Team contact info
├── LICENSE                        # ISC license
└── example.png                    # Demo screenshot
```

## Directory Purposes

**`src/`:**

- Purpose: All production source code as ES6 modules
- Contains: Card class, view state, rendering logic, astronomy calculations
- Key files: `index.js` (registration), `card/card.js` (main component)

**`src/card/`:**

- Purpose: Home Assistant integration layer and UI interaction
- Contains: SolarViewCard lifecycle, ViewState pan/zoom logic, animation, template/styles
- Exports: SolarViewCard class, ViewState class, ZoomAnimator class, card template/styles functions

**`src/renderer/`:**

- Purpose: SVG rendering and visual composition
- Contains: Main orchestrator (index.js) and specialized modules for each visual layer
- Exports: renderSolarSystem() function; sub-modules export render\* functions for specific elements
- Generated: index.js returns SVG element with full scene

**`src/astronomy/`:**

- Purpose: Astronomical calculations decoupled from rendering
- Contains: Position algorithms (J2000 epoch, Kepler equations), orbital elements data
- Exports: Pure functions (calculatePlanetPosition, calculateMoonPosition, calculateCometPosition,
  computeSolarElevationDeg, getSkyMode, computeNextTransitionTime) and data objects (PLANETS, SUN,
  MOON, COMETS)

**`test/`:**

- Purpose: Vitest test suites with same directory structure as src/
- Contains: Unit and integration tests using Vitest + jsdom
- Pattern: Each src/foo.js has corresponding test/foo.test.js
- Coverage: 18 test files, 6313 total test lines; jsdom environment allows DOM API testing

**`dist/`:**

- Purpose: Build output for Home Assistant installation
- Generated: `npm run build` produces unminified ES6 bundle; `npm run build:prod` adds terser
  minification
- File: `ha-solar-view-card.js` is single entry point including all dependencies

**`.planning/codebase/`:**

- Purpose: GSD (Generative Software Development) documents
- Contains: ARCHITECTURE.md (layers/patterns), STRUCTURE.md (file organization)
- Generated: By `/gsd-map-codebase` tool during CI/CD

**`.serena/` and `.claude/`:**

- Purpose: MCP workspace state and indexing
- Generated: By Serena and Claude Code tools during editing sessions

## Key File Locations

**Entry Points:**

- `src/index.js` — Registers custom element with Home Assistant; called by bundler entry
- `src/card/card.js` — Main SolarViewCard class; HA lifecycle hooks (setConfig, hass setter,
  connectedCallback, disconnectedCallback, getCardSize)
- `src/renderer/index.js` — renderSolarSystem() function called on every render

**Configuration:**

- `rollup.config.mjs` — Build: ES6 modules → single ES6 file in dist/, optionally minified with
  terser
- `vitest.config.mjs` — Test: jsdom environment, coverage to coverage/
- `biome.json` — Formatter: double quotes, 2-space indent, 100-char line width; linter: recommend
  rules, noConsole warn
- `.prettierrc` — Markdown formatting
- `package.json` — Scripts: build, build:prod, test, test:watch, test:coverage, lint, format, check

**Core Logic:**

- `src/card/card-view-state.js` — ViewState class: pan (centerX, centerY), zoom level, drag
  tracking; computes SVG viewBox
- `src/astronomy/orbital-mechanics.js` — Position algorithms: calculatePlanetPosition,
  calculateMoonPosition, calculateCometPosition, solveKeplerEquation (Newton-Raphson)
- `src/astronomy/solar-position.js` — Solar elevation, twilight zones, sky mode classification, next
  transition time
- `src/renderer/bodies.js` — renderOrbit, renderBody, renderSaturnRings; handles all
  planet/moon/sun/orbit rendering
- `src/renderer/observer.js` — Observer needle, day/night split, visibility cone rendering;
  calculateObserverAngle
- `src/card/card-template.js` — buildCardHtml, buildStatusBarHtml; generates shadow DOM structure

**Testing:**

- `test/card/card.test.js` — 922 lines; main component tests: render, zoom, pan, navigation, event
  handling
- `test/renderer/index.test.js` — 645 lines; renderSolarSystem integration tests
- `test/renderer/comets.test.js` — 436 lines; comet rendering and visual ellipse computation
- `test/renderer/twilight-accuracy.test.js` — 355 lines; solar elevation accuracy validation
- `test/renderer/observer.test.js` — 279 lines; observer needle, day/night split, visibility cone
- `test/astronomy/orbital-mechanics.test.js` — 192 lines; planet/moon/comet position calculations

## Naming Conventions

**Files:**

- **Modules:** snake-case.js (e.g., card-view-state.js, orbital-mechanics.js)
- **Classes exported from file:** PascalCase (e.g., SolarViewCard, ViewState, ZoomAnimator)
- **Test files:** _.test.js or _.spec.js (all use .test.js pattern)
- **Build output:** kebab-case (ha-solar-view-card.js)

**Functions:**

- **Render functions:** renderX() pattern (e.g., renderBody, renderOrbit, renderSolarSystem)
- **Calculation functions:** calculateX() pattern (e.g., calculatePlanetPosition,
  calculateObserverAngle)
- **Compute functions:** computeX() pattern (e.g., computeSolarElevationDeg,
  computeNextTransitionTime)
- **Get functions:** getX() pattern (e.g., getSkyMode, getLocalTimeInZone)
- **Helper functions:** camelCase (e.g., solveKeplerEquation, expandBounds, rayCircleDistance)
- **Private methods:** \_methodName() convention (e.g., \_render, \_updateViewBox, \_onPointerDown)

**Variables:**

- **Constants:** UPPER_SNAKE_CASE (e.g., DEFAULT_ZOOM_LEVEL, FULL_SYSTEM_SIZE, CENTER)
- **Class properties:** camelCase (e.g., centerX, zoomLevel, isDragging)
- **Local variables:** camelCase (e.g., earthAngle, moonPixelOffset, tempBounds)
- **Data objects:** snake_case keys matching Home Assistant convention (e.g., meanLongitudeJ2000,
  semiMajorAxis, eccentricity)

**Types/Objects:**

- **Orbital elements:** semiMajorAxis, eccentricity, meanAnomalyJ2000, longitudeOfPerihelion
- **Visual properties:** color, size, au (for orbital distance)
- **Metadata:** name, periodDays
- **View state:** centerX, centerY, zoomLevel, isDragging
- **Position result:** angle (radians), radius (AU), trueAnomaly

**Directories:**

- **Feature layer:** card/, renderer/, astronomy/ (functional grouping)
- **Test mirror:** test/card/, test/renderer/, test/astronomy/

## Where to Add New Code

**New Feature:**

- **Primary implementation:** Feature calculation in astronomy/ or rendering logic in renderer/
  depending on type
- **Example (add zodiac constellations):**
  - Create `src/astronomy/zodiac-data.js` with constellation positions
  - Create `src/renderer/zodiac.js` with renderZodiacOverlay() function
  - Import in `src/renderer/index.js` and call during render sequence (likely after season overlay,
    before orbits)
  - Create `test/astronomy/zodiac-data.test.js` and `test/renderer/zodiac.test.js`
- **Example (add Earth-centric view):**
  - Add view mode toggle to config in `src/card/card.js` (default: heliocentric)
  - Modify `src/renderer/index.js` renderSolarSystem() to accept viewMode parameter
  - In Earth-centric mode, transform all coordinates so Earth stays at CENTER; apply inverse
    transformation to observer angle
  - Pass viewMode through card → renderSolarSystem call; thread into calculatePlanetPosition context

**New Component/Module:**

- **Location decision:**
  - Pure algorithm → `src/astronomy/new-calculation.js`
  - Visual rendering → `src/renderer/new-element.js`
  - Card UI/interaction → extend `src/card/card.js` or create `src/card/new-feature.js`
- **Pattern:** Export named functions or classes; avoid module-level mutable state
- **Testing:** Create mirror in test/ with same directory structure; use Vitest describe/it/expect
  API with jsdom environment

**Utilities:**

- **Shared helpers:** Add to `src/renderer/svg-utils.js` if SVG-specific; add to top of relevant
  astronomy module if calculation-specific
- **Constants:** Define at module top with UPPER_SNAKE_CASE; export if needed elsewhere
- **Data:** Keep orbital elements in astronomy/, visual properties in respective render modules

**Styles/Templates:**

- **Card styling:** Edit `src/card/card-styles.js` (returns CSS string injected into shadow DOM
  style tag)
- **HTML structure:** Edit `src/card/card-template.js` (buildCardHtml, buildStatusBarHtml functions)
- **Dark mode:** Already using colors compatible with Home Assistant dark slate theme; no separate
  theme file

**Configuration:**

- **Card config:** Edit SolarViewCard.setConfig() in `src/card/card.js` to accept new options
- **Config validation:** Clamp/validate in setConfig(); see default_zoom, periodic_zoom_change,
  refresh_mins pattern
- **Default config:** Update SolarViewCard.getStubConfig() return value

## Special Directories

**`coverage/`:**

- Purpose: Test coverage reports generated by Vitest
- Generated: `npm run test:coverage` outputs text/HTML/JSON reports
- Committed: No (in .gitignore)

**`dist/`:**

- Purpose: Build output
- Generated: `npm run build` or `npm run build:prod`
- Committed: No (in .gitignore)

**`node_modules/`:**

- Purpose: npm dependencies
- Committed: No (package-lock.json used instead)

**`.github/`:**

- Purpose: GitHub Actions CI/CD workflows (if present)
- Contents: May include linting, testing, build, release steps

---

_Structure analysis: 2026-04-26_
