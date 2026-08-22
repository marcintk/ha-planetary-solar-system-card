# Planetary Solar System Card

<!-- docs/hero.png is unreferenced on purpose: it is the 1280x640 GitHub social-preview asset,
     uploaded manually under Settings -> General -> Social preview. -->

[![Planetary Solar System Card][demo-gif]](https://marcintk.github.io/ha-planetary-solar-system-card/)

Home Assistant custom Lovelace card showing all 8 planets, Moon and comet Halley aligned around the
Sun, with live NASA imagery of the Moon, Earth and the Sun — including the Moon turned to match your
own sky. Navigate time, zoom, and pan interactively.

[![Try the interactive demo](https://img.shields.io/badge/▶%20Try%20the%20interactive%20demo-41BDF5?style=for-the-badge)](https://marcintk.github.io/ha-planetary-solar-system-card/)

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
  moon: true
  earth: true
  sun: true
  slide_interval_secs: 30
```

```yaml
type: custom:ha-planetary-solar-system-card
gallery:
  position: below
  earth: true
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
| Day                   | ≥ 0°          | Sun is up                                                        |
| Civil twilight        | 0° to -6°     | Bright enough for outdoor activity without lights                |
| Nautical twilight     | -6° to -12°   | Horizon still visible at sea; too dark for most outdoor activity |
| Astronomical twilight | -12° to -18°  | Sky background glow, faint stars washed out                      |
| Night                 | < -18°        | Full dark; the Sun no longer lights the sky                      |

## Replay

The **↺** button animates the recent past, always in 36 frames over roughly five seconds, ending on
the date you were already viewing. How far back it reaches follows the last time step you took, so
the animation matches the scale you were browsing:

| Last navigation     | Replay covers        | Each frame advances |
| ------------------- | -------------------- | ------------------- |
| hour steps, or none | last 12 hours        | 20 minutes          |
| day steps           | last 36 days         | 1 day               |
| month steps         | last 180 days (~6mo) | 5 days              |

The button title shows the active window (`Replay last 12h` / `36d` / `6mo`), and the **today**
button resets it back to hours.

Day and month replays advance in whole days on purpose. The observer needle and visibility cone
track Earth's daily rotation, so a step that isn't a whole number of days would land each frame at a
different local time and spin the cone instead of showing orbital motion. Whole-day steps hold your
local time of day fixed, leaving only the planets moving.

Pressing **↺** again mid-animation stops on the frame you're viewing rather than jumping back; the
**today** button lights up to show the date is no longer live.

## Live Imagery

A thumbnail strip beside the solar view. ☷ toggles it; clicking a NASA thumbnail opens it
full-screen. Which tiles appear is `gallery.mymoon` / `gallery.moon` / `gallery.earth` /
`gallery.sun`; left-to-right order is fixed (see [Gallery](#gallery)).

| Thumbnail | Source            | Shows                                        | We fetch | Age of what you see |
| --------- | ----------------- | -------------------------------------------- | -------- | ------------------- |
| MY SKY    | [NASA SVS][svs]   | The Moon this hour, turned to match your sky | Hourly   | Under an hour       |
| MOON      | [NASA SVS][svs]   | The Moon this hour, from Earth's centre      | Hourly   | Under an hour       |
| DSCOVR/E  | [NASA EPIC][epic] | Earth's sunlit side, from L1                 | Hourly   | 1-2 days            |
| SDO/S     | [NASA SDO][sdo]   | The Sun, from geosync orbit                  | 15 min   | 25-55 min           |

### The two Moon tiles

One body, two questions, so two tiles.

**MOON** is NASA's frame exactly as published: rendered from the centre of the Earth with celestial
north up, the way every Moon photograph you have ever seen is framed. It is never wrong and it looks
the same for everyone.

**MY SKY** is the same frame, same hour, turned to match _your_ sky — rotated by the parallactic
angle for your latitude, longitude and the current moment. That rotation is the single biggest
difference between a picture of the Moon and the Moon you will actually see: it swings through
roughly ±90° depending on where you stand and when you look. Its caption says `below horizon` when
the Moon isn't up right now — true about half the time, at every latitude, because the Moon keeps
its own hours rather than the Sun's.

Both are renders, not photographs: NASA builds them from LOLA laser altimetry and the LROC
wide-angle colour mosaic, positioned by the JPL DE421 ephemeris, and publishes the whole year in
advance at one frame per hour. So unlike Earth and Sun there is no publish delay to wait out.

Because the product is published a year at a time under an id that changes each December, both Moon
tiles go blank on 1 January of a year the installed version does not know about, until a release
ships with it.

Earth's and Sun's lags are NASA's publish pipeline, not the card holding images back: EPIC processes
a day or two behind, and SDO's archive posts each 15-min frame 25 to 30 minutes after it was
captured, so the Sun you see is always about half an hour old. The card learns that delay rather
than assuming it — if SDO's pipeline stalls, it reaches further back until it finds a frame, then
walks forward again as the feed catches up.

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
| `default_zoom`         | number  | `1`     | Starting zoom level, and the level the **today** button returns to      |
| `zoom_animate`         | boolean | `true`  | Animate zoom transitions                                                |
| `periodic_zoom_change` | boolean | `false` | Cycle zoom levels on each refresh tick, until you aim the view yourself |
| `periodic_zoom_max`    | number  | `4`     | Maximum zoom level for auto-cycle (2–4)                                 |

The **today** button resets the whole view: back to `default_zoom`, the Sun re-centred, and the date
live again. It highlights in the accent colour whenever the view has drifted from that default —
zoomed, panned, or showing a date other than now — so there's always a visible way back.

With `periodic_zoom_change` enabled, zooming, panning, or stepping the date pauses the auto-cycle so
a refresh tick can't move a view you aimed yourself. The **today** button hands the view back and
the cycle resumes. Replay and the gallery don't pause it.

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

| Key                           | Type    | Default     | Description                                                                                                          |
| ----------------------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `gallery.mode`                | string  | `"show"`    | `"off"` collapses the strip, `"show"` displays every enabled tile at once, `"slide"` shows one at a time and rotates |
| `gallery.mymoon`              | boolean | `true`      | Show the MY SKY tile                                                                                                 |
| `gallery.moon`                | boolean | `false`     | Show the MOON tile                                                                                                   |
| `gallery.earth`               | boolean | `false`     | Show the DSCOVR/E tile                                                                                               |
| `gallery.sun`                 | boolean | `false`     | Show the SDO/S tile                                                                                                  |
| `gallery.position`            | string  | `"overlay"` | `"overlay"` floats the strip over the solar view, `"below"` puts it underneath and grows the card by its height      |
| `gallery.shape`               | string  | `"square"`  | `"square"` shows the frame as its source publishes it, `"circle"` crops each tile to the body itself                 |
| `gallery.slide_interval_secs` | number  | `60`        | How often `slide` mode advances to the next enabled source                                                           |

Each `gallery.<source>` boolean controls both fetching and display — a source that's off is never
requested in the background either. Render order is always MY SKY, MOON, DSCOVR/E, SDO/S, whichever
subset is enabled; it isn't configurable.

The ☷ button is always available; `mode` only decides whether the strip starts open, and whether it
shows every enabled tile at once or rotates through them.

```yaml
gallery:
  position: below
  shape: circle
  earth: true
  sun: true
```

`shape: circle` crops away each frame's black margin so the bodies float on the card, all at the
same size. It is not purely cosmetic: the default `square` keeps the margin, and because each source
frames its subject differently — Earth fills about three quarters of its frame, the Moon and Sun
closer to all of it — the bodies then render at visibly different sizes.

MY SKY follows `gallery.shape` exactly like every other tile — same crop, same size — with its
rotation applied on top. In `square` mode the rotated frame's corners swing past the tile's own
square silhouette; what shows through the gap is the tile's own backdrop, which for MY SKY is
colored by your local sky — day, twilight or night, the same bands and colors as the
[visibility cone](#horizon-twilight-zones) — rather than the plain black every other tile sits on.

Older configs keep working. `mode: none` and `mode: closed` both mean `off`; every other legacy
`mode` value (`earth`, `sun`, `both`, `open`) becomes the new default, `show`; `slide` is unchanged.
`gallery.sources` is gone — a config still setting it is ignored, and falls back to the defaults
above.

#### Adding a source later

Source names describe **what the tile shows**, not which instrument produced it. When one body gains
a second source, name the difference: the two Moon tiles are `moon` and `mymoon` — viewpoint, not
instrument — and a SOHO coronagraph beside SDO would be `corona`, because that is what it shows.

Only if nothing else distinguishes two sources does the instrument earn a place in the name, and
even then the incumbent keeps its name and the newcomer takes the qualified one (`earth` stays,
`goes-earth` joins it). Nobody's dashboard should have to be edited because the card grew a tile.

### Location

`location` (object, unset by default) — overrides HA's configured location:

| Key                  | Type                 | Default   | Description                                                                                                                                                                                          |
| -------------------- | -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location.name`      | string               | HA config | Overrides the location label shown in the status bar                                                                                                                                                 |
| `location.latitude`  | number (-90 to 90)   | HA config | Overrides HA's latitude for hemisphere/season/twilight math. Requires `location.longitude` too, else ignored                                                                                         |
| `location.longitude` | number (-180 to 180) | HA config | Overrides HA's longitude. Requires `location.latitude` too, else ignored                                                                                                                             |
| `location.timezone`  | string (IANA)        | estimated | Timezone for the clock times in the status bar — [find the name here][iana], e.g. `Europe/Warsaw`. Unset or unrecognised, it is estimated from the longitude: no daylight saving, no half-hour zones |

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
