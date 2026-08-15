# Planetary Solar System Card

[![HACS](https://img.shields.io/badge/HACS-Default-41BDF5.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/release/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/releases)
[![License](https://img.shields.io/github/license/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/blob/main/LICENSE)
![Maintenance](https://img.shields.io/maintenance/yes/2026)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)
[![Lines of code](https://sloc.xyz/github/marcintk/ha-planetary-solar-system-card/?category=code)](https://github.com/marcintk/ha-planetary-solar-system-card)
[![CI](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun. Navigate time, zoom, and pan interactively.

Have an idea or found a bug?
[Open a GitHub issue](https://github.com/marcintk/ha-planetary-solar-system-card/issues/new).

## Preview

[**→ Try the interactive demo**](https://marcintk.github.io/ha-planetary-solar-system-card/)

| Dark                                                                                                                                                                                | Light                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Preview Dark](https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/preview-dark.png)](https://marcintk.github.io/ha-planetary-solar-system-card/) | [![Preview Light](https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/preview-light.png)](https://marcintk.github.io/ha-planetary-solar-system-card/) |

### Horizon Twilight Zones

The visibility cone at Earth's orbit shades by how far the Sun is below your local horizon, using
the standard astronomical twilight definitions:

| Zone                  | Sun elevation | Meaning                                                          |
| --------------------- | ------------- | ---------------------------------------------------------------- |
| Day                   | ≥ 0°          | Sun is up                                                        |
| Civil twilight        | 0° to -6°     | Bright enough for outdoor activity without lights                |
| Nautical twilight     | -6° to -12°   | Horizon still visible at sea; too dark for most outdoor activity |
| Astronomical twilight | -12° to -18°  | Sky background glow, faint stars washed out                      |
| Night                 | < -18°        | Full dark; the Sun no longer lights the sky                      |

## Installation

### Via HACS (recommended)

1. In HACS → Frontend → search **Planetary Solar System Card** → Install
2. Reload your browser
3. Add the card to your dashboard (see Configuration below)

### Manual

1. Download `card.js` from the
   [latest release](https://github.com/marcintk/ha-planetary-solar-system-card/releases/latest)
2. Copy it to `<config>/www/ha-planetary-solar-system-card/card.js` (create the folder if needed)
3. In Home Assistant → Settings → Dashboards → Resources → **Add resource**
   - URL: `/local/ha-planetary-solar-system-card/card.js`
   - Type: **JavaScript Module**
4. Reload your browser

## Usage

Add the card to your dashboard:

```yaml
type: custom:ha-planetary-solar-system-card
default_zoom: 2
```

## Configuration

| Option                        | Type                   | Default   | Description                                                                                |
| ----------------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `refresh_mins`                | number                 | `1`       | Auto-update interval in minutes                                                            |
| `default_zoom`                | number                 | `1`       | Starting zoom level                                                                        |
| `zoom_animate`                | boolean                | `true`    | Animate zoom transitions                                                                   |
| `periodic_zoom_change`        | boolean                | `false`   | Cycle zoom levels on each refresh tick                                                     |
| `periodic_zoom_max`           | number                 | `4`       | Maximum zoom level for auto-cycle (2–4)                                                    |
| `colors`                      | object                 | see below | Color overrides (see Colors)                                                               |
| `ecliptic_view`               | `"north"` \| `"south"` | `"north"` | Viewing pole: `"north"` = counter-clockwise orbits (default); `"south"` = clockwise orbits |
| `show_version`                | boolean                | `false`   | Show card version number in the bottom-right corner of the nav bar                         |
| `gallery.mode`                | see below              | `"none"`  | L1 Imagery gallery mode (see L1 Imagery)                                                   |
| `gallery.slide_interval_secs` | number                 | `60`      | How often `slide` mode flips the displayed thumbnail between Earth and Sun                 |

### Colors

By default the card inherits the HA theme background via `--ha-card-background` (falling back to
`--card-background-color`, then `--primary-background-color`). Set `colors.background` to override.
Every color value accepts any valid CSS color string (`#rrggbb`, `rgba(…)`, named colors).

| Key                   | Default                            | Description                          |
| --------------------- | ---------------------------------- | ------------------------------------ |
| `colors.background`   | HA theme (`--ha-card-background`)  | Card background                      |
| `colors.orbit`        | 12% of theme text color (adaptive) | Orbit ring and moon-orbit stroke     |
| `colors.label`        | theme text color (adaptive)        | Planet and comet name labels         |
| `colors.season_line`  | 25% of theme text color (adaptive) | Season quadrant divider lines        |
| `colors.season_label` | 50% of theme text color (adaptive) | Season name labels (curved arc text) |

```yaml
type: custom:ha-planetary-solar-system-card
colors:
  background: "#0d1117"
  orbit: "rgba(100, 200, 255, 0.2)"
  label: "#e0e0ff"
```

### L1 Imagery

Set `gallery.mode` to something other than `"none"` and the thumbnail strip with live
[NASA SDO](https://sdo.gsfc.nasa.gov/) and [EPIC/DSCOVR](https://epic.gsfc.nasa.gov/) L1 Lagrange
point imagery shows automatically — no click needed. A nav button (▦) lets you close and reopen the
strip afterward. `"none"` by default (button hidden, nothing fetched).

| Mode    | Strip shows                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| `none`  | Nothing — gallery button hidden                                                   |
| `earth` | Earth thumbnail only                                                              |
| `sun`   | Sun thumbnail only                                                                |
| `both`  | Earth and Sun thumbnails together                                                 |
| `slide` | One thumbnail, flipping between Earth and Sun every `gallery.slide_interval_secs` |

| Thumbnail | Source                 | Look                                | Background refresh |
| --------- | ---------------------- | ----------------------------------- | ------------------ |
| L1→EARTH  | NASA EPIC/DSCOVR       | Earth, natural color                | Every 1 hour       |
| L1→SUN    | NASA SDO HMI Continuum | Sunspots, visible-light photosphere | Every 15 minutes   |

Clicking any thumbnail always opens the full-screen image view (unaffected by mode). Background
fetching for a source only happens while its thumbnail is visible in the strip, or its full-screen
view is open — never while `gallery.mode` is `"none"` or the strip/panel is closed.

```yaml
type: custom:ha-planetary-solar-system-card
gallery:
  mode: slide
  slide_interval_secs: 30
```

Some Home Assistant setups behind a strict reverse-proxy Content-Security-Policy may block requests
to `epic.gsfc.nasa.gov` / `sdo.gsfc.nasa.gov` — not fixable from the card itself.
