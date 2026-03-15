### Requirement: Compact button symbols

All time navigation buttons SHALL use single-character Unicode symbols instead of multi-character
text labels. The symbol mapping SHALL be:

| Action        | Symbol | Unicode |
| ------------- | ------ | ------- |
| Month back    | ⋘      | U+22D8  |
| Day back      | «      | U+00AB  |
| Hour back     | ‹      | U+2039  |
| Hour forward  | ›      | U+203A  |
| Day forward   | »      | U+00BB  |
| Month forward | ⋙      | U+22D9  |

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

The navigation bar SHALL display all controls in a single row with the following order:
`⋘ « ‹ Today › » ⋙ Now − zoom +`. The time navigation group, "Now" button, and zoom group SHALL be
visually separated by spacing.

#### Scenario: Button order in navigation bar

- **GIVEN** the card is rendered
- **WHEN** the navigation bar is displayed
- **THEN** the buttons SHALL appear in this exact left-to-right order: month-back, day-back,
  hour-back, Today, hour-forward, day-forward, month-forward, Now, zoom-out, zoom-level, zoom-in

#### Scenario: Visual grouping with spacing

- **GIVEN** the navigation bar is rendered
- **WHEN** the user views the button layout
- **THEN** there SHALL be visible spacing separating the time navigation group from the "Now" button
  and from the zoom group

### Requirement: Uniform button height

All buttons and controls in the navigation bar SHALL have the same height. The height SHALL be small
and consistent across symbol buttons, text buttons (Today, Now), and zoom controls.

#### Scenario: All buttons same height

- **GIVEN** the navigation bar is rendered with all button types
- **WHEN** the button heights are measured
- **THEN** every button and control element SHALL have identical rendered height

#### Scenario: Buttons remain compact

- **GIVEN** the navigation bar is rendered
- **WHEN** the button sizes are observed
- **THEN** buttons SHALL use small font size and minimal padding to remain compact

### Requirement: Now button preserves zoom and pan

Pressing the "Now" button SHALL update the displayed date to the current date and time only. It
SHALL NOT reset the zoom level, zoom display, or view centre position. The user's current zoom level
and pan position SHALL be preserved after pressing "Now". When `periodic_zoom_change` is enabled,
pressing "Now" SHALL NOT interrupt the auto-cycle — the next tick SHALL continue advancing from the
current zoom level.

#### Scenario: Zoom level unchanged after pressing Now

- **WHEN** the user has set the zoom level to any value other than the default
- **AND** the user presses the "Now" button
- **THEN** the displayed date SHALL update to the current date and time
- **AND** the zoom level SHALL remain unchanged
- **AND** the zoom level indicator SHALL still display the same zoom value

#### Scenario: View centre unchanged after pressing Now

- **WHEN** the user has panned the view to a non-default position
- **AND** the user presses the "Now" button
- **THEN** the view centre SHALL remain at the same position
- **AND** the solar system SHALL re-render at the current date without repositioning the viewport

#### Scenario: Now button still navigates to today

- **WHEN** the card is displaying a past or future date
- **AND** the user presses the "Now" button
- **THEN** the displayed date SHALL change to the current real-world date and time

#### Scenario: Auto-cycle continues after pressing Now

- **WHEN** `periodic_zoom_change` is `true` and the user presses the "Now" button
- **THEN** the auto-cycle SHALL continue — the next refresh tick SHALL advance the zoom level by one
  step from the current level

### Requirement: Manual zoom resets auto-cycle position

When `periodic_zoom_change` is enabled and the user manually changes the zoom level via zoom-in or
zoom-out buttons, the auto-cycle SHALL continue from the user's new zoom level on the next refresh
tick.

#### Scenario: Manual zoom-in during auto-cycle

- **WHEN** `periodic_zoom_change` is `true` and the auto-cycle is at level 2
- **AND** the user presses the zoom-in button (advancing to level 3)
- **THEN** the next refresh tick SHALL advance the zoom level to 4

#### Scenario: Manual zoom-out during auto-cycle

- **WHEN** `periodic_zoom_change` is `true` and the auto-cycle is at level 3
- **AND** the user presses the zoom-out button (going back to level 2)
- **THEN** the next refresh tick SHALL advance the zoom level to 3
