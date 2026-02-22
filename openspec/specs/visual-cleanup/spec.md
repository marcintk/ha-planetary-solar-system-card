### Requirement: SVG background inherits card background
The SVG view SHALL have a transparent background so it inherits the card's background color, ensuring no visible color boundary between the view and the card.

#### Scenario: No background mismatch
- **WHEN** the solar system SVG is rendered inside the card
- **THEN** the SVG element SHALL NOT have a hardcoded background color and SHALL display with the card's background showing through

#### Scenario: Theme compatibility
- **WHEN** the card background color changes (e.g., via HA theme)
- **THEN** the SVG view SHALL automatically match because it has no independent background

### Requirement: Date displays 2-digit year
The date display SHALL format the year as 2 digits (last two digits of the full year).

#### Scenario: Current date formatting
- **WHEN** the current date is 2026-02-16 at 14:30
- **THEN** the date SHALL be displayed as `26-02-16 14:30`

#### Scenario: Year rollover
- **WHEN** the date is 2030-01-01 at 00:00
- **THEN** the date SHALL be displayed as `30-01-01 00:00`

### Requirement: Card padding minimized
The `.card` element SHALL use 2px padding on all sides to maximize the visualization area within the card. The navigation button row SHALL have minimal vertical separation from the SVG visualization.

#### Scenario: Card padding value
- **WHEN** the card is rendered
- **THEN** the `.card` CSS padding SHALL be `2px`

#### Scenario: Visualization fills card area
- **WHEN** the solar system SVG is displayed inside the card
- **THEN** the SVG SHALL occupy nearly the full card width and height, with only 2px of space on each edge

#### Scenario: Minimal gap between visualization and buttons
- **WHEN** the navigation button row is rendered below the SVG visualization
- **THEN** the `.nav` container SHALL have a `margin-top` of no more than 2px, minimizing the vertical space between the visualization and the navigation controls

