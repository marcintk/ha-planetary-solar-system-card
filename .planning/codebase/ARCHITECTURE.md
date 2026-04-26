<!-- refreshed: 2026-04-26 -->

# Architecture

**Analysis Date:** 2026-04-26

## System Overview

```text
┌────────────────────────────────────────────────────────────────┐
│                  Home Assistant Integration Layer               │
│  (hass property receives HA state; registered via index.js)    │
├─────────────────┬──────────────────────────┬──────────────────┤
│   SolarViewCard │    ViewState             │  ZoomAnimator    │
│ `card/card.js`  │  `card/card-view-state.js` │ `card/zoom-animator.js`
└────────┬────────┴──────────┬───────────────┴──────────┬────────┘
         │                   │                          │
         ├─────────────────┬─┴──────────────┬───────────┤
         │                 │                │           │
         ▼                 ▼                ▼           ▼
┌──────────────────────────────────────────────────────────────┐
│                 Rendering Layer (SVG Generation)              │
│              renderSolarSystem() in `renderer/index.js`       │
├──────────────┬────────┬────────┬────────┬────────┬────────────┤
│ Bodies       │ Orbits │ Comets │ Observer │Seasons│ MoonPhase  │
│ bodies.js    │ bodies.js│comets.js│observer.js│seasons.js│moon-phase.js
│ (planets,    │        │        │(day/night,│        │ (phase    │
│  sun, moon)  │        │        │ visibility│        │  indicator)
│              │        │        │  cone)    │        │           │
└──────────────┴────────┴────────┴────────┴────────┴────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│               Astronomy Calculation Layer                      │
├──────────────┬────────────────┬─────────────┬────────────────┤
│ Orbital      │ Planet Data    │ Comet Data  │ Solar Position │
│ Mechanics    │                │             │                │
│ orbital-     │ planet-data.js │ comet-data  │ solar-position │
│ mechanics.js │ (perihelion    │.js (Halley │.js (twilight,  │
│ (planet pos, │  elements,     │orbital data)│ elevation)     │
│ moon pos,    │  colors)       │             │                │
│ comet pos)   │                │             │                │
└──────────────┴────────────────┴─────────────┴────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Utility Layer                                 │
│         SVG Utils, Date Formatting, Constants                 │
│              `renderer/svg-utils.js`                           │
└──────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component             | Responsibility                                                                                          | File                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **SolarViewCard**     | Main custom element; HA lifecycle; pan/zoom state management; event dispatch                            | `src/card/card.js`                   |
| **ViewState**         | Encapsulates SVG viewBox, zoom level, pan (center X/Y), drag tracking                                   | `src/card/card-view-state.js`        |
| **ZoomAnimator**      | Animates zoom transitions using requestAnimationFrame and easing                                        | `src/card/zoom-animator.js`          |
| **renderSolarSystem** | Master SVG renderer; orchestrates all visual elements (bodies, orbits, comets, moon, observer, seasons) | `src/renderer/index.js`              |
| **Bodies**            | Renders planets, Sun, Moon, orbits, Saturn rings, labels                                                | `src/renderer/bodies.js`             |
| **Comets**            | Renders comet orbits and bodies with dynamic tail scaling                                               | `src/renderer/comets.js`             |
| **Observer**          | Renders Earth observer needle, day/night split, visibility cone, twilight zones                         | `src/renderer/observer.js`           |
| **Seasons**           | Renders seasonal quadrant overlay (HSL gradient)                                                        | `src/renderer/seasons.js`            |
| **Moon Phase**        | Renders moon phase indicator graphic                                                                    | `src/renderer/moon-phase.js`         |
| **Orbital Mechanics** | Calculates planet/moon/comet angular positions using J2000 epoch and Kepler equations                   | `src/astronomy/orbital-mechanics.js` |
| **Solar Position**    | Calculates solar elevation, twilight transitions, sky mode classification                               | `src/astronomy/solar-position.js`    |
| **Planet Data**       | Orbital elements, visual properties (color, size, AU distance)                                          | `src/astronomy/planet-data.js`       |
| **Comet Data**        | Halley's comet orbital parameters                                                                       | `src/astronomy/comet-data.js`        |
| **SVG Utils**         | createSvgElement, coordinate transforms, bounds tracking                                                | `src/renderer/svg-utils.js`          |
| **Card Template**     | Generates HTML/CSS for shadow DOM; status bar and navigation buttons                                    | `src/card/card-template.js`          |
| **Card Styles**       | CSS for card layout, buttons, zoom controls                                                             | `src/card/card-styles.js`            |

## Pattern Overview

**Overall:** Custom web component (Web Components / Custom Elements API) with clean layering
separating Home Assistant integration, interaction management, rendering, and calculations.

**Key Characteristics:**

- Single HTMLElement subclass (`SolarViewCard`) registered as `<ha-solar-view-card>`
- Shadow DOM encapsulation for styles
- ViewState pattern isolates pan/zoom logic from component lifecycle
- Astronomy calculations decoupled from rendering (pure functions)
- SVG as output medium with declarative element creation

## Layers

**Home Assistant Integration (Card):**

- Purpose: Receive HA config/state; expose card lifecycle hooks (setConfig, hass setter,
  connectedCallback, disconnectedCallback)
- Location: `src/card/card.js` (main entry via `src/index.js`)
- Contains: SolarViewCard class, auto-update timer management, navigation event handlers
- Depends on: ViewState, ZoomAnimator, renderSolarSystem, card template/styles
- Used by: Home Assistant Lovelace dashboard

**Interaction & View Management (ViewState, ZoomAnimator):**

- Purpose: Track pan/zoom state independent of rendering; animate zoom transitions
- Location: `src/card/card-view-state.js`, `src/card/zoom-animator.js`
- Contains: Pan position (centerX, centerY), zoom level, drag state, viewBox computation
- Depends on: None (pure state containers)
- Used by: SolarViewCard for viewport updates

**Rendering (SVG Generation):**

- Purpose: Generate SVG elements for all visual components given a date, hemisphere, observer
  location, and view state
- Location: `src/renderer/` (index.js orchestrates, bodies/comets/observer/seasons/moon-phase are
  sub-modules)
- Contains: SVG element creation, positional calculations (converting AU to pixels), label rendering
- Depends on: Astronomy calculations, SVG utils
- Used by: SolarViewCard.\_render() to populate shadow DOM

**Astronomy Calculations (Pure functions):**

- Purpose: Compute celestial positions using J2000 epoch, Kepler's equation, and spherical astronomy
- Location: `src/astronomy/` (orbital-mechanics, solar-position, planet-data, comet-data)
- Contains: Position algorithms, orbital elements, twilight classification
- Depends on: None
- Used by: Rendering layer for coordinate placement

## Data Flow

### Primary Request Path (User views card on startup or navigates date)

1. **SolarViewCard.connectedCallback()** (`src/card/card.js:83-86`) — Custom element mounted,
   trigger initial render
2. **SolarViewCard.setConfig()** (`src/card/card.js:59-81`) — HA passes card config (default_zoom,
   refresh_mins, periodic_zoom_change, zoom_animate)
3. **SolarViewCard.hass setter** (`src/card/card.js:39-57`) — HA provides location (lat, lon,
   timezone, location_name); re-render if changed
4. **SolarViewCard.\_render()** (`src/card/card.js:198-232`) — Initialize ViewState on first call;
   derive hemisphere from HA location
5. **renderSolarSystem()** (`src/renderer/index.js:23-151`) — Calculate positions for all bodies at
   given date:
   - Call calculatePlanetPosition() for each planet (`src/astronomy/orbital-mechanics.js:18-24`)
   - Call calculateMoonPosition() for Earth's moon (`src/astronomy/orbital-mechanics.js:30-35`)
   - Call calculateCometPosition() for comets using Kepler solver
     (`src/astronomy/orbital-mechanics.js:55-80`)
   - Call computeSolarElevationDeg() for observer twilight zones
     (`src/astronomy/solar-position.js:43-64`)
   - Call calculateObserverAngle() for Earth observer needle direction
     (`src/renderer/observer.js:57-71`)
6. **Render sub-modules execute** in order: day/night split → seasons overlay → orbits → sun →
   planets → comets → moon → observer needle → moon phase
7. **SVG appended to shadow DOM** (`src/card/card.js:228`)
8. **viewBox set via ViewState** (`src/card/card.js:230`) and event listeners wired
   (`src/card/card.js:231`)

### Pan/Zoom Interaction Flow

1. **Pointer events on SVG** (pointerdown/pointermove/pointerup)
2. **ViewState.startDrag/updateDrag/endDrag()** update centerX/centerY based on drag delta and
   viewport scale
3. **\_updateViewBox()** reads new viewBox from ViewState and updates SVG attribute
4. **Offscreen markers refreshed** via renderOffscreenMarkers() for bodies outside current viewport

### Zoom Interaction Flow

1. **Zoom button clicked** → `_handleNavAction("zoom-in"` or `"zoom-out")`
2. **ViewState.zoomIn()/zoomOut()** increments/decrements zoom level (1-4); maps to width/height
   from ZOOM_LEVELS table
3. **\_applyZoom()** checks if animation enabled; either:
   - **With animation:** ZoomAnimator.animateTo() uses requestAnimationFrame to interpolate viewport
     dimensions over 2000ms with easeInOutCubic
   - **Without animation:** Direct \_updateViewBox() call
4. **Zoom level display updated** in status bar

### Navigation (Date/Time Change) Flow

1. **Navigation button clicked** →
   `_handleNavAction("day-forward"/"day-back"/"month-forward"/"month-back"/"today"/"hour-forward"/"hour-back")`
2. **\_navigate()** or date setter updates this.\_currentDate
3. **\_render()** called (preserves ViewState.zoomLevel/centerX/centerY across re-renders)
4. New SVG generated with positions recalculated for new date

### Auto-Update Timer Flow

1. **\_startAutoUpdateTimer()** sets interval based on config.refresh_mins
2. **Timer tick:** If date still matches today, update this.\_currentDate to new Date() and
   re-render
3. **If periodicZoomChange enabled:** Also call \_advanceZoom() to cycle through zoom levels

**State Management:**

- **Immutable per render:** this.\_currentDate (set by nav), this.\_lat/lon/timezone/locationName
  (from HA), this.\_hemisphere (derived)
- **Preserved across re-renders:** this.\_viewState (pan/zoom), this.\_zoomAnimator instance
- **Reactive to props:** hass setter triggers re-render if location changed; config changes reset
  timer

## Key Abstractions

**ViewState (Pan/Zoom Container):**

- Purpose: Isolate viewport math (viewBox computation, zoom level mapping, drag calculations) from
  card lifecycle
- Examples: `src/card/card-view-state.js`
- Pattern: Encapsulation with getter for computed viewBox string; methods for zoom/drag operations
  return success boolean

**renderSolarSystem (Scene Orchestrator):**

- Purpose: Declaratively compose all visual elements for a given date/location/zoom without side
  effects
- Examples: `src/renderer/index.js`
- Pattern: Pure function returning SVG element and metadata (bounds, positions array); renderer
  sub-modules called in dependency order (orbits behind bodies, etc.)

**Astronomy Modules (Algorithms):**

- Purpose: Pure calculation functions independent of rendering or UI state
- Examples: `src/astronomy/orbital-mechanics.js`, `src/astronomy/solar-position.js`
- Pattern: Functional, testable modules with minimal imports; rely on Date and array iteration

## Entry Points

**Custom Element Registration:**

- Location: `src/index.js`
- Triggers: Browser loads bundled dist/ha-solar-view-card.js
- Responsibilities: Define <ha-solar-view-card> tag; register with customElements.define(); register
  with Home Assistant's window.customCards

**SolarViewCard Lifecycle:**

- Location: `src/card/card.js`
- Triggers: Home Assistant Lovelace calls setConfig(), assigns hass property, inserts element into
  DOM
- Responsibilities: Initialize shadow DOM; listen for hass/config changes; coordinate rendering and
  event binding

**renderSolarSystem Entry:**

- Location: `src/renderer/index.js`
- Triggers: SolarViewCard.\_render() on mount or date/location change
- Responsibilities: Compute all celestial positions; generate SVG with orbits, bodies, and overlays

## Architectural Constraints

- **Threading:** Single-threaded event loop; astronomy calculations are CPU-bound but small O(n)
  complexity (n=planets/comets << 20); zoom animation uses requestAnimationFrame (60fps target)
- **Global state:** None. All state is instance-level (SolarViewCard holds date, hass, config;
  ViewState holds pan/zoom). Auto-update timer is per-instance.
- **Circular imports:** None detected; imports flow downward: card → renderer → astronomy; no
  back-references.
- **Custom element setup:** Must be defined before instantiation in tests; card.js never uses `new`
  operator, always `document.createElement()`
- **Shadow DOM isolation:** Styles scoped to shadow root; no global CSS pollution
- **Date model:** All calculations use Date().getTime() in milliseconds; J2000 epoch (Jan 1, 2000
  12:00 TT) as reference
- **SVG viewport:** Fixed 800px logical size; zoom and pan via viewBox attribute (not CSS transform)
- **Hemisphere determination:** Derived from HA config.latitude; updated on hass property change

## Anti-Patterns

### Over-fetching HA state

**What happens:** SolarViewCard receives entire hass object but only reads config properties
(latitude, longitude, time_zone, location_name)

**Why it's wrong:** Tightly couples card to HA's state object shape; HA might add large entity
collections causing memory bloat

**Do this instead:** `src/card/card.js:39-57` extracts only needed fields and stores them locally;
this pattern is already followed

### Rendering inside event handlers

**What happens:** None observed; all rendering is push-based via \_render() called from lifecycle or
timers

**Why it's correct:** Ensures single render path; predictable updates

### Stateful renderer

**What happens:** renderSolarSystem() is a pure function; no module-level mutable state

**Why it's correct:** Enables side-effect-free testing and composition

## Error Handling

**Strategy:** Defensive; silent fallback to safe defaults

**Patterns:**

- `src/astronomy/solar-position.js:8-24` — getLocalTimeInZone() catches invalid IANA timezone
  string; falls back to UTC
- `src/card/card.js:39-57` — hass setter checks for null location; uses defaults (null or "north"
  hemisphere)
- `src/card/card.js:59-81` — setConfig() validates zoom level bounds; clamps to [MIN_ZOOM, MAX_ZOOM]
- `src/renderer/index.js:40-42` — renderSolarSystem() finds Earth planet in array; gracefully
  handles missing data
- `src/renderer/observer.js:28-38` — rayCircleDistance() returns minLen fallback if no positive
  ray-circle intersection

## Cross-Cutting Concerns

**Logging:** `console` statements present but minimal (Biome lint warns on console); no structured
logging framework

**Validation:** Input clamping (zoom bounds), null checks (location data), try-catch for timezone
parsing

**Authentication:** None (HA handles auth; card reads derived state)

---

_Architecture analysis: 2026-04-26_
