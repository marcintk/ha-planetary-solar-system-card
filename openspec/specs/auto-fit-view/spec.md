### Requirement: Auto-fit viewBox calculated on render
On first render, the card SHALL set the viewBox to a fixed full-system extent showing all 8 orbits (VIEW_SIZE x VIEW_SIZE centered on CENTER), instead of calculating a bounding-box fit. The view SHALL NOT change based on planet positions.

#### Scenario: Default view shows full solar system
- **WHEN** the card renders the solar system for the first time
- **THEN** the SVG viewBox SHALL be set to show the full coordinate system (0, 0, VIEW_SIZE, VIEW_SIZE) so all orbits from Mercury to Neptune are visible

#### Scenario: View is consistent across dates
- **WHEN** the card renders for any date
- **THEN** the initial viewBox SHALL be identical regardless of planet positions, providing a stable frame of reference

#### Scenario: ViewBox maintains square aspect ratio
- **WHEN** the full-system viewBox is applied
- **THEN** the viewBox SHALL use equal width and height (VIEW_SIZE) centered on CENTER, maintaining a 1:1 aspect ratio

### Requirement: Auto-fit restores on reset
When the user triggers a view reset (Today button), the viewport SHALL return to the fixed full-system viewBox, resetting both zoom and pan state.

#### Scenario: Today button resets to full system view
- **WHEN** the user has zoomed in and panned away from center, then clicks the "Today" button
- **THEN** the viewport SHALL reset to the full-system viewBox (0, 0, VIEW_SIZE, VIEW_SIZE) with the Sun and all orbits visible

### Requirement: Zoom-out clamped to full system view
The maximum zoom-out level SHALL be clamped to the fixed full-system extent (VIEW_SIZE) rather than a dynamically computed bounding box size.

#### Scenario: Zoom-out limit
- **WHEN** the user zooms out repeatedly
- **THEN** the viewBox SHALL NOT exceed VIEW_SIZE in width or height, keeping the view within the full solar system extent

### Requirement: View state persists across date navigation
When the user navigates to a different date (day/month forward/back), the current zoom level and pan position SHALL be preserved. Only the planet positions update.

#### Scenario: Zoom persists on day navigation
- **WHEN** the user has zoomed to show only inner planets and clicks day-forward
- **THEN** the viewBox dimensions (zoom level) SHALL remain the same, and only planet positions SHALL update

#### Scenario: Pan persists on month navigation
- **WHEN** the user has panned to an off-center position and clicks month-forward
- **THEN** the viewBox center position SHALL remain the same, and only planet positions SHALL update
