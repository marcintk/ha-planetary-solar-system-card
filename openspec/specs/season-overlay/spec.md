### Requirement: Season overlay visibility

The season quadrant overlay (dividing lines and curved arc labels rendered by `renderSeasonOverlay`
in `src/renderer/seasons.js`) SHALL be rendered at **all zoom levels** (1 through 4). The arc labels
SHALL always use a fixed radius of `MAX_RADIUS + 20`, regardless of the current zoom level or
viewport size.

The `renderSeasonOverlay` function SHALL accept only `svg` and `hemisphere` parameters. The
`viewState` parameter SHALL be removed from the function signature and from the call site in
`renderSolarSystem` (`src/renderer/index.js`).

Implementation: `renderSeasonOverlay` in `src/renderer/seasons.js`, called from `renderSolarSystem`
in `src/renderer/index.js`.

#### Scenario: Season overlay at zoom level 1 uses fixed radius

- **GIVEN** the viewBox is at zoom level 1 (800x800)
- **WHEN** the season overlay is rendered
- **THEN** the season quadrant overlay SHALL be rendered with dividing lines and arc labels
- **AND** the label radius SHALL be `MAX_RADIUS + 20`

#### Scenario: Season overlay at zoom level 2 uses same fixed radius

- **GIVEN** the viewBox is at zoom level 2 (640x640)
- **WHEN** the season overlay is rendered
- **THEN** the label radius SHALL be `MAX_RADIUS + 20`
- **AND** the labels SHALL NOT be repositioned to fit the viewport

#### Scenario: Season overlay at zoom level 4 uses same fixed radius

- **GIVEN** the viewBox is at zoom level 4 (320x320)
- **WHEN** the season overlay is rendered
- **THEN** the label radius SHALL be `MAX_RADIUS + 20`
- **AND** the labels SHALL NOT be repositioned to fit the viewport

#### Scenario: renderSeasonOverlay does not accept viewState

- **GIVEN** the `renderSeasonOverlay` function in `src/renderer/seasons.js`
- **WHEN** the function is called
- **THEN** it SHALL accept exactly two parameters: `svg` and `hemisphere`
- **AND** it SHALL NOT reference `viewState` or zoom level in its label radius calculation
