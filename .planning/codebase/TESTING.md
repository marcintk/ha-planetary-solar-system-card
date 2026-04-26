# Testing Patterns

**Analysis Date:** 2026-04-26

## Test Framework

**Runner:**

- Vitest 4.0.18
- Environment: jsdom (browser-like DOM simulation)
- Config: `vitest.config.mjs`

**Assertion Library:**

- Vitest built-in `expect()` (Chai-compatible)

**Run Commands:**

```bash
npm test                              # Run all tests once
npm run test:watch                    # Run tests in watch mode (re-run on file change)
npm run test:coverage                 # Run tests with coverage report (v8 provider)
npx vitest run test/card/card.test.js # Run a single test file
```

## Test File Organization

**Location:** Co-located with source

- `src/card/card.js` → `test/card/card.test.js`
- `src/astronomy/planet-data.js` → `test/astronomy/planet-data.test.js`
- `src/renderer/svg-utils.js` → `test/renderer/svg-utils.test.js`

**Naming:** `{module}.test.js` (suffix pattern)

**Directory Structure:**

```
test/
├── astronomy/          # Tests for astronomy calculations
│   ├── planet-data.test.js
│   ├── solar-position.test.js
│   ├── moon-phase.test.js
│   ├── orbital-mechanics.test.js
│   ├── comet-data.test.js
│   └── twilight-accuracy.test.js    # Specialized accuracy test
├── card/               # Tests for card component
│   ├── card.test.js
│   ├── card-view-state.test.js
│   └── zoom-animator.test.js
└── renderer/           # Tests for SVG rendering
    ├── svg-utils.test.js
    ├── bodies.test.js
    ├── observer.test.js
    ├── seasons.test.js
    ├── moon-phase.test.js
    ├── comets.test.js
    ├── index.test.js
    └── offscreen-markers.test.js
```

## Test Structure

**Suite Organization:**

```javascript
import { describe, expect, it } from "vitest";

describe("MyComponent", () => {
  // Optional: setup/teardown
  beforeAll(() => { /* ... */ });
  afterEach(() => { /* ... */ });

  // Test suites are nested
  describe("specific feature", () => {
    it("does the right thing", () => {
      // Arrange
      const input = ...;

      // Act
      const result = ...;

      // Assert
      expect(result).toBe(...);
    });
  });
});
```

**Patterns:**

1. **Setup (beforeAll, beforeEach):**
   - Register custom elements ONCE via `beforeAll()`:

   ```javascript
   beforeAll(() => {
     if (!customElements.get("ha-solar-view-card-test")) {
       customElements.define("ha-solar-view-card-test", SolarViewCard);
     }
   });
   ```

   - Attach cards to DOM only when needed in individual tests
   - Use `document.body.appendChild(card)` to mount

2. **Teardown (afterEach):**
   - Always call `card.remove()` to unmount and allow GC
   - Reset fake timers: `vi.useRealTimers()` in afterEach blocks
   - Clear intervals manually if needed

3. **Assertion Patterns:**
   - Property checks: `expect(object).toHaveProperty("field")`
   - Truthiness: `expect(element).toBeTruthy()`, `expect(element).toBeNull()`
   - Numbers: `expect(value).toBeCloseTo(expected, precision)`, `expect(value).toBeLessThan(max)`
   - Arrays: `expect(array).toHaveLength(n)`
   - Strings: `expect(text).toMatch(/pattern/)`, `expect(text).toContain("substring")`

## Mocking

**Framework:** Vitest's `vi` module

**Patterns:**

1. **Fake Timers (for auto-update and periodic tasks):**

   ```javascript
   import { afterEach, describe, it, vi } from "vitest";

   afterEach(() => {
     vi.useRealTimers();
   });

   it("timer fires at configured interval", () => {
     vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
     const card = document.createElement("ha-solar-view-card-test");
     card.setConfig({ refresh_mins: 2 });
     document.body.appendChild(card);

     vi.advanceTimersByTime(60000); // Advance 1 minute
     // Assert card state hasn't changed yet

     vi.advanceTimersByTime(60000); // Advance another minute (2 min total)
     // Assert card updated

     card.remove();
   });
   ```

2. **Custom Element Registration (Home Assistant requirement):**
   - ALWAYS register with a test-specific name to avoid conflicts
   - Use `document.createElement()` to instantiate (not `new`)
   - Register ONCE per test suite in `beforeAll()`

3. **DOM Mocking (pointer events, bounding rectangles):**

   ```javascript
   const svg = card.shadowRoot.querySelector("#solar-view svg");
   svg.setPointerCapture = () => {}; // Mock pointer capture
   svg.releasePointerCapture = () => {};
   svg.getBoundingClientRect = () => ({
     width: 400,
     height: 400,
     x: 0,
     y: 0,
     top: 0,
     left: 0,
   });

   svg.dispatchEvent(
     new PointerEvent("pointerdown", {
       clientX: 100,
       clientY: 100,
       pointerId: 1,
     }),
   );
   ```

4. **Home Assistant hass Object:**
   - Mock as plain object with required properties
   ```javascript
   const mockHass = {
     config: {
       latitude: 51.5,
       longitude: -0.1,
       time_zone: "Europe/London",
       location_name: "London",
     },
   };
   card.hass = mockHass;
   ```

**What to Mock:**

