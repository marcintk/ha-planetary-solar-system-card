# Codebase Concerns

**Analysis Date:** 2026-04-26

## Known Bugs

**Moon renders at Venus's position for some dates:**

- Symptoms: Moon icon overlaps Venus (or appears far from Earth) on certain date/time combinations.
- Files: `src/renderer/index.js` (lines 110-114), `src/astronomy/orbital-mechanics.js` (lines
  30-35), `src/astronomy/planet-data.js` (line 76-83)
- Trigger: Date-dependent; tracked in `.planning/BACKLOG.md` under "Fixes"
- Root cause: `calculateMoonPosition(date)` returns the Moon's mean ecliptic longitude from J2000
  using only its own mean motion (`MOON.meanLongitudeJ2000 + 2π/27.32 × days`). The renderer in
  `src/renderer/index.js` then places the Moon on a 22-pixel circle centered on Earth using that
  absolute angle, but the angle is not Earth-relative — so the rendered direction from Earth to Moon
  depends on coincidental phase alignment between Earth's mean longitude and the Moon's mean
  longitude. When the two cancel toward Venus, the Moon appears next to Venus rather than next to
  Earth's day/night terminator side.
- Workaround: None. Affects unpredictable date ranges.
- Impact: High — visible visual error; reduces credibility of the visualization.

## Tech Debt

**Moon position uses mean longitude in heliocentric frame, not Earth-relative geometry:**

- Issue: `calculateMoonPosition()` ignores Earth's instantaneous orbital position. The Moon's
  position is conceptually "an angle around the Sun" using mean motion, then re-anchored to Earth
  visually by the renderer.
- Files: `src/astronomy/orbital-mechanics.js` (lines 30-35), `src/renderer/index.js` (lines 105-114)
- Fix approach: Compute the Moon's geocentric ecliptic longitude (e.g., a Meeus-style series, or at
  minimum subtract Earth's mean longitude so the Moon's angle is referenced to the Earth-Sun line),
  then apply that as the offset angle around Earth in the renderer.
- Priority: High (drives the "Moon at Venus" bug above).

**`renderSolarSystem()` returns a `bounds` field that no production code consumes:**

- Issue: `src/renderer/index.js` builds and returns `bounds` (`{ minX, minY, maxX, maxY }`) but the
  only caller, `src/card/card.js` line 222, destructures only `{ svg, positions }`. The bounds are
  computed every render via `expandBounds()` calls scattered through the function and then
  discarded. Tests at `test/renderer/index.test.js` (lines 14-18) and `test/card/card.test.js`
  (lines 58-81) still assert against `bounds`, so removing it would require test updates.
- Files: `src/renderer/index.js` (lines 30, 52, 66, 80, 84, 101, 130, 144),
  `src/renderer/svg-utils.js` (lines 28-33), `test/renderer/index.test.js` (lines 14-18),
  `test/card/card.test.js` (lines 58-81)
- Impact: Dead computation on every render; misleading `@returns` JSDoc; test surface for an unused
  contract.
- Fix approach: Either drop the `bounds` field entirely (and remove `expandBounds`,
  `bounds`-asserting tests), or wire `bounds` into card.js for an "auto-fit" zoom feature (which is
  the matching item in `.planning/BACKLOG.md` under "Auto zoom level to fit all planets in view").
- Priority: Medium (no functional impact, but it is a load-bearing-looking API that does nothing).

**`MARKER_GROUP_ID` exported twice with two different mechanisms:**

- Issue: `src/renderer/offscreen-markers.js` declares `const MARKER_GROUP_ID` at line 6 (no `export`
  keyword) then re-exports it at the bottom via `export { MARKER_GROUP_ID }` (line 157). This works
  but is inconsistent with every other constant/function in the renderer module (which use inline
  `export const`/`export function`).
- Files: `src/renderer/offscreen-markers.js` (lines 6, 157)
- Fix approach: Move `export` inline at line 6 and delete the trailing `export {}` block.
- Priority: Low (style/consistency only).

