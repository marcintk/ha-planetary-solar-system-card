# Planetary Solar System Card

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/release/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/releases)
[![License](https://img.shields.io/github/license/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/blob/main/LICENSE)
![Maintenance](https://img.shields.io/maintenance/yes/2026)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)
[![Lines of code](https://sloc.xyz/github/marcintk/ha-planetary-solar-system-card/?category=code)](https://github.com/marcintk/ha-planetary-solar-system-card)
[![CI](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun. Navigate time, zoom, and pan interactively.

## Preview

[**→ Try the interactive demo**](https://marcintk.github.io/ha-planetary-solar-system-card/)

[![Preview](https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/preview.png)](https://marcintk.github.io/ha-planetary-solar-system-card/)

## Installation

### Via HACS (recommended)

1. In HACS → Frontend → click the three-dot menu → **Custom repositories**
   - Repository: `https://github.com/marcintk/ha-planetary-solar-system-card` (exact URL)
   - Category: **Dashboard**
2. Search **Planetary Solar System Card** → Install
3. Reload your browser
4. Add the card to your dashboard (see Configuration below)

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

| Option                 | Type                   | Default   | Description                                                                                |
| ---------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `refresh_mins`         | number                 | `1`       | Auto-update interval in minutes                                                            |
| `default_zoom`         | number                 | `1`       | Starting zoom level                                                                        |
| `zoom_animate`         | boolean                | `true`    | Animate zoom transitions                                                                   |
| `periodic_zoom_change` | boolean                | `false`   | Cycle zoom levels on each refresh tick                                                     |
| `periodic_zoom_max`    | number                 | `4`       | Maximum zoom level for auto-cycle (2–4)                                                    |
| `colors`               | object                 | see below | Color overrides (see Colors)                                                               |
| `ecliptic_view`        | `"north"` \| `"south"` | `"north"` | Viewing pole: `"north"` = counter-clockwise orbits (default); `"south"` = clockwise orbits |

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

## Development

See [CLAUDE.md](CLAUDE.md) for build commands, design invariants, and release instructions.
