### Requirement: Compact button symbols
All time navigation buttons SHALL use single-character Unicode symbols instead of multi-character text labels. The symbol mapping SHALL be:

| Action | Symbol | Unicode |
|--------|--------|---------|
| Month back | ⋘ | U+22D8 |
| Day back | « | U+00AB |
| Hour back | ‹ | U+2039 |
| Hour forward | › | U+203A |
| Day forward | » | U+00BB |
| Month forward | ⋙ | U+22D9 |

#### Scenario: Button labels render as single characters
- **GIVEN** the card is rendered in the browser
- **WHEN** the navigation bar is displayed
- **THEN** each time navigation button SHALL display exactly one Unicode character
- **AND** all symbol buttons SHALL have visually uniform width

#### Scenario: Month navigation uses triple-angle symbols
- **GIVEN** the navigation bar is displayed
- **WHEN** the user views the month navigation buttons
- **THEN** month-back SHALL display `⋘` and month-forward SHALL display `⋙`

### Requirement: Unified button bar layout
The navigation bar SHALL display all controls in a single row with the following order: `⋘ « ‹ Today › » ⋙ Now − zoom +`. The time navigation group, "Now" button, and zoom group SHALL be visually separated by spacing.

#### Scenario: Button order in navigation bar
- **GIVEN** the card is rendered
- **WHEN** the navigation bar is displayed
- **THEN** the buttons SHALL appear in this exact left-to-right order: month-back, day-back, hour-back, Today, hour-forward, day-forward, month-forward, Now, zoom-out, zoom-level, zoom-in

#### Scenario: Visual grouping with spacing
- **GIVEN** the navigation bar is rendered
- **WHEN** the user views the button layout
- **THEN** there SHALL be visible spacing separating the time navigation group from the "Now" button and from the zoom group

### Requirement: Uniform button height
All buttons and controls in the navigation bar SHALL have the same height. The height SHALL be small and consistent across symbol buttons, text buttons (Today, Now), and zoom controls.

#### Scenario: All buttons same height
- **GIVEN** the navigation bar is rendered with all button types
- **WHEN** the button heights are measured
- **THEN** every button and control element SHALL have identical rendered height

#### Scenario: Buttons remain compact
- **GIVEN** the navigation bar is rendered
- **WHEN** the button sizes are observed
- **THEN** buttons SHALL use small font size and minimal padding to remain compact
