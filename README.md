# Planetary Solar System Card

[![HACS Default](https://img.shields.io/badge/HACS-Default-41BDF5.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/release/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/releases)
[![CI](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun. Navigate time, zoom, and pan interactively.

## Preview

[**→ Try the interactive demo**](https://marcintk.github.io/ha-planetary-solar-system-card/)

[![Preview](https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/example.png)](https://marcintk.github.io/ha-planetary-solar-system-card/)

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
type: custom:ha-solar-view-card
default_zoom: 2
```

## Configuration

| Option                 | Type    | Default | Description                             |
| ---------------------- | ------- | ------- | --------------------------------------- |
| `refresh_mins`         | number  | `1`     | Auto-update interval in minutes         |
| `default_zoom`         | number  | `1`     | Starting zoom level                     |
| `zoom_animate`         | boolean | `true`  | Animate zoom transitions                |
| `periodic_zoom_change` | boolean | `false` | Cycle zoom levels on each refresh tick  |
| `periodic_zoom_max`    | number  | `4`     | Maximum zoom level for auto-cycle (2–4) |

## Development

See [CLAUDE.md](CLAUDE.md) for build commands and design invariants.
