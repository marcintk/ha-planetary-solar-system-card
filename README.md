# Planetary Solar System Card

[![HACS Default](https://img.shields.io/badge/HACS-Default-41BDF5.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/release/marcintk/ha-planetary-solar-system-card.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/releases)
[![CI](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun. Navigate time, zoom, and pan interactively.

## Demo

[**→ Try the interactive demo**](https://marcintk.github.io/ha-planetary-solar-system-card/)

[![Preview](https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/example.png)](https://marcintk.github.io/ha-planetary-solar-system-card/)

## Installation

### HACS (recommended)

1. Open HACS in Home Assistant
2. Go to **Frontend** → click the three-dot menu → **Custom repositories**
3. Add `https://github.com/marcintk/ha-planetary-solar-system-card` with category **Lovelace**
4. Search for **Planetary Solar System Card** and install it
5. Reload your browser

> Once this repo is listed in the HACS default store, you can skip step 2–3 and search directly.

### Manual

1. Download `ha-solar-view-card.js` from the
   [latest release](https://github.com/marcintk/ha-planetary-solar-system-card/releases/latest)
2. Copy it to `<config>/www/ha-solar-view-card/ha-solar-view-card.js`
3. Add to Dashboard resources:
   ```yaml
   resources:
     - url: /local/ha-solar-view-card/ha-solar-view-card.js
       type: JavaScript Module
   ```
4. Restart Home Assistant

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
