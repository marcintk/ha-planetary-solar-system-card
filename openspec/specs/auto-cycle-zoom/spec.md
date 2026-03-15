### Requirement: Configurable refresh interval

The card SHALL accept a `refresh_mins` configuration option (number, default: 1) that controls the
auto-update interval in minutes. The timer SHALL use `refresh_mins * 60000` as the interval for
`setInterval`. Values less than 0.1 SHALL be clamped to 0.1 (6 seconds minimum). Non-numeric or
missing values SHALL default to 1.

#### Scenario: Default refresh interval is 1 minute

- **WHEN** the card is configured without a `refresh_mins` option
- **THEN** the auto-update timer SHALL fire every 60000ms

#### Scenario: Custom refresh interval

- **WHEN** the card is configured with `refresh_mins: 5`
- **THEN** the auto-update timer SHALL fire every 300000ms

#### Scenario: Invalid refresh_mins is ignored

- **WHEN** the card is configured with `refresh_mins: "abc"` or `refresh_mins: -1`
- **THEN** the auto-update timer SHALL use the default interval of 60000ms

#### Scenario: Timer recreated on config change

- **WHEN** the card is already connected and `setConfig` is called with a new `refresh_mins` value
- **THEN** the existing timer SHALL be cleared and a new timer SHALL be created with the updated
  interval

### Requirement: Periodic zoom cycling

The card SHALL accept a `periodic_zoom_change` configuration option (boolean, default: false). When
enabled, each refresh tick SHALL advance the zoom level by one step. After reaching MAX_ZOOM (level
4), the next tick SHALL wrap around to MIN_ZOOM (level 1).

#### Scenario: Zoom cycling disabled by default

- **WHEN** the card is configured without `periodic_zoom_change`
- **THEN** the zoom level SHALL NOT change automatically on refresh ticks

#### Scenario: Zoom advances on each tick

- **WHEN** `periodic_zoom_change` is `true` and the current zoom level is 1
- **THEN** after one refresh tick the zoom level SHALL be 2
- **AND** after two refresh ticks the zoom level SHALL be 3

#### Scenario: Zoom wraps around at max level

- **WHEN** `periodic_zoom_change` is `true` and the current zoom level is 4 (MAX_ZOOM)
- **THEN** after one refresh tick the zoom level SHALL be 1 (MIN_ZOOM)

#### Scenario: Zoom display updates on auto-cycle

- **WHEN** `periodic_zoom_change` is `true` and a refresh tick advances the zoom level
- **THEN** the zoom level display in the navigation bar SHALL update to show the new level
- **AND** the SVG viewBox SHALL update to reflect the new zoom level

### Requirement: ViewState setZoomLevel method

The `ViewState` class SHALL provide a `setZoomLevel(level)` method that directly sets the zoom level
to the specified value. The level SHALL be clamped to the range [MIN_ZOOM, MAX_ZOOM]. The viewBox
width and height SHALL update to match the new level.

#### Scenario: Set zoom level directly

- **WHEN** `setZoomLevel(3)` is called on a ViewState at level 1
- **THEN** the zoom level SHALL be 3
- **AND** the viewBox width and height SHALL be 480

#### Scenario: Level is clamped to valid range

- **WHEN** `setZoomLevel(10)` is called
- **THEN** the zoom level SHALL be MAX_ZOOM (4)

### Requirement: getStubConfig includes new options

The `getStubConfig()` static method SHALL return `periodic_zoom_change: false` and `refresh_mins: 1`
alongside the existing `default_zoom: 2`.

#### Scenario: Stub config includes all options

- **WHEN** `SolarViewCard.getStubConfig()` is called
- **THEN** the result SHALL include
  `{ default_zoom: 2, periodic_zoom_change: false, refresh_mins: 1 }`