**Configuration XSS surface via `locationName`:**

- Issue: `buildStatusBarHtml()` interpolates `locationName` directly into a template literal that
  becomes `shadowRoot.innerHTML` in card.js. Same applies to `mode` (the sky-mode string), but
  `mode` comes from a fixed enum.
- Files: `src/card/card-template.js` (line 34), `src/card/card.js` (line 215)
- Risk: If a Home Assistant config supplies a `location_name` containing HTML or `<script>`, it is
  injected into the shadow DOM. Likelihood is low (HA config is owned by the same user running the
  card) but this is a defense-in-depth issue.
- Fix approach: Add an `escapeHtml()` helper and apply it to `locationName` before interpolation, or
  render the status bar via DOM APIs instead of `innerHTML`.
- Priority: Medium.

**Periodic auto-zoom can fight active user interaction:**

- Issue: `_startAutoUpdateTimer()` advances zoom on every refresh tick when
  `periodic_zoom_change: true`, with no check for whether the user is mid-drag or has just clicked.
- Files: `src/card/card.js` (lines 93-117)
- Behavior: A 60s tick can call `_advanceZoom()` while a `pointerdown`/`pointermove` sequence is in
  progress, which interrupts the drag and reshapes the viewBox under the cursor.
- Fix approach: Skip `_advanceZoom()` when `this._viewState.isDragging` is true, or when the zoom
  animator is mid-animation (`this._zoomAnimator.isAnimating`).
- Priority: Medium.

**Pan offset is unbounded:**

- Issue: `ViewState.updateDrag()` sets `centerX`/`centerY` from drag deltas with no clamp. A user
  who pans far enough sees a blank background with no bodies in view and no auto-recenter.
- Files: `src/card/card-view-state.js` (lines 80-89)
- Fix approach: Clamp `centerX`/`centerY` to keep the viewport overlapping the system bounds (e.g.,
  `±FULL_SYSTEM_SIZE/2 ± width/2`), or snap back on pointer up.
- Priority: Low (UX wart, not a crash).

## Documentation Drift

**`STRUCTURE.md` still lists `TEAM.md`:**

- Files: `.planning/codebase/STRUCTURE.md` (line 84)
- Problem: The directory tree still contains
  `├── TEAM.md                        # Team contact info`, but `TEAM.md` was deleted from the repo
  root earlier today. `find -maxdepth 2 -name TEAM.md` returns nothing.
- Fix approach: Remove the line from the tree diagram in `STRUCTURE.md`.
- Priority: Medium (low cost; high impact on planner trust in the doc).

**`CONVENTIONS.md` documents a removed `viewState` parameter on `renderSolarSystem`:**

- Files: `.planning/codebase/CONVENTIONS.md` (lines 168, 171, 191, 229)
- Problem: The JSDoc example, the "max 4 parameters" example, and the "Example from
  `src/renderer/index.js`" code block all show
  `renderSolarSystem(date, hemisphere = "north", locationData = null, viewState = null)`. The actual
  current signature in `src/renderer/index.js` (line 22) is
  `renderSolarSystem(date, hemisphere = "north", locationData = null)` — `viewState` was removed in
  commit `faf385f` earlier today.
- Fix approach: Update the four occurrences to match the 3-parameter signature, and reword the "max
  4 parameters" rationale to use a different example.
- Priority: Medium (a planner reading CONVENTIONS.md would re-introduce the parameter on edits).

## Performance Bottlenecks

**Full SVG rebuild on every nav action and on every refresh tick:**

- Issue: `_render()` sets `shadowRoot.innerHTML = buildCardHtml(...)` and rebuilds the entire SVG
  via `renderSolarSystem()` — orbits, planets, comets, season overlay, day/night cone, moon-phase
  indicator — for every date change, every "Now" click, every minute tick when on today's date.
- Files: `src/card/card.js` (lines 199-228)
- Impact: Each render reconstructs the shadow DOM and re-runs every astronomy/renderer module.
  Acceptable on desktop, but noticeable on low-end HA dashboards (Raspberry Pi tablets).
