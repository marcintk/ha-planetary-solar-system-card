# Coding Conventions

**Analysis Date:** 2026-04-26

## Language & Module System

**Primary Language:** JavaScript (ES2020+)

**Module System:** ESM (ES modules)

- File extension: `.js` (no `.mjs` in source, only in config)
- Import/export syntax: `import`/`export`
- Node type in package.json: `"type": "module"`

## Naming Patterns

**Files:**

- lowercase kebab-case: `card-view-state.js`, `planet-data.js`, `orbital-mechanics.js`
- Co-located by feature/domain: `src/card/`, `src/astronomy/`, `src/renderer/`
- Descriptive purpose-based names, not generic (e.g., `card-view-state.js` not `state.js`)

**Classes:**

- PascalCase: `SolarViewCard`, `ViewState`, `ZoomAnimator`
- Class is the primary export: `export class SolarViewCard`

**Functions:**

- camelCase: `calculatePlanetPosition()`, `renderSolarSystem()`, `createSvgElement()`
- Pure functions and utilities export as named exports
- Verb-prefix pattern for actions: `render*`, `calculate*`, `create*`, `expand*`, `update*`

**Variables & Constants:**

- camelCase for regular variables: `centerX`, `isDragging`, `zoomLevel`
- UPPER_SNAKE_CASE for module constants: `DEFAULT_ZOOM_LEVEL`, `MAX_ZOOM`, `MIN_ZOOM`,
  `ZOOM_LEVELS`, `SVG_NS`, `VIEW_SIZE`, `CENTER`
- Readonly objects in constants: `SUN`, `MOON`, `PLANETS`, `COMETS` (all UPPER_SNAKE_CASE)
- Private/internal fields prefixed with `_`: `_viewState`, `_currentDate`, `_config`, `_isDragging`,
  `_lat`, `_lon`

**Methods in Classes:**

- Public methods: camelCase, no prefix (`zoomIn()`, `updateDrag()`, `endDrag()`)
- Private/internal methods: camelCase with `_` prefix (`_render()`, `_navigate()`,
  `_startAutoUpdateTimer()`)
- Getter properties: `get width()`, `get viewBox` (in ViewState)

## Code Style

**Formatting:**

- Tool: Biome 2.4.6
- Line width: 100 characters
- Indentation: 2 spaces
- Quote style: double quotes (`"`)
- Semicolons: always required
- Trailing commas: es5 style (trailing commas in objects/arrays but not function parameters)

**Example from `src/card/card.js`:**

```javascript
export class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentDate = new Date();
    this._viewState = null;
  }
}
```

**Linting:**

- Tool: Biome lint
- Config: `biome.json`
- Key rules:
  - `suspicious.noConsole`: warn (console is acceptable)
  - `correctness.noUnusedVariables`: warn

## Import Organization

**Order:**

1. External dependencies (none in this codebase — no npm packages in src)
2. Relative imports from astronomy: `from "../../src/astronomy/..."`
3. Relative imports from renderer: `from "../../src/renderer/..."`
4. Relative imports from card: `from "../../src/card/..."`

**Path Style:**

- Explicit relative paths with `/` (no implicit `index.js` omission in imports)
- Always specify `.js` extension: `import { PLANETS } from "../../src/astronomy/planet-data.js"`

**Example from `src/renderer/index.js`:**

```javascript
import { COMETS } from "../astronomy/comet-data.js";
import {
  calculateCometPosition,
  calculateMoonPosition,
  calculatePlanetPosition,
} from "../astronomy/orbital-mechanics.js";
import { MOON, PLANETS, SUN } from "../astronomy/planet-data.js";
import { ORBIT_COLOR, renderBody, renderOrbit, renderSaturnRings } from "./bodies.js";
import { computeCometVisualEllipse, renderCometBody, renderCometOrbit } from "./comets.js";
```

## Error Handling

**Strategy:** Silent fail / null returns

- Functions do not throw errors; they return `null` or empty structures when operations fail
- No error logging to console in production code
- Conditional checks use nullish coalescing: `value ?? defaultValue`
- Safe navigation chains: `this._viewState?.isDragging ?? false`

**Example from `src/card/card.js`:**

```javascript
get _isDragging() {
  return this._viewState?.isDragging ?? false;
}
get _zoomLevel() {
  return this._viewState?.zoomLevel ?? null;
}
```

**Example from `src/astronomy/solar-position.js`:**

```javascript
try {
  return new Intl.DateTimeFormat("en-US", opts).formatToParts(date);
} catch {
  return new Intl.DateTimeFormat("en-US", opts).formatToParts(new Date(date.getTime() + tzOffset));
}
```

## Logging

**Framework:** `console` (no logger library)

**Patterns:**

- No logging in normal operation
- Warnings only via Biome linter (`noConsole: "warn"`)
- Comments preferred over console.log for development notes
- No logging from render functions

## Comments

**When to Comment:**

