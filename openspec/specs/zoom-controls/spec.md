### Requirement: Zoom in button increases zoom level
The card SHALL display a zoom in button labeled "+" in the nav row that decreases the viewBox dimensions by a factor of 0.8 when clicked, zooming into the current viewport center.

#### Scenario: Zoom in from default level
- **WHEN** the viewport is at auto-fit level and the user clicks the "+" button
- **THEN** the viewBox width and height SHALL be multiplied by 0.8, centered on the current viewport center

#### Scenario: Zoom in at maximum level
- **WHEN** the viewBox dimensions are at the minimum (100×100) and the user clicks the "+" button
- **THEN** the viewBox dimensions SHALL remain at 100×100 (button click has no effect)

### Requirement: Zoom out button decreases zoom level
The card SHALL display a zoom out button labeled "−" in the nav row that increases the viewBox dimensions by a factor of 1.25 when clicked, zooming out from the current viewport center.

#### Scenario: Zoom out from zoomed-in level
- **WHEN** the viewport is zoomed in and the user clicks the "−" button
- **THEN** the viewBox width and height SHALL be multiplied by 1.25, centered on the current viewport center

#### Scenario: Zoom out at maximum level
- **WHEN** the viewBox dimensions equal the auto-fit dimensions and the user clicks the "−" button
- **THEN** the viewBox dimensions SHALL remain at the auto-fit size (cannot zoom out past showing all planets)

### Requirement: Zoom applied via SVG viewBox
The SVG element's `viewBox` attribute SHALL be updated directly to reflect the current zoom level and pan position. The viewBox SHALL be derived from the card's view state as `(centerX - viewWidth/2, centerY - viewHeight/2, viewWidth, viewHeight)`.

#### Scenario: ViewBox reflects zoom state
- **WHEN** the zoom level changes via button click
- **THEN** the SVG element's `viewBox` attribute SHALL be updated to reflect the new viewWidth and viewHeight, maintaining the current centerX and centerY

#### Scenario: ViewBox reflects pan state
- **WHEN** the user pans the view by dragging
- **THEN** the SVG element's `viewBox` attribute SHALL be updated to reflect the new centerX and centerY, maintaining the current viewWidth and viewHeight

### Requirement: Zoom buttons positioned at edges of nav row
The zoom out (−) and zoom in (+) buttons SHALL be grouped together at the right end of the nav row as a single button pair. The buttons SHALL share a visual grouping with no internal gap — the left button (−) SHALL have rounded corners on the left side only, and the right button (+) SHALL have rounded corners on the right side only.

#### Scenario: Button order in nav row
- **WHEN** the card is rendered
- **THEN** the nav row buttons SHALL appear in this order: [<<] [<] [Today] date+time [>] [>>] [−][+]

#### Scenario: Zoom buttons visually grouped
- **WHEN** the card is rendered
- **THEN** the zoom − and + buttons SHALL appear as a connected pair with no gap between them, with shared border-radius (left-rounded on −, right-rounded on +)

### Requirement: Zoomed content is clipped to card bounds
The SVG container SHALL be wrapped in a container with `overflow: hidden` so that SVG content does not overflow the card boundaries.

#### Scenario: Overflow hidden on wrapper
- **WHEN** the card is rendered
- **THEN** the `.solar-view-wrapper` element SHALL have `overflow: hidden` CSS applied

### Requirement: Nav buttons sized to fit single row
All nav row buttons (including zoom buttons) SHALL use compact padding so that all 7 buttons plus the date/time label fit on a single line within typical Home Assistant card widths. Buttons SHALL use padding of `2px 5px`, font-size of `10px`, and the nav row SHALL use a gap of `4px`.

#### Scenario: All buttons fit on one line
- **WHEN** the card is rendered at default HA card width (~400px)
- **THEN** all nav buttons and the date/time label SHALL be visible on a single row without wrapping

#### Scenario: Compact button sizing
- **WHEN** the card is rendered
- **THEN** nav buttons SHALL have padding of `2px 5px`, font-size of `10px`, and the nav row gap SHALL be `4px`

### Requirement: Zoom resets on date navigation
The zoom level and pan position SHALL NOT reset when the user navigates to a different date. They SHALL only reset when the user clicks the "Today" button.

#### Scenario: Zoom persists on day navigation
- **WHEN** the user has zoomed in and clicks the day-forward button
- **THEN** the viewBox dimensions and center position SHALL remain unchanged; only planet positions update

#### Scenario: Today resets zoom and pan
- **WHEN** the user has zoomed and panned, then clicks the "Today" button
- **THEN** the viewBox SHALL reset to the auto-fit dimensions for today's date
