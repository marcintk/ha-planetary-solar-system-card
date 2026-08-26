# Planetary Solar System Card

<!-- docs/hero.png is unreferenced on purpose: it is the 1280x640 GitHub social-preview asset,
     uploaded manually under Settings -> General -> Social preview. -->

[![Planetary Solar System Card][demo-gif]](https://marcintk.github.io/ha-planetary-solar-system-card/)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun, with live NASA imagery of the Moon, Earth and the Sun — including the Moon turned to match your
own sky. Navigate time, zoom, and pan interactively.

[![Try the interactive demo](https://img.shields.io/badge/▶%20Try%20the%20interactive%20demo-CD5C5C?style=for-the-badge)](https://marcintk.github.io/ha-planetary-solar-system-card/)

Have an idea or found a bug?
[Open a GitHub issue](https://github.com/marcintk/ha-planetary-solar-system-card/issues/new).

[![hacs_badge][hacs-shield]][hacs] [![GitHub Release][releases-shield]][releases]
[![License][license-shield]][license] ![Maintenance][maintenance-shield] [![CI][ci-shield]][ci]
[![Coverage][coverage-shield]][ci] [![Lines of code][sloc-shield]][repo]

## Installation

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.][my-hacs-shield]][my-hacs]

Click the badge to open this card in your own HACS, or find it manually: HACS → Frontend → search
**Planetary Solar System Card**. Then Install, reload your browser, and add the card to your
dashboard.

**Manual (w/o HACS):** drop `card.js` from the [latest release][latest-release] into
`<config>/www/ha-planetary-solar-system-card/`, then register
`/local/ha-planetary-solar-system-card/card.js` as a **JavaScript Module** under Settings →
Dashboards → Resources.

## Usage

Add the card to your dashboard:

```yaml
type: custom:ha-planetary-solar-system-card
default_zoom: 2
```

```yaml
type: custom:ha-planetary-solar-system-card
colors:
  background: "#0d1117"
  season_line: "rgba(100, 200, 255, 0.2)"
  season_label: "#e0e0ff"
```

```yaml
type: custom:ha-planetary-solar-system-card
gallery:
  mode: slide
  mymoon: false
  moon: true
  earth: true
  sun: true
  slide_interval_secs: 30
```

```yaml
type: custom:ha-planetary-solar-system-card
location:
  latitude: 51.5074
  longitude: -0.1278
  name: London
  timezone: Europe/London
```

## Horizon Twilight Zones

The visibility cone at Earth's orbit shades by how far the Sun is below your local horizon, using
the standard astronomical twilight definitions:

| Zone                  | Sun elevation | Meaning                                                          |
| --------------------- | ------------- | ---------------------------------------------------------------- |
| Day                   | ≥ -0.83°      | Sun is up — its upper limb still on the horizon                  |
| Civil twilight        | -0.83° to -6° | Bright enough for outdoor activity without lights                |
| Nautical twilight     | -6° to -12°   | Horizon still visible at sea; too dark for most outdoor activity |
| Astronomical twilight | -12° to -18°  | Sky background glow, faint stars washed out                      |
| Night                 | < -18°        | Full dark; the Sun no longer lights the sky                      |

## Replay

The **↺** button animates the recent past, always in 36 frames over roughly five seconds, ending on
the date you were already viewing:

| Last navigation     | Replay covers        | Each frame advances | Press                      |
| ------------------- | -------------------- | ------------------- | -------------------------- |
| hour steps, or none | last 12 hours        | 20 minutes          | **↺** alone — the default  |
| day steps           | last 36 days         | 1 day               | **≪** or **≫**, then **↺** |
| month steps         | last 180 days (~6mo) | 5 days              | **⋘** or **⋙**, then **↺** |

## Live Imagery

A thumbnail strip beside the solar view. ☷ toggles it; clicking a NASA thumbnail opens it
full-screen. Which tiles appear is `gallery.mymoon` / `gallery.moon` / `gallery.earth` /
`gallery.sun`; left-to-right order is fixed (see [Gallery](#gallery)).

| Thumbnail | Source            | Shows                                                   | We fetch     | Age of what you see |
| --------- | ----------------- | ------------------------------------------------------- | ------------ | ------------------- |
| MY MOON   | [NASA SVS][svs]   | The Moon in my sky — hidden when it's below the horizon | Nearest hour | ≤30 min             |
| MOON      | [NASA SVS][svs]   | The Moon from Earth's centre — no Earth in frame        | Nearest hour | ≤30 min             |
| DSCOVR/E  | [NASA EPIC][epic] | Earth's sunlit side, from L1                            | Hourly       | 1-2 days            |
| SDO/S     | [NASA SDO][sdo]   | The Sun, from geosync orbit                             | 15 min       | 25-55 min           |

Both Moon tiles are renders (LOLA + LROC + JPL DE421), not photographs — every hour of the year is
already published, so there's no delay to wait out. The card just picks whichever hour is closest to
now, which is why it's "nearest hour" rather than a fetch cadence like the other rows: there's no
new data arriving to poll for. The product still ships a year at a time under an id that changes
each December, so both tiles go blank on 1 January until a release adds the new one.

Earth's and Sun's lags are NASA's own publish pipeline: EPIC runs a day or two behind, and SDO posts
each frame 25-30 minutes after capture. The card learns SDO's actual lag rather than assuming it, so
a pipeline stall doesn't break the feed.

> **Thumbnails stuck on "unavailable"?** The browser fetches these images straight from NASA, so a
> reverse proxy in front of Home Assistant (Nginx Proxy Manager, Cloudflare Tunnel, Traefik) can
> block them with a strict `Content-Security-Policy`. Add `svs.gsfc.nasa.gov`, `epic.gsfc.nasa.gov`
> and `sdo.gsfc.nasa.gov` to that policy's `img-src`. Nothing card-side can work around it — the
> block happens before the card sees a response.

## Configuration

### Layout

| Option         | Type                                    | Default  | Description                                                                                                                   |
| -------------- | --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `height`       | `"auto"` \| number \| `"Npx"` \| `"N%"` | `"auto"` | `"auto"` = square, sized to card width. Number/`"Npx"` caps height, shrinks to fit. `"N%"` sets height as a fraction of width |
| `refresh_mins` | number                                  | `1`      | Auto-update interval in minutes                                                                                               |

### Zoom

| Option                 | Type    | Default | Description                                                             |
| ---------------------- | ------- | ------- | ----------------------------------------------------------------------- |
| `default_zoom`         | number  | `1`     | Starting zoom level, and the level the **Now** button returns to        |
| `zoom_animate`         | boolean | `true`  | Animate zoom transitions                                                |
| `periodic_zoom_change` | boolean | `false` | Cycle zoom levels on each refresh tick, until you aim the view yourself |
| `periodic_zoom_max`    | number  | `4`     | Maximum zoom level for auto-cycle (2–4)                                 |

### Appearance

| Option          | Type                              | Default   | Description                                                                                                                |
| --------------- | --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `theme`         | `"auto"` \| `"dark"` \| `"light"` | `"auto"`  | `"auto"` follows the HA theme. `"dark"`/`"light"` forces a built-in background/text pair regardless of the installed theme |
| `colors`        | object                            | see below | Color overrides (see Colors)                                                                                               |
| `ecliptic_view` | `"north"` \| `"south"`            | `"north"` | Viewing pole: `"north"` = counter-clockwise orbits; `"south"` = clockwise orbits                                           |
| `show_version`  | boolean                           | `false`   | Show the card version number in the bottom navigation bar, right-aligned                                                   |
| `debug`         | boolean                           | `false`   | Show a live overlay of gallery fetch/cache stats per NASA source (refreshes, cache hits, retries, failures)                |

### Colors

| Key                                 | Default                           | Description                          |
| ----------------------------------- | --------------------------------- | ------------------------------------ |
| `colors.background`                 | HA theme (`--ha-card-background`) | Card background                      |
| `colors.season_line`                | 25% of theme text color           | Season quadrant divider lines        |
| `colors.season_label`               | 50% of theme text color           | Season name labels (curved arc text) |
| `colors.cone_day`                   | 8% of theme text color            | Visibility cone — Sun above horizon  |
| `colors.cone_twilight_civil`        | `rgba(255, 220, 160, 0.09)`       | Civil twilight (0° to -6°)           |
| `colors.cone_twilight_nautical`     | `rgba(90, 130, 180, 0.12)`        | Nautical twilight (-6° to -12°)      |
| `colors.cone_twilight_astronomical` | `rgba(70, 50, 130, 0.18)`         | Astronomical twilight (-12° to -18°) |
| `colors.cone_night`                 | `rgba(30, 20, 60, 0.22)`          | Night (Sun below -18°)               |

### Gallery

`gallery` (object, unset by default) — Live Imagery gallery options:

| Key                           | Type    | Default     | Description                                                                                                                              |
| ----------------------------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `gallery.mode`                | string  | `"show"`    | `"off"` collapses the strip, `"show"` displays every enabled tile at once, `"slide"` shows one at a time and rotates                     |
| `gallery.position`            | string  | `"overlay"` | `"overlay"` floats the strip over the solar view, `"below"` puts it underneath and grows the card by its height                          |
| `gallery.shape`               | string  | `"square"`  | `"square"` shows the frame as its source publishes it, `"circle"` clips it to a circle sized to the body's disc (not a pixel-exact crop) |
| `gallery.slide_interval_secs` | number  | `60`        | How often `slide` mode advances to the next enabled source                                                                               |
| `gallery.mymoon`              | boolean | `true`      | Show the MY MOON tile — Moon from your sky, NASA SVS render                                                                              |
| `gallery.mymoon_tint`         | boolean | `false`     | **Beta.** Tint the MY MOON tile and its full-screen view by the Moon's own altitude (extinction) — stronger near the horizon             |
| `gallery.moon`                | boolean | `false`     | Show the MOON tile — Moon from Earth's centre, NASA SVS render                                                                           |
| `gallery.earth`               | boolean | `false`     | Show the EARTH tile — Earth from Sun–Earth L1, DSCOVR spacecraft                                                                         |
| `gallery.sun`                 | boolean | `false`     | Show the SUN tile — Sun from Earth geosync orbit, SDO spacecraft                                                                         |

### Location

`location` (object, unset by default) — overrides HA's configured location:

| Key                  | Type                 | Default   | Description                                                                                                                                                                                                                                           |
| -------------------- | -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location.name`      | string               | HA config | Overrides the location label shown in the status bar                                                                                                                                                                                                  |
| `location.latitude`  | number (-90 to 90)   | HA config | Overrides HA's latitude for hemisphere/season/twilight math. Requires `location.longitude` too, else ignored                                                                                                                                          |
| `location.longitude` | number (-180 to 180) | HA config | Overrides HA's longitude. Requires `location.latitude` too, else ignored                                                                                                                                                                              |
| `location.timezone`  | string (IANA)        | HA config | Only read when `location.latitude`/`location.longitude` override HA's own location — [find the name here][iana], e.g. `Europe/Warsaw`. Unset or unrecognised there, it's estimated from the longitude instead: no daylight saving, no half-hour zones |

<!-- Reference links -->

[my-hacs]:
  https://my.home-assistant.io/redirect/hacs_repository/?owner=marcintk&repository=ha-planetary-solar-system-card&category=plugin
[my-hacs-shield]: https://my.home-assistant.io/badges/hacs_repository.svg
[epic]: https://epic.gsfc.nasa.gov/
[sdo]: https://sdo.gsfc.nasa.gov/
[svs]: https://svs.gsfc.nasa.gov/5587/
[repo]: https://github.com/marcintk/ha-planetary-solar-system-card
[license]: https://github.com/marcintk/ha-planetary-solar-system-card/blob/main/LICENSE
[iana]: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
[demo-gif]:
  https://raw.githubusercontent.com/marcintk/ha-planetary-solar-system-card/main/docs/demo.gif
[releases]: https://github.com/marcintk/ha-planetary-solar-system-card/releases
[latest-release]: https://github.com/marcintk/ha-planetary-solar-system-card/releases/latest
[ci]:
  https://github.com/marcintk/ha-planetary-solar-system-card/actions/workflows/build-and-test.yml
[hacs]: https://hacs.xyz
[hacs-shield]: https://img.shields.io/badge/HACS-Default-41BDF5.svg
[releases-shield]: https://img.shields.io/github/release/marcintk/ha-planetary-solar-system-card.svg
[license-shield]: https://img.shields.io/github/license/marcintk/ha-planetary-solar-system-card.svg
[maintenance-shield]: https://img.shields.io/maintenance/yes/2026
[ci-shield]:
  https://img.shields.io/github/actions/workflow/status/marcintk/ha-planetary-solar-system-card/build-and-test.yml?label=CI
[coverage-shield]: https://img.shields.io/badge/coverage-100%25-brightgreen
[sloc-shield]: https://sloc.xyz/github/marcintk/ha-planetary-solar-system-card/?category=code
