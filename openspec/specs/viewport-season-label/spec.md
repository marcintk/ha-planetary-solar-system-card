## Purpose

Display the current season name inside the viewport at higher zoom levels where the existing season
arc labels along Neptune's orbit are no longer visible.

## Requirements

### Requirement: Season label at high zoom levels

At zoom levels 2, 3, and 4, the card SHALL display the current season name (e.g., "Spring",
"Summer", "Autumn", "Winter") as a text label inside the visible viewport area. At zoom level 1, the
season label SHALL NOT be displayed (the existing season arc labels along Neptune's orbit are
visible at that level).

The season quadrant overlay (dividing lines and curved arc labels rendered by `renderSeasonOverlay`
in `src/renderer/seasons.js`) SHALL only be rendered at zoom level 1. At zoom levels 2, 3, and 4,
the overlay SHALL be hidden.

Implementation: `renderSolarSystem` in `src/renderer/index.js` (overlay threshold),
`renderViewportSeasonLabel` in `src/renderer/seasons.js` (label threshold).

#### Scenario: Season label visible at zoom level 2

- **WHEN** the viewBox is at zoom level 2
- **THEN** the current season name SHALL be displayed inside the viewport

#### Scenario: Season label visible at zoom level 3

- **WHEN** the viewBox is at zoom level 3
- **THEN** the current season name SHALL be displayed inside the viewport

#### Scenario: Season label visible at zoom level 4

- **WHEN** the viewBox is at zoom level 4
- **THEN** the current season name SHALL be displayed inside the viewport

#### Scenario: No season label at zoom level 1

- **WHEN** the viewBox is at zoom level 1
- **THEN** no viewport season label SHALL be displayed

#### Scenario: Season overlay hidden at zoom level 2

- **WHEN** the viewBox is at zoom level 2
- **THEN** the season quadrant overlay (dividing lines and arc labels) SHALL NOT be rendered

#### Scenario: Season overlay visible at zoom level 1

- **WHEN** the viewBox is at zoom level 1
- **THEN** the season quadrant overlay SHALL be rendered with dividing lines and arc labels

### Requirement: Season label reflects hemisphere

The displayed season name SHALL correspond to the correct season for the current date and the
configured hemisphere. The season mapping SHALL use the meteorological season model: Northern
hemisphere Spring is March–May, Summer is June–August, Autumn is September–November, Winter is
December–February. Southern hemisphere seasons SHALL be reversed.

#### Scenario: Northern hemisphere spring

- **WHEN** the date is April 15 and the hemisphere is "north"
- **THEN** the season label SHALL display "Spring"

#### Scenario: Southern hemisphere autumn

- **WHEN** the date is April 15 and the hemisphere is "south"
- **THEN** the season label SHALL display "Autumn"

#### Scenario: Northern hemisphere winter in December

- **WHEN** the date is December 21 and the hemisphere is "north"
- **THEN** the season label SHALL display "Winter"

#### Scenario: Southern hemisphere summer in December

- **WHEN** the date is December 21 and the hemisphere is "south"
- **THEN** the season label SHALL display "Summer"

### Requirement: Season label positioning

The season label SHALL be positioned in the top-right area of the current viewport. The label SHALL
update its position when the viewport changes (zoom or pan) to remain within the visible area.

#### Scenario: Label stays in viewport after pan

- **WHEN** the user pans the view
- **THEN** the season label SHALL reposition to remain in the top-right area of the visible viewport

#### Scenario: Label position updates on zoom

- **WHEN** the user changes zoom level from 3 to 4
- **THEN** the season label SHALL reposition to the top-right area of the new viewport

### Requirement: Season label visual style

The season label SHALL use the existing `SEASON_LABEL_COLOR` for its fill color and a sans-serif
font. The font size SHALL be legible at zoom levels 2, 3, and 4.

#### Scenario: Label uses season label color

- **WHEN** the season label is rendered
- **THEN** the text fill color SHALL match `SEASON_LABEL_COLOR`

#### Scenario: Label is legible at zoom level 4

- **WHEN** the season label is rendered at zoom level 4
- **THEN** the font size SHALL be large enough to be clearly readable
