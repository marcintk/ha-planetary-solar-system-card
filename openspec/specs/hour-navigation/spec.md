### Requirement: Hour-level time navigation
The system SHALL provide hour-level navigation buttons that advance or rewind the displayed date/time by exactly 1 hour per click. The hour navigation buttons SHALL use single-character Unicode symbols: `‹` (U+2039) for hour-back and `›` (U+203A) for hour-forward.

#### Scenario: Step forward by one hour
- **GIVEN** the current displayed date/time is 2026-03-15 14:00
- **WHEN** the user clicks the hour-forward button (`›`)
- **THEN** the displayed date/time SHALL update to 2026-03-15 15:00
- **AND** all planet positions SHALL recalculate for the new time

#### Scenario: Step backward by one hour
- **GIVEN** the current displayed date/time is 2026-03-15 14:00
- **WHEN** the user clicks the hour-back button (`‹`)
- **THEN** the displayed date/time SHALL update to 2026-03-15 13:00
- **AND** all planet positions SHALL recalculate for the new time

#### Scenario: Hour navigation crosses day boundary
- **GIVEN** the current displayed date/time is 2026-03-15 23:00
- **WHEN** the user clicks the hour-forward button (`›`)
- **THEN** the displayed date/time SHALL update to 2026-03-16 00:00

#### Scenario: Hour navigation crosses day boundary backward
- **GIVEN** the current displayed date/time is 2026-03-15 00:00
- **WHEN** the user clicks the hour-back button (`‹`)
- **THEN** the displayed date/time SHALL update to 2026-03-14 23:00

### Requirement: Current Time navigation
The system SHALL provide a "Now" button that sets the displayed date/time to the current system date and time without resetting zoom level or view center position.

#### Scenario: Jump to current time preserving view
- **GIVEN** the user has zoomed into a specific region and navigated to a past date
- **WHEN** the user clicks the "Now" button
- **THEN** the displayed date/time SHALL update to the current system date and time
- **AND** the zoom level SHALL remain unchanged
- **AND** the view center position SHALL remain unchanged
- **AND** all planet positions SHALL recalculate for the current time

#### Scenario: Now vs Today distinction
- **GIVEN** the user has zoomed into a specific region
- **WHEN** the user clicks the "Today" button
- **THEN** the displayed date/time SHALL update to the current system date and time
- **AND** the zoom level SHALL reset to the default
- **AND** the view center SHALL reset to the default

### Requirement: Generalized time navigation method
The `_navigate()` method SHALL accept a millisecond delta value instead of a day count. Hour navigation SHALL pass `±3600000` and day navigation SHALL pass `±86400000`. Month navigation SHALL remain a separate operation using `Date.setMonth()`.

#### Scenario: Navigate by hour delta
- **GIVEN** the navigation method receives a delta of 3600000 (1 hour in ms)
- **WHEN** the method executes
- **THEN** the current date SHALL advance by exactly 1 hour

#### Scenario: Navigate by day delta
- **GIVEN** the navigation method receives a delta of 86400000 (1 day in ms)
- **WHEN** the method executes
- **THEN** the current date SHALL advance by exactly 1 day
