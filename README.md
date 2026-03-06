## Summary

Home Assistant custom Lovelace card (`ha-solar-view-card`) that displays a planetary solar system.

Shows alignment of all 8 planets and Moon centered on the Sun for a given date, with interactive navigation (day/month forward/back, return to today).

It automatically updates the view every 60 seconds.

## Features

### Planetary solar system visualization

All 8 planets (Mercury through Neptune) and the Moon are rendered at their correct orbital positions for the displayed date. Each body is color-coded, sized for visibility, and labeled by name. Jupiter and Saturn are the largest; Earth and Moon are enlarged to make their relative positioning clear against the Sun. Orbits are drawn as dashed circles. The Moon's orbit around Earth is shown as a smaller dotted circle that moves with Earth.

**Logarithmic orbit scaling** prevents inner planets from being squished into the center. Distances are mapped on a log scale so Mercury, Venus, Earth, and Mars all have readable separation despite their much smaller AU values compared to the outer planets.

**AU distance labels** appear on both the top and bottom of every orbit line, showing each planet's distance from the Sun in Astronomical Units.

### Earth visibility cone

A semi-transparent cone extends from Earth's surface to show the observer's visible sky at the current time of day. The cone automatically accounts for Earth's rotation — it points toward local noon at midday and away from the Sun at midnight.

The cone color reflects the actual solar elevation angle:

| Phase | Elevation | Color |
|---|---|---|
| Daytime | ≥ 0° | White |
| Civil twilight | 0° to −6° | Warm amber |
| Nautical twilight | −6° to −12° | Cool blue-white |
| Astronomical twilight | −12° to −18° | Deep indigo |
| Night | < −18° | Near-invisible |

During twilight, the cone expands below the horizon — the lower the Sun, the wider the cone — reflecting the portion of sky still lit by refracted sunlight.

A **dashed horizon line** at Earth always marks the full 180° boundary of the visible hemisphere. An **observer needle** points from Earth's center toward the zenith direction, making it easy to read which side of Earth is facing the Sun.

### Season quadrants

The view is divided into four quadrants by dotted lines through the center. Curved season labels follow the outer orbit arc — **Winter, Spring, Summer, Autumn** — so you can immediately read which season Earth (or any planet) is entering. Labels automatically swap for the **Southern Hemisphere** if the browser's geolocation reports a negative latitude.

### Date navigation

Seven buttons let you step through time in both directions:

| Button | Action |
|---|---|
| `⇐` | Back 1 month |
| `«` | Back 1 day |
| `‹` | Back 1 hour |
| `Now` | Jump to current date and time |
| `›` | Forward 1 hour |
| `»` | Forward 1 day |
| `⇒` | Forward 1 month |

The current date and time are shown in the card header (`YY-MM-DD HH:MM`).

### Zoom and pan

Four zoom levels let you focus on the inner planets or pull back to see the full solar system. Use the `−` and `+` buttons to change zoom; the current level is shown between them. Click and drag anywhere on the visualization to pan the view.

### Auto-refresh

When showing today's date, the card silently updates every 60 seconds so planetary positions and the visibility cone stay current without any interaction.

## Development

This is AI generated project with use of specification ([openspec](https://github.com/Fission-AI/OpenSpec)) to implement enhacement or fix issues. 

More on development in [CLAUDE.md](CLAUDE.md).

## Installation

This can be installed in Home Assistant as:
- copy JavaScript file (dist/ha-solar-view-card.js) to the folder: `<config directory>/www/ha-solar-view-card/ha-solar-view-card.js` i.e. via Terminal.
- add the following to your Home Assistant Dashboard resources configuration:

    ```yaml
    resources:
    - url: /local/ha-solar-view-card/ha-solar-view-card.js?hacstag=1
      type: JavaScript Module
    ```
- restart Home Assistant
- on dashboard card, add below to complete the visualization:

    ```yaml
    - type: custom:ha-solar-view-card
      default_zoom: 2
    ```

### Example:

![Example of the display](example.png)

## TODO:

### Features
- add some other object like comets i.e. Halley
- add Earth centric view (every update should move all objects except Earth)
- add zodiac constellations
- add moon phases
- add information if this Northern or Southern hemisphere
- add auto zoom level to fit all planets in view
- add changing zoom level every n minutes
- add configurations options:
  - refresh time, default: 60 seconds 
  - zoom level to fit all planets, default: false
  - centric view, default: Sun (or Earth)

### Fixes
- sometimes Moon is on Venus position
