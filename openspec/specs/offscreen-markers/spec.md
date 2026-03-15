## Purpose

Provide visual indicators at the viewport edge for planets and the Moon that are outside the visible
area, so users maintain spatial awareness at higher zoom levels.

## Requirements

### Requirement: Planet positions exposed from renderer

The `renderSolarSystem` function SHALL return a `positions` array alongside the existing `svg` and
`bounds` properties. Each entry SHALL contain `{ name, x, y, color }` for every planet and the Moon,
where `x` and `y` are SVG coordinate positions and `color` is the object's rendered color.

The Moon's position entry SHALL include an `offscreen: false` property to signal that offscreen
markers SHALL NOT be rendered for the Moon.

#### Scenario: Positions array includes all planets and Moon

- **WHEN** `renderSolarSystem` is called for any date
- **THEN** the returned object SHALL include a `positions` array with exactly 9 entries (8 planets
  plus Moon)
- **AND** each entry SHALL have `name`, `x`, `y`, and `color` properties

#### Scenario: Planet positions match rendered body positions

- **WHEN** `renderSolarSystem` is called
- **THEN** each planet's `x` and `y` in the positions array SHALL match the coordinates used to
  render that planet's body in the SVG

#### Scenario: Moon position entry has offscreen flag set to false

- **WHEN** `renderSolarSystem` is called for any date
- **THEN** the Moon's entry in `positions` SHALL include `offscreen: false`
- **AND** all planet entries SHALL NOT include an `offscreen` property (defaulting to eligible)

### Requirement: Off-screen marker display

When a planet falls outside the current viewBox boundaries, the card SHALL render a triangular
marker at the nearest viewport edge pointing toward the off-screen object. The marker SHALL be
accompanied by a name label identifying the object.

The Moon SHALL be excluded from offscreen marker rendering. `renderOffscreenMarkers` in
`src/renderer/offscreen-markers.js` SHALL skip any position entry where `offscreen` is `false`.

#### Scenario: Marker appears for off-screen planet

- **WHEN** the viewBox is zoomed to level 3 or higher
- **AND** a planet's SVG coordinates fall outside the visible viewBox rectangle
- **THEN** a triangular marker SHALL appear at the viewport edge nearest to that planet
- **AND** the marker SHALL point in the direction of the off-screen planet

#### Scenario: No marker for visible planet

- **WHEN** a planet's SVG coordinates fall within the visible viewBox rectangle
- **THEN** no off-screen marker SHALL be displayed for that planet

#### Scenario: Marker includes planet name

- **WHEN** an off-screen marker is displayed for a planet
- **THEN** the planet's name SHALL be displayed adjacent to the triangle marker

#### Scenario: Moon excluded from offscreen markers

- **WHEN** the Moon's SVG coordinates fall outside the visible viewBox rectangle
- **THEN** no off-screen marker SHALL be displayed for the Moon
- **AND** the Moon's position entry with `offscreen: false` SHALL be skipped by
  `renderOffscreenMarkers`

#### Scenario: All planets at zoom level 1

- **WHEN** the viewBox is at zoom level 1 (800×800) with default pan position
- **THEN** no off-screen markers SHALL be displayed (all planets fit within the viewport)

### Requirement: Off-screen marker visual style

Each off-screen marker triangle SHALL be colored to match the planet's own rendered color. The
triangle SHALL be a small filled equilateral shape (approximately 8px side length in viewBox
coordinates). The name label SHALL use the same color as the triangle, rendered in 9px sans-serif
font. Markers SHALL be placed approximately 10px inward from the viewport edge to remain fully
visible.

#### Scenario: Marker uses planet color

- **WHEN** an off-screen marker is displayed for Earth (color #4a90d9)
- **THEN** the triangle marker fill SHALL be #4a90d9
- **AND** the name label fill SHALL be #4a90d9

#### Scenario: Marker positioned inward from edge

- **WHEN** an off-screen marker is displayed
- **THEN** the triangle and label SHALL be positioned at least 10px inward from the viewport edge in
  viewBox coordinates

### Requirement: Off-screen markers update on viewport changes

Off-screen markers SHALL update whenever the viewBox changes, including zoom in/out, pan/drag, zoom
animation frames, and time navigation. The markers SHALL reflect the current viewport state at all
times.

#### Scenario: Markers update on zoom change

- **WHEN** the user zooms from level 2 to level 3
- **AND** Saturn's position falls outside the new viewBox
- **THEN** a marker for Saturn SHALL appear at the viewport edge

#### Scenario: Markers update during pan/drag

- **WHEN** the user drags the view so that a previously visible planet moves outside the viewport
- **THEN** an off-screen marker SHALL appear for that planet
- **AND** the marker SHALL update position on each drag frame

#### Scenario: Markers update on time navigation

- **WHEN** the user navigates to a different date causing planets to reposition
- **THEN** the off-screen markers SHALL update to reflect the new planet positions

#### Scenario: Planet entering viewport removes its marker

- **WHEN** the user zooms out or pans such that a previously off-screen planet enters the viewport
- **THEN** the off-screen marker for that planet SHALL be removed

### Requirement: Off-screen marker edge placement

The off-screen marker SHALL be placed at the point where the line from the viewport center to the
off-screen planet intersects the viewport edge. The triangle SHALL be rotated to point outward
toward the planet.

#### Scenario: Planet to the right produces marker on right edge

- **WHEN** a planet is off-screen to the right of the viewport
- **THEN** the marker SHALL appear on the right edge of the viewport
- **AND** the triangle SHALL point to the right

#### Scenario: Planet diagonally off-screen

- **WHEN** a planet is off-screen to the upper-right of the viewport
- **THEN** the marker SHALL appear at the intersection of the line from center to planet with the
  viewport boundary (either top or right edge, whichever is hit first)

### Requirement: Moon text label suppression

The Moon's circular body marker SHALL be rendered by `renderBody` in `src/renderer/bodies.js`, but
the text label ("Moon") SHALL be suppressed by passing `showLabel = false`. This prevents visual
clutter where the Moon and Earth labels overlap due to their close proximity (22px offset).

Implementation: `renderSolarSystem` in `src/renderer/index.js` SHALL call
`renderBody(svg, moonX, moonY, MOON, false)`.

#### Scenario: Moon body visible without text label

- **WHEN** the solar system is rendered for any date
- **THEN** the Moon's circular body marker SHALL be visible at its computed position
- **AND** no text element with content "Moon" SHALL be rendered by the Moon's `renderBody` call

#### Scenario: Moon marker dot unchanged

- **WHEN** the Moon is rendered
- **THEN** the Moon's circle element SHALL have the same size and color as before (defined by `MOON`
  in `src/astronomy/planet-data.js`)
- **AND** the Moon's orbital dotted circle around Earth SHALL remain unchanged
