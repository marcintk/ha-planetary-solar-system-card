# External Integrations

**Analysis Date:** 2026-04-26

## APIs & External Services

**Home Assistant Integration:**

- Lovelace custom card registration — Custom element registered at `window.customCards` for
  discovery (`src/index.js` lines 5-10)
- Configuration schema: YAML-based configuration passed via `setConfig()` method in
  `src/card/card.js` lines 59-81
- Home Assistant instance reference: `hass` object provides system configuration (location,
  timezone) via `hass.config` property (`src/card/card.js` lines 39-57)

**Astronomy Data:**

- No external API calls for planetary/astronomical data
- All orbital mechanics calculated locally using standard astronomical algorithms
- Data sources hardcoded as static arrays: planetary elements from NASA, comet data from JPL
  Small-Body Database

## Data Storage

**Databases:**

- None — this is a stateless visualization card

**File Storage:**

- Local filesystem only
- Bundle deployed as single JS file: `dist/ha-solar-view-card.js`

**Caching:**

- None — calculations performed on-demand each render cycle

## Authentication & Identity

**Auth Provider:**

- None — integrates with Home Assistant's existing authentication via `hass` object
- Card has no independent authentication or user login

## Monitoring & Observability

**Error Tracking:**

- None — no external error reporting service integrated

**Logs:**

- Browser console only (warnings via Biome linter for console usage)
- Logging approach: no structured logging; console warnings not emitted in production

## CI/CD & Deployment

**Hosting:**

- Home Assistant instance (via dashboard `www` directory)
- Static file deployment: copy `dist/ha-solar-view-card.js` to user's Home Assistant config

**CI Pipeline:**

- GitHub Actions (`.github/workflows/`)
- No deployed API or backend service

**Demo Site:**

- Static GitHub Pages demo available at https://marcintk.github.io/ha-planetary-solar-system-card/
- Standalone card (self-contained, no external data fetching)

## Environment Configuration

**Required Home Assistant Config:**

These are pulled from Home Assistant's system configuration (`hass.config`):

- `latitude` — observer's latitude for visibility calculations
- `longitude` — observer's longitude for visibility calculations
- `time_zone` — IANA timezone string (e.g., "America/Chicago") for local time display
- `location_name` — human-readable location name (optional)

**Optional Card Config:**

These are set via YAML in the Home Assistant dashboard (handled in `setConfig()`, `src/card/card.js`
lines 59-81):

- `default_zoom` — initial zoom level (1–4, default 1)
- `refresh_mins` — auto-refresh interval in minutes (default 1)
- `periodic_zoom_change` — cycle zoom levels on each refresh (default false)
- `periodic_zoom_max` — max zoom level for auto-cycle (default 4)
- `zoom_animate` — animate zoom transitions (default true)

**Secrets location:**

- No secrets; configuration is YAML-based in Home Assistant dashboard
- No `.env` files or credential files

## Webhooks & Callbacks

**Incoming:**

- None — card is passive visualization only

**Outgoing:**

- None — card does not send data to external services

## Astronomy Algorithms & Data Sources

**Orbital Mechanics:**

- Custom implementation in `src/astronomy/orbital-mechanics.js`
- Kepler's laws and mean anomaly propagation (no external library)
- References: NASA planetary fact sheets (orbital elements, periods, colors)

**Solar Position Calculation:**

- Spherical astronomy in `src/astronomy/solar-position.js`
- Computes solar declination, hour angle, and altitude for observer location
- Uses JavaScript `Intl.DateTimeFormat` for timezone-aware local time calculations
- No external astronomy library (e.g., no Ephem, PyEphem, or SkyField)

**Moon Phase:**

- Custom algorithm in `src/astronomy/moon-phase.js`
- Lunar age calculation from reference epoch

**Comet Data:**

- Static orbital elements array in `src/astronomy/comet-data.js`
- Currently includes: Halley comet
- Source: JPL Small-Body Database

**Planetary Data:**

- Static reference arrays in `src/astronomy/planet-data.js`
- Includes: Sun, 8 planets (Mercury through Neptune), Earth's Moon
- Data: orbital radius (AU), period (days), color, size, mean longitude at J2000 epoch

## Rendering

**SVG Output:**

- Native SVG generation via DOM API (`createSvgElement` in `src/renderer/svg-utils.js`)
- No external drawing library (D3, Plotly, etc.)
- SVG namespace: `http://www.w3.org/2000/svg`

## Performance & Resource Consumption

**No External Calls:**

- Card operates entirely offline after load
- No fetch/HTTP requests, WebSockets, or network I/O
- Suitable for Home Assistant instances without internet connectivity

**Browser Requirements:**

- Modern browsers supporting:
  - ES Modules (import/export)
  - Web Components (CustomElement API)
  - Shadow DOM
  - SVG DOM manipulation
  - Pointer Events API
  - Intl (for timezone-aware formatting)

---

_Integration audit: 2026-04-26_
