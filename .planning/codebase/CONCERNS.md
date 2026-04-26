# Codebase Concerns

**Analysis Date:** 2026-04-26

## Known Bugs

**Moon appears at Venus position:**

- Symptoms: Moon sometimes renders at the same coordinates as Venus, causing overlap or misplaced
  positioning
- Files: `src/renderer/index.js`, `src/astronomy/orbital-mechanics.js`, `src/renderer/moon-phase.js`
- Trigger: Specific date/time combinations; not consistently reproducible
- Root cause: `calculateMoonPosition()` in `src/astronomy/orbital-mechanics.js` uses a simplified
  mean-motion model (J2000 epoch with constant period) that doesn't account for lunar perturbations,
  libration, or precise ephemerides. The Moon's absolute angle is calculated independently of
  Earth's position, which can lead to the Moon being positioned far from Earth's actual location in
  the ecliptic plane.
- Workaround: None currently documented; affects specific date ranges unpredictably
- Impact: Critical visual error; reduces credibility of astronomy data

## Tech Debt

**Moon positioning model lacks accuracy:**

- Issue: `calculateMoonPosition()` returns an absolute ecliptic angle using mean motion only, not
  referenced to Earth's location
- Files: `src/astronomy/orbital-mechanics.js` (lines 30-35)
- Current implementation: Moon angle = J2000 mean longitude + (2π / 27.32 days) × days since J2000
- Problem: This ignores Earth's orbital position entirely. The Moon should be rendered near Earth's
  position, not as an independent body in a fixed orbital plane
- Fix approach: Calculate Moon's position relative to Earth's instantaneous orbital position, or use
  more accurate ephemeris data (e.g., MEEUS algorithms or NASA HORIZONS data)

**Configuration XSS vulnerability via locationName:**

- Issue: User-supplied `locationName` from Home Assistant config is interpolated directly into HTML
  template literals without sanitization
- Files: `src/card/card-template.js` (line 34), `src/card/card.js` (line 213-215)
- Risk: If Home Assistant's config.location_name contains HTML/script content, it will be injected
  into shadowRoot.innerHTML
- Current mitigation: Minimal — relies on Home Assistant's config validation, but no explicit
  escaping in the card
- Recommendation: Add explicit HTML escaping for `locationName` before template interpolation (e.g.,
  `escapeHtml()` utility), or use DOM methods instead of innerHTML
- Priority: Medium (requires malicious config, but Home Assistant card should be defensive)

**Periodic zoom cycling can break user interaction:**

- Issue: `periodicZoomChange` feature automatically advances zoom level on a timer
- Files: `src/card/card.js` (lines 71, 104-106, 110-116)
- Problem: If user is panning or about to interact, auto-zoom mid-interaction can trigger unintended
  behavior or disorienting view changes
- Current behavior: Zoom changes on `_refreshMs` interval (default 60 seconds), independent of user
  input
- Improvement: Add logic to pause auto-zoom while user is dragging, or add a flag to defer zoom
  changes during active pointer events
- Priority: Medium

**ViewState lacks bounds clamping for pan:**

- Issue: `updateDrag()` in `src/card/card-view-state.js` (lines 81-89) allows panning to arbitrary
  coordinates without constraints
- Problem: User can pan far outside the rendered SVG bounds (up to Infinity), causing confusing
  blank views
- Current behavior: Pan limits are not enforced; there's no automatic snap-back or boundary
  detection
- Fix approach: Clamp centerX/centerY to keep viewport within the full system bounds
  (±FULL_SYSTEM_SIZE/2)
- Priority: Low (visual UX issue, not a crash)

**DeletedButNotReplaced: openspec/ system removed:**

- Issue: Previous spec infrastructure (`openspec/` directory) was deleted in commit `07cd201` but no
  replacement specification system is in place
- Files: `openspec/specs/*` (deleted), `openspec/config.yaml` (deleted), `openspec/.gitignore`
  (deleted)
- Impact: Loss of feature specifications, design docs, and task definitions previously managed by
  OpenSpec
- Current status: CLAUDE.md references a nonexistent `openspec/config.yaml` (line 7)
- Recommendation: Either restore a spec system (new OpenSpec, MDX, or GitHub Wiki), or move all
  critical architecture docs into CLAUDE.md directly
