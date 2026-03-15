## Purpose

Defines the season quadrant overlay rendered on the solar system visualization — dividing lines
through the Sun and curved arc labels along Neptune's orbit showing season names for each quadrant.

## Requirements

### Requirement: Season overlay visibility

The season quadrant overlay (dividing lines and curved arc labels rendered by `renderSeasonOverlay`
in `src/renderer/seasons.js`) SHALL be rendered at **all zoom levels** (1 through 4). The arc labels
SHALL be repositioned at higher zoom levels so they remain within the visible viewport.

When a `viewState` is provided and the zoom level is greater than 1, the label radius SHALL be
computed as `min(MAX_RADIUS + 20, viewState.width / 2 - margin)` so that arc labels fit within the
current viewBox. When no `viewState` is provided or zoom level is 1, the label radius SHALL default
to `MAX_RADIUS + 20` (existing behavior).

Implementation: `renderSeasonOverlay` in `src/renderer/seasons.js`, called from `renderSolarSystem`
in `src/renderer/index.js`.

#### Scenario: Season overlay visible at zoom level 1

- **GIVEN** the viewBox is at zoom level 1 (800x800)
- **WHEN** the season overlay is rendered
- **THEN** the season quadrant overlay SHALL be rendered with dividing lines and arc labels
- **AND** the label radius SHALL be `MAX_RADIUS + 20`

#### Scenario: Season overlay visible at zoom level 2

- **GIVEN** the viewBox is at zoom level 2 (640x640)
- **WHEN** the season overlay is rendered with a `viewState`
- **THEN** the season quadrant overlay SHALL be rendered with dividing lines and arc labels
- **AND** the arc labels SHALL be repositioned to fit within the 640x640 viewport

#### Scenario: Season overlay visible at zoom level 4

- **GIVEN** the viewBox is at zoom level 4 (320x320)
- **WHEN** the season overlay is rendered with a `viewState`
- **THEN** the season quadrant overlay SHALL be rendered with dividing lines and arc labels
- **AND** the arc labels SHALL be repositioned to fit within the 320x320 viewport

#### Scenario: Season overlay without viewState uses default radius

- **GIVEN** no `viewState` is provided (e.g., in tests or previews)
- **WHEN** the season overlay is rendered
- **THEN** the label radius SHALL default to `MAX_RADIUS + 20`
- **AND** behavior SHALL be identical to the existing implementation
