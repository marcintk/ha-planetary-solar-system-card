### Requirement: Renderer returns bounding box with SVG
The `renderSolarSystem()` function SHALL return an object `{ svg, bounds }` where `bounds` is `{ minX, minY, maxX, maxY }` representing the bounding box of all rendered celestial bodies (planets, Moon, Sun) including their sizes and label offsets.

#### Scenario: Bounding box includes all planets
- **WHEN** `renderSolarSystem(container, date)` is called for any date
- **THEN** the returned `bounds` SHALL encompass the center coordinates of every planet, the Moon, and the Sun, extended by each body's radius and label space

#### Scenario: Bounding box accounts for Moon offset
- **WHEN** the Moon is rendered at its offset from Earth
- **THEN** the `bounds` SHALL include the Moon's position (Earth position + Moon pixel offset) so the Moon is never clipped

### Requirement: Auto-fit viewBox calculated on render
On each render, the card SHALL calculate a viewBox that fits the bounding box returned by the renderer, with 2% margin added on each side, and apply it as the default viewport.

#### Scenario: Default view shows all planets
- **WHEN** the card renders the solar system for any date
- **THEN** the SVG `viewBox` SHALL be set so that all planets, the Moon, and the Sun are visible within the viewport with margin

#### Scenario: Margin prevents edge clipping
- **WHEN** the auto-fit viewBox is calculated from bounds `{ minX, minY, maxX, maxY }`
- **THEN** the viewBox SHALL extend 2% of the bounding box size beyond minX and maxX, and 2% of the bounding box size beyond minY and maxY

#### Scenario: ViewBox maintains square aspect ratio
- **WHEN** the bounding box is not square (width ≠ height)
- **THEN** the viewBox SHALL use the larger dimension for both width and height, centered on the bounding box center, to maintain a 1:1 aspect ratio

### Requirement: Auto-fit restores on reset
When the user triggers a view reset (Today button), the viewport SHALL return to the auto-fit viewBox calculated from the current planet positions, resetting both zoom and pan state.

#### Scenario: Today button resets to auto-fit
- **WHEN** the user has zoomed in and panned away from center, then clicks the "Today" button
- **THEN** the viewport SHALL reset to the auto-fit viewBox for today's date, with the Sun and all planets visible

### Requirement: View state persists across date navigation
When the user navigates to a different date (day/month forward/back), the current zoom level and pan position SHALL be preserved. Only the planet positions update.

#### Scenario: Zoom persists on day navigation
- **WHEN** the user has zoomed to show only inner planets and clicks day-forward
- **THEN** the viewBox dimensions (zoom level) SHALL remain the same, and only planet positions SHALL update

#### Scenario: Pan persists on month navigation
- **WHEN** the user has panned to an off-center position and clicks month-forward
- **THEN** the viewBox center position SHALL remain the same, and only planet positions SHALL update