- Priority: High (roadmap and design docs are missing)

## Performance Bottlenecks

**SVG re-render on every state change:**

- Issue: Card re-renders entire SVG on date/zoom/pan updates instead of updating in-place
- Files: `src/card/card.js` (line 214: `this.shadowRoot.innerHTML = buildCardHtml(...)`)
- Problem: Every nav button click, timer tick, or zoom triggers full DOM rebuild
- Impact: Noticeable lag on low-end devices; 18 source files + SVG generation per render
- Improvement: Implement incremental updates for pan/zoom; only rebuild on date/config changes
- Priority: Medium (affects perceived responsiveness)

**Offscreen marker calculation runs on every viewport update:**

- Issue: `renderOffscreenMarkers()` in `src/renderer/offscreen-markers.js` recalculates edge
  intersections for all positions on every pan/zoom frame
- Problem: With animation frames running at 60fps during zoom, this runs repeatedly
- Mitigation: Already optimized by rendering once per zoom event (not per frame), but could cache
  geometry if > 10 bodies
- Priority: Low (currently acceptable, only matters with many comets)

**Solar elevation and sky-mode transition computation:**

- Issue: `computeNextTransitionTime()` in `src/astronomy/solar-position.js` uses minute-by-minute
  forward scan + binary refinement
- Problem: Runs on every render; scans up to 1440 points (24 hours) per call
- Optimization available: Cache the last result and reuse if date hasn't advanced significantly
- Priority: Low (lookup is sub-second, cached at template level)

## Fragile Areas

**Visibility cone and observer angle calculations:**

- Files: `src/renderer/observer.js` (lines 57-71, 73-112, 114-150)
- Why fragile: Complex spherical-to-ecliptic projection with timezone/longitude conversion; easy to
  introduce off-by-180° or sign errors
- Test coverage: `test/renderer/observer.test.js` and `test/renderer/twilight-accuracy.test.js`
  provide good coverage, but edge cases (poles, DST boundaries) not fully tested
- Safe modification: Always run full test suite after changes to angle math; add explicit tests for
  observer.calculateObserverAngle() with known reference times (sunrise/sunset)

**Offscreen marker triangle geometry:**

- Files: `src/renderer/offscreen-markers.js` (lines 12-54, 59-77)
- Why fragile: Ray-circle intersection and triangle point calculation use floating-point math; small
  viewport changes can cause markers to jump or flicker
- Current state: Tested in `test/renderer/offscreen-markers.test.js`, but visual regression
  potential (pixel-level rendering)
- Safe modification: Always validate with multiple viewport sizes (320px, 800px, 1600px); screenshot
  compare if possible

**Season overlay label positioning:**

- Files: `src/renderer/seasons.js` (lines 56-80)
- Why fragile: Top-half arc reversal logic (line 65) has hard-coded angle ranges; changing labels or
  adding new hemispheres requires careful coordination
- Problem: Comments indicate top-half labels are hand-positioned to appear visually correct; SVG arc
  direction reversals are easy to misalign
- Safe modification: Keep corresponding unit tests in sync; manually verify label rendering after
  changes

**Moon phase indicator math:**

- Files: `src/renderer/moon-phase.js` (lines 34-80)
- Why fragile: Terminator ellipse sweep direction logic (lines 47-64) depends on phase, hemisphere,
  and illumination fraction in complex boolean branches
- Current state: Unit tests exist (`test/renderer/moon-phase.test.js`), but visual correctness
  depends on SVG arc rendering
- Safe modification: Test with known moon phases (new moon, quarter, full) in both hemispheres;
  verify against ephemeris data

**Auto-cycle-zoom animation interaction:**

- Files: `src/card/card.js` (lines 110-116), `src/card/zoom-animator.js`
- Why fragile: Zoom animation can conflict with user interactions; animator state must be carefully
  managed across pointer events and nav clicks
- Problem: If animator is mid-animation and user drags, behavior is undefined
- Safe modification: Add explicit animator cancel/pause during user input; ensure no orphaned
  animation frames

## Security Considerations