- Fix approach: Split static structure (orbits, season overlay, AU labels) from per-frame structure
  (planet positions, day/night cone, observer needle), and update only the latter on date change.
- Priority: Medium.

**Twilight transition scan is up to 1440 minute samples per render:**

- Issue: `computeNextTransitionTime()` scans up to 24 hours minute-by-minute, recomputing
  `computeSolarElevationDeg()` on each step, then runs 10-iteration binary search for refinement. It
  is invoked from `buildStatusBarHtml()` on every render (status bar is included in the same
  `innerHTML` rebuild as the SVG).
- Files: `src/astronomy/solar-position.js` (lines 89-127), `src/card/card-template.js` (line 22)
- Impact: A scan that finds nothing (e.g. polar night) costs 1440 trig evaluations per render.
- Fix approach: Memoize on `(lat, lon, floor(time / 60s))`, or step in larger increments first and
  only refine near sign changes of `(elevation - threshold)`.
- Priority: Low (sub-second today, but worth caching since the result is reused across many ticks).

## Fragile Areas

**Day/night cone half-angle and color logic:**

- Files: `src/renderer/observer.js` (lines 114-150)
- Why fragile: `renderDayNightSplit()` selects between `computeSolarElevationDeg()` (true spherical
  astronomy) and `calculateSolarElevationDeg()` (orbital approximation) based on whether
  `locationData.lat` is set, and then derives both `coneColor` and `halfAngle` from the chosen
  value. The branching is a single chain of if/else — easy to introduce off-by-180° errors when
  modifying.
- Test coverage: `test/renderer/index.test.js` exercises day/twilight/night fills but does not cover
  the fallback path (`locationData = null` with daylight time of day).
- Safe modification: Always run `npm test` after touching this function; add a fixture test for
  `locationData = null` at noon to lock the orbital fallback.

**Moon-phase terminator path arc sweeps:**

- Files: `src/renderer/moon-phase.js` (lines 33-81)
- Why fragile: `terminatorSweep` is selected by a 2x2 truth table over `litOnRight` and
  `bulgeRight`. Hemisphere flipping at line 52 inverts `litOnRight`, which means a hemisphere change
  has to be propagated through the sweep computation correctly. Tests cover phase but the logic is
  opaque.
- Safe modification: Run `test/renderer/moon-phase.test.js` and visually verify with both
  hemispheres at the four canonical phases (new/first quarter/full/third quarter).

**Saturn rendering replaces `planet.size` mid-loop:**

- Files: `src/renderer/index.js` (lines 61-85)
- Why fragile: When `planet.name === "Saturn"`, the renderer creates `saturnOverride` with half size
  and renders the body at that size, then renders rings at the original `planet.size`. Two separate
  `expandBounds()` calls then use different sizes. A future addition (e.g. Jupiter rings) would be
  tempted to copy this pattern and inherit its quirks.
- Safe modification: If adding more ringed bodies, factor the special-case into a
  `renderRingedBody()` helper that owns both the body resize and the bounds bookkeeping.

**Season-arc top-half radius adjustment:**

- Files: `src/renderer/seasons.js` (lines 56-83)
- Why fragile: Top-half arcs use `arcRadius = labelRadius - 12` to make labels visually equidistant
  with bottom-half labels, and the arc direction (`A ... 0 0 1` vs `A ... 0 0 0`) is reversed
  between halves so `textPath` flows readably. The 12-pixel correction is a magic number.
- Safe modification: Don't change `SEASON_FONT_SIZE` (line 5) without re-tuning the offset.

## Security Considerations

**XSS via `locationName` in status bar:**

- See "Configuration XSS surface via `locationName`" under Tech Debt above. Same root cause and fix;
  listed here for security audit visibility.

**Timezone string passed to `Intl.DateTimeFormat`:**

