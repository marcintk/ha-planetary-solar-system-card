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

### Requirement: Saturn rings are narrow and bold
Saturn's rings SHALL be rendered as a narrow, bold ellipse to ensure visibility at small rendering sizes.

#### Scenario: Ring width
- **WHEN** Saturn is rendered with a body size of S pixels
- **THEN** the ring ellipse `rx` SHALL be `S * 1.4` (narrower than previous `S * 2.0`)

#### Scenario: Ring stroke weight
- **WHEN** Saturn's rings are rendered
- **THEN** the ring stroke-width SHALL be `6` (bolder than previous `4`)

#### Scenario: Ring vertical proportion unchanged
- **WHEN** Saturn's rings are rendered with a body size of S pixels
- **THEN** the ring ellipse `ry` SHALL remain `S * 0.5` to maintain the tilted-ellipse appearance