- Timers: `vi.useFakeTimers()`, `vi.advanceTimersByTime()`
- Date/time for consistent tests
- Home Assistant `hass` object (config, location, timezone)
- Pointer events and DOM metrics (getBoundingClientRect)

**What NOT to Mock:**

- Document and DOM manipulation (jsdom provides this)
- SVG namespace and element creation (jsdom handles SVG correctly)
- Internal calculation functions (test the whole flow)
- Class constructor and method behavior (test as-is)

## Fixtures and Factories

**Test Data:**

```javascript
function createAndMount() {
  const card = document.createElement("ha-solar-view-card-test");
  document.body.appendChild(card);
  return card;
}

function clickButton(card, action) {
  const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
  btn.click();
}

function getSvgViewBox(card) {
  const svg = card.shadowRoot.querySelector("#solar-view svg");
  return svg.getAttribute("viewBox");
}

function parseViewBox(card) {
  const parts = getSvgViewBox(card).split(" ").map(Number);
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function createCardWithLocation(lat = 51.5, lon = -0.1, date = new Date("2026-03-05T12:00:00Z")) {
  const card = document.createElement("ha-solar-view-card-test");
  card._lat = lat;
  card._lon = lon;
  card._timezone = "Europe/London";
  card._locationName = "London";
  card._currentDate = date;
  document.body.appendChild(card);
  return card;
}
```

**Location:**

- Helper functions defined at top of test file (before `describe()`)
- Not in separate fixtures directory
- Example: `test/card/card.test.js` lines 37-56

## Coverage

**Target:** No explicit requirement stated in config

**View Coverage:**

```bash
npm run test:coverage
# HTML report: open coverage/index.html
# Text summary: printed to console
```

**Config (`vitest.config.mjs`):**

```javascript
coverage: {
  provider: "v8",
  include: ["src/**/*.js"],
  reporter: ["text", "html", "json-summary", "json"],
  reportsDirectory: "coverage",
}
```

## Test Types

**Unit Tests (dominant):**

- Scope: Single function or class method
- Approach: Pure calculations (astronomy module), state mutations (ViewState)
- No external dependencies; use mocks for dates and DOM
- Examples:
  - `test/astronomy/planet-data.test.js` — data structure validation
  - `test/card/card-view-state.test.js` — zoom/pan state machine
  - `test/renderer/svg-utils.test.js` — coordinate mapping functions

**Integration Tests:**

- Scope: Multiple modules working together
- Approach: Test full card lifecycle (render → interact → assert DOM)
- Use mocked `hass` object and fake timers
- Examples:
  - `test/card/card.test.js` — most tests (card + renderer + event handling)
  - `test/renderer/observer.test.js` — sun position + twilight calculations

**E2E Tests:**

- Not used in this codebase
- All testing is unit + integration via jsdom

## Common Patterns

**Async Testing:**

- No async/await in tests (no promises)
- jsdom is synchronous; DOM updates happen immediately
- Fake timers used for time-dependent behavior

**Error Testing:**

- No explicit error throwing (code uses null returns)
- Test null checks: `expect(element).toBeNull()`
- Test fallback behavior: `expect(value).toBe(defaultValue)`

**Example from `test/astronomy/solar-position.test.js`:**

```javascript
it("falls back to UTC on an invalid timezone string", () => {
  const date = new Date("2026-01-15T18:00:00Z");
  const { hours, minutes } = getLocalTimeInZone(date, "Not/A/Valid/Timezone");
  expect(hours).toBe(date.getUTCHours());
  expect(minutes).toBe(date.getUTCMinutes());
});
```

**Date/Time Testing:**

- Use explicit ISO strings: `new Date("2026-03-15T14:00:00")`
- For timezone tests: use `getLocalTimeInZone(date, "timezone")` helper
- For exact moment testing: use `vi.useFakeTimers({ now: ... })`

**Example from `test/card/card.test.js`:**

```javascript
it("hour-forward crosses day boundary", () => {
  const card = createAndMount();
  card._currentDate = new Date("2026-03-15T23:00:00");
  card._render();
  clickButton(card, "hour-forward");
  expect(card._currentDate.getHours()).toBe(0);
  expect(card._currentDate.getDate()).toBe(16);
  card.remove();
});
```

**DOM Query Patterns:**

- Always query from shadowRoot: `card.shadowRoot.querySelector(selector)`
- Verify element exists before asserting: `expect(element).not.toBeNull()`
- Check attributes: `element.getAttribute("attr-name")`
- Check text content: `element.textContent`

**Example from `test/card/card.test.js`:**

```javascript
it("nav row buttons are in correct order", () => {
  const card = createAndMount();
  const buttons = card.shadowRoot.querySelectorAll(".nav button");
  const actions = Array.from(buttons).map((el) => el.dataset.action);
  expect(actions).toEqual([
    "month-back",
    "day-back",
    "hour-back",
    "today",
    "hour-forward",
    "day-forward",
    "month-forward",
    "zoom-out",
    "zoom-in",
  ]);
  card.remove();
});
```

## Coverage Status

**Covered:**

- `src/card/` — comprehensive (card lifecycle, zoom, navigation, timers, hass setter)
- `src/astronomy/` — comprehensive (calculations, constants, edge cases)
- `src/renderer/` — good coverage (SVG generation, bounds, observers)

**Test Files:** 17 test files × ~50-200 lines each

- Total: ~2000 lines of test code
- Coverage report: `coverage/` directory generated by `npm run test:coverage`

---

_Testing analysis: 2026-04-26_