**XSS via locationName in status bar:**

- Risk: Home Assistant user provides `config.location_name`; if it contains `<script>` or event
  handlers, they execute in card's shadowRoot
- Files: `src/card/card-template.js` (line 34), `src/card/card.js` (line 213)
- Likelihood: Low (Home Assistant config is user-controlled, not attacker-controlled in typical
  deployment), but a defense-in-depth issue
- Mitigation: Implement explicit HTML entity escaping for `locationName` and `mode` strings before
  insertion
- Recommendation: Create a sanitization function, e.g. `escapeHtml(str)` using standard replacements
  (`&` → `&amp;`, etc.), and apply to all user-supplied config strings

**Timezone string injection:**

- Risk: `locationData.timezone` from HA config is passed to `Intl.DateTimeFormat()` and used in IANA
  lookup
- Files: `src/card/card-template.js` (line 26), `src/astronomy/solar-position.js` (line 10)
- Likelihood: Very low (Intl catches invalid timezones), but a string is used directly
- Mitigation: Already wrapped in try-catch in `solar-position.js` (line 9), so gracefully falls back
  to UTC
- Recommendation: No change needed; current error handling is adequate

## Test Coverage Gaps

**Card lifecycle and event handling untested:**

- Untested: `connectedCallback()`, `disconnectedCallback()`, pointer events, nav button dispatching
- Files: `src/card/card.js` (lines 83-243)
- Impact: No automated verification that pointer events update viewBox, button clicks work, or
  timers clean up
- Priority: High (interaction is core functionality)

**Configuration validation and edge cases:**

- Untested: Invalid zoom levels, out-of-range refresh intervals, null/undefined config
- Files: `src/card/card.js` (lines 59-81)
- Impact: Could crash or behave unpredictably with malformed Home Assistant config
- Priority: Medium (HA likely validates, but card should be defensive)

**SVG rendering with extreme zoom levels:**

- Untested: Rendering at zoom level 4 with maximum pan offset; visual bounds correctness
- Files: `src/renderer/index.js`, `src/card/zoom-animator.js`
- Current: Unit tests exist but don't verify visual output
- Priority: Low (functionality works, but no visual regression detection)

## Scaling Limits

**SVG DOM grows with comet count:**

- Current: COMETS array has 1 entry (Halley)
- Limit: SVG rendering becomes slow with > 50 bodies (each body = circle + text + optional rings)
- Scaling path: Implement level-of-detail rendering (hide labels at far zoom, use simplified comets
  beyond 20px diameter)
- Current state: Acceptable up to ~10 comets; beyond that, consider culling or LOD

**Observer visibility cone rendering:**

- Current: Fixed cone geometry per viewport update
- Limit: Cone is clipped against entire SVG bounds; becomes expensive with many zones/clipPaths
- Current state: Only 1 visibility cone at a time; acceptable

## Missing Critical Features (from CLAUDE.md TODO)

**Earth-centric view not implemented:**

- Problem: All objects are Sun-centric; no way to switch to Earth-centric view where Earth stays
  fixed and other bodies move relative to it
- Blocks: Users cannot intuitively understand geocentric astronomy, which is useful for some
  observations
- Workaround: None; requires architectural change

**Zodiac constellations not implemented:**

- Problem: No constellation background or constellation labels
- Blocks: Users cannot correlate planetary positions with zodiacal signs
- Workaround: None; requires new renderer module

**Hemisphere hemisphere information not displayed:**

- Problem: CLAUDE.md notes "add information if this Northern or Southern hemisphere" but current
  code only uses hemisphere for season labels
- Blocks: Users may not realize they're seeing Southern Hemisphere seasons if their Home Assistant
  is in SH
- Current: Hemisphere is correctly derived (line 207 in `src/card/card.js`) but not displayed to
  user
- Improvement: Add hemisphere label to status bar or info panel

**Auto-zoom to fit all planets:**

- Problem: No automatic zoom level selection to keep all objects in view
- Blocks: On very zoomed-in views, Neptune can be off-screen; user must manually zoom out
- Improvement: Compute bounds from all positions and auto-select MIN_ZOOM or intermediate level

---

_Concerns audit: 2026-04-26_