- Files: `src/astronomy/solar-position.js` (lines 10-23), `src/card/card-template.js` (line 26)
- Risk: The `time_zone` string from HA config is passed to `Intl.DateTimeFormat` constructors. If
  invalid, `Intl` throws, and `getLocalTimeInZone()` already wraps the call in `try/catch` falling
  back to UTC. `buildStatusBarHtml()` does not wrap its `Intl.DateTimeFormat` construction in
  try/catch — a malformed timezone string would throw out of `_render()`.
- Fix approach: Wrap the `Intl.DateTimeFormat` construction in `card-template.js` (line 25) in a
  try/catch with a UTC fallback, mirroring `solar-position.js`.
- Priority: Low (HA validates timezones, but the card crashing the dashboard on a config typo is
  worse than falling back to UTC).

## Test Coverage Gaps

**`renderSolarSystem()` fallback path with `locationData = null`:**

- What's not tested: Day/night cone color and half-angle when no location is configured (the orbital
  approximation in `calculateSolarElevationDeg()`).
- Files: `src/renderer/observer.js` (line 142, the `else` branch), `test/renderer/index.test.js`
- Risk: The fallback path is the default state for users without HA location set; regressions there
  would not be caught by existing tests.
- Priority: Medium.

**No assertions on the unused `bounds` semantic in card.js consumption:**

- What's not tested: That dropping `bounds` from `renderSolarSystem`'s return shape does not affect
  card.js. See "renderSolarSystem returns a bounds field that no production code consumes" above.
- Risk: Tests still validate `bounds` exists, but no test validates that card behavior is
  independent of it. Refactoring would require reasoning about the test surface.
- Priority: Low.

**`escape`/sanitization tests for `buildStatusBarHtml`:**

- What's not tested: Behavior when `locationName` contains `<`, `>`, or `&`.
- Files: `src/card/card-template.js`, `test/card/card-template.test.js`
- Risk: Without an assertion that special characters are escaped, any future "fix" to add escaping
  has no regression net.
- Priority: Medium (paired with the XSS fix above).

**Pointer-event lifecycle on disconnect during drag:**

- What's not tested: `disconnectedCallback()` is called while `_isDragging` is true. Currently the
  `setInterval` is cleared but `_viewState.isDragging` is left true; reconnecting starts a new
  `_render()` flow on top of stale drag state.
- Files: `src/card/card.js` (lines 88-91, 176-197), `test/card/card.test.js`
- Risk: Edge case; rare in practice.
- Priority: Low.

## Scaling Limits

**Comet count vs SVG node count:**

- Current: `COMETS` array contains a single entry (Halley) in `src/astronomy/comet-data.js`.
- Limit: Each comet contributes an ellipse orbit, a body circle, a tail line, a label, and an
  off-screen marker — roughly 5 SVG nodes plus one Kepler solve per render. Past ~50 comets, the
  per-render Kepler solves and node creation become noticeable on low-end clients.
- Scaling path: Cull comets outside the current viewport pre-render; share a single `<defs>` ellipse
  template and reposition via `<use>`.

**`offscreen-markers` runs `edgeIntersection()` per body per zoom event:**

- Current: ~10 bodies (8 planets, Moon, Halley) → 10 ray/rectangle solves per pan/zoom update.
- Limit: Acceptable; only re-runs when `_updateOffscreenMarkers()` is called (after pan, zoom, full
  render). Not a per-frame cost during animation.
- Scaling path: Memoize the rectangle bounds per ViewState; skip recomputation if `centerX`,
  `centerY`, `width`, `height` are unchanged.

## Missing Features (Backlog)

The features list in `.planning/BACKLOG.md` is the source of truth for missing capabilities. Listed
here only for completeness during a concerns pass:

- Earth-centric view (Earth fixed, all other bodies move relative to it).
- Zodiac constellations background.
- Northern/Southern hemisphere indicator in the status bar.
- Auto-zoom to fit all bodies — the closest existing surface is the unused `bounds` return value
  from `renderSolarSystem()` (see Tech Debt above).

---

_Concerns audit: 2026-04-26_
