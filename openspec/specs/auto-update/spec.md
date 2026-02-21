### Requirement: Automatic periodic refresh
The card SHALL automatically re-render every 60 seconds to keep the displayed solar system view current. The auto-update SHALL only trigger when the currently displayed date is today (matching `new Date()`). When the user has navigated to a past or future date, the auto-update timer SHALL continue running but SHALL NOT re-render until the displayed date returns to today.

#### Scenario: Card auto-updates when showing today
- **WHEN** the card is displaying today's date
- **AND** 60 seconds have elapsed since the last render
- **THEN** the card SHALL re-render with the current time, updating the observer angle, day/night split, and planet positions

#### Scenario: Card does not auto-update when showing a different date
- **WHEN** the user has navigated to a date other than today
- **AND** 60 seconds have elapsed since the last render
- **THEN** the card SHALL NOT re-render or change the displayed date

#### Scenario: Auto-update resumes after returning to today
- **WHEN** the user clicks the "Today" button after browsing a past date
- **AND** 60 seconds elapse
- **THEN** the card SHALL resume auto-updating with the current time

### Requirement: Timer lifecycle management
The auto-update timer SHALL be started in `connectedCallback` and cleared in `disconnectedCallback` to prevent memory leaks. If `connectedCallback` fires while a timer already exists, the existing timer SHALL be cleared before creating a new one.

#### Scenario: Timer starts on connect
- **WHEN** the card element is connected to the DOM
- **THEN** a 60-second interval timer SHALL be started

#### Scenario: Timer stops on disconnect
- **WHEN** the card element is disconnected from the DOM
- **THEN** the interval timer SHALL be cleared and no further auto-updates SHALL occur

#### Scenario: Duplicate timer prevention
- **WHEN** `connectedCallback` fires while a timer is already running
- **THEN** the existing timer SHALL be cleared before a new timer is created, preventing multiple concurrent timers

### Requirement: View state preservation during auto-update
The auto-update re-render SHALL preserve the current zoom level, pan position, and view center. Only the date/time and dependent visuals (observer angle, day/night split) SHALL change.

#### Scenario: Zoom preserved across auto-update
- **WHEN** the user has zoomed in and the card auto-updates
- **THEN** the zoom level and pan position SHALL remain unchanged after re-render