- Function purpose (JSDoc-style): describe parameters and return value
- Complex mathematical operations: explain the algorithm
- Non-obvious state transitions: explain the "why"
- Workarounds and special cases: document the constraint

**JSDoc/TSDoc:**

```javascript
/**
 * Renders the solar system SVG and returns it with bounding box metadata.
 * @param {Date} date - date to calculate positions for
 * @param {string} [hemisphere="north"] - "north" or "south" for season labels
 * @param {{ lat: number, lon: number, timezone: string } | null} [locationData] - observer location
 * @param {{ zoomLevel: number, width: number, height: number, centerX: number, centerY: number } | null} [viewState] - current view state
 * @returns {{ svg: SVGElement, bounds: { minX: number, minY: number, maxX: number, maxY: number } }}
 */
export function renderSolarSystem(date, hemisphere = "north", locationData = null, viewState = null)
```

**Comment Examples from codebase:**

- `// Initialize view state on first render only — preserves zoom/pan across re-renders`
- `// J2000 epoch: January 1, 2000 12:00 TT`
- `// Normalize to [0, 2π)`

## Function Design

**Size:** Small, single-responsibility functions

- Most functions < 50 lines
- Complex logic split across helper functions
- Example: `calculatePlanetPosition()` is ~6 lines (pure calculation)

**Parameters:**

- Maximum 4 explicit parameters; use objects for option groups
- Example: `renderSolarSystem(date, hemisphere, locationData, viewState)`
- No rest parameters (`...args`) used

**Return Values:**

- Explicit types: functions return one of `SVGElement`, `{ bounds }`, `{ angle, radius }`, or null
- Objects for multiple return values: `{ svg, bounds }`, `{ angle, radius, trueAnomaly }`
- Boolean methods return success/failure: `zoomIn()` returns `true` if zoom changed, `false` if
  clamped

**Example from `src/card/card-view-state.js`:**

```javascript
zoomIn() {
  if (this.zoomLevel >= MAX_ZOOM) return false;
  this.zoomLevel++;
  this._width = ZOOM_LEVELS[this.zoomLevel];
  this._height = ZOOM_LEVELS[this.zoomLevel];
  return true;
}
```

## Module Design

**Exports:**

- Named exports preferred: `export function`, `export const`, `export class`
- All public APIs are named exports
- One class per file: `SolarViewCard` in `card.js`, `ViewState` in `card-view-state.js`

**Barrel Files:**

- `src/renderer/index.js` is a barrel/coordinator that imports and uses other renderer modules
- No re-exports; just imports and calls functions internally

**Example from `src/renderer/index.js`:**

```javascript
export function renderSolarSystem(date, hemisphere = "north", locationData = null, viewState = null) {
  const svg = createSvgElement("svg", { ... });
  // ... calls internal helper functions
  renderDayNightSplit(svg, ...);
  renderSeasonOverlay(svg, ...);
  // ... does not export these helpers
}
```

## Immutability & State

**State Handling:**

- DOM state (view, zoom) lives in `ViewState` class: `centerX`, `centerY`, `zoomLevel`, `isDragging`
- Card state lives in `SolarViewCard` class: `_currentDate`, `_config`, `_hass`, `_lat`, `_lon`
- Objects are mutated in place (no immutable structures)
- Data classes (e.g., `PLANETS`, `SUN`) are read-only module-level constants

**Example from `src/card/card.js`:**

```javascript
this._viewState = null; // initialized on first render
// ... later
if (!this._viewState) {
  this._viewState = new ViewState(this._defaultZoomLevel);
  this._zoomAnimator = new ZoomAnimator(this._viewState, () => this._updateViewBox());
}
```

## Web Components

**Custom Element Pattern:**

- Extends `HTMLElement`
- Uses `attachShadow({ mode: "open" })` for DOM encapsulation
- Implements lifecycle hooks: `connectedCallback()`, `disconnectedCallback()`, `setConfig()`
- Proxy getters expose internal state: `get _zoomLevel()` proxies to `this._viewState?.zoomLevel`

**Example from `src/card/card.js`:**

```javascript
export class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._render();
    this._startAutoUpdateTimer();
  }

  disconnectedCallback() {
    clearInterval(this._autoUpdateTimer);
  }
}

customElements.define("ha-solar-view-card", SolarViewCard);
```

## SVG & Rendering

**SVG Creation Pattern:**

- Use `createSvgElement()` utility from `svg-utils.js`
- Pass namespace-aware factory function instead of `document.createElement()`
- Always use SVG namespace: `xmlns="http://www.w3.org/2000/svg"`

**Example from `src/renderer/bodies.js`:**

```javascript
const circle = createSvgElement("circle", {
  cx: x,
  cy: y,
  r: planet.size,
  fill: planet.color,
});
svg.appendChild(circle);
```

**Rendering Pipeline:**

1. Calculate positions (astronomy module)
2. Create SVG elements (renderer module)
3. Update DOM in card's shadowRoot
4. Maintain bounds tracking for zoom/pan

---

_Convention analysis: 2026-04-26_
