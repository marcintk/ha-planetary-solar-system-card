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
enabled, each refresh tick SHALL advance the zoom level by one step.

The card SHALL accept a `periodic_zoom_max` configuration option (integer, default: 4) that sets the
maximum zoom level the auto-cycle reaches before wrapping. Valid values are 2–4; values outside this
range or non-integer values SHALL default to 4 (`MAX_ZOOM`). This option only takes effect when
`periodic_zoom_change` is `true`.

After reaching `periodic_zoom_max`, the next tick SHALL wrap around to `MIN_ZOOM` (level 1). When
`zoom_animate` is enabled, each periodic zoom advance SHALL trigger an animated transition. When
`zoom_animate` is disabled, each periodic zoom advance SHALL apply instantly.

The `_advanceZoom()` method in `src/card/card.js` SHALL use the parsed `_periodicZoomMax` instance
field instead of the `MAX_ZOOM` constant when determining the wrap-around point.

#### Scenario: Zoom cycling disabled by default

- **WHEN** the card is configured without `periodic_zoom_change`
- **THEN** the zoom level SHALL NOT change automatically on refresh ticks

#### Scenario: Zoom advances on each tick (default max)

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is not set
- **AND** the current zoom level is 1
- **THEN** after one refresh tick the zoom level SHALL be 2
- **AND** after two refresh ticks the zoom level SHALL be 3
- **AND** after three refresh ticks the zoom level SHALL be 4

#### Scenario: Zoom wraps around at default max level

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is not set
- **AND** the current zoom level is 4 (`MAX_ZOOM`)
- **THEN** after one refresh tick the zoom level SHALL be 1 (`MIN_ZOOM`)

#### Scenario: Zoom wraps around at configured max level

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is `3`
- **AND** the current zoom level is 3
- **THEN** after one refresh tick the zoom level SHALL be 1 (`MIN_ZOOM`)

#### Scenario: Zoom cycle stays within configured max

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is `3`
- **AND** the current zoom level is 1
- **THEN** after one refresh tick the zoom level SHALL be 2
- **AND** after two refresh ticks the zoom level SHALL be 3
- **AND** after three refresh ticks the zoom level SHALL be 1 (wraps)

#### Scenario: Invalid periodic_zoom_max defaults to MAX_ZOOM

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is `"abc"`
- **THEN** the auto-cycle SHALL wrap at level 4 (`MAX_ZOOM`)

#### Scenario: Out-of-range periodic_zoom_max defaults to MAX_ZOOM

- **WHEN** `periodic_zoom_change` is `true` and `periodic_zoom_max` is `1`
- **THEN** the auto-cycle SHALL wrap at level 4 (`MAX_ZOOM`)

#### Scenario: periodic_zoom_max has no effect when cycling is disabled

- **WHEN** `periodic_zoom_change` is `false` and `periodic_zoom_max` is `3`
- **THEN** the zoom level SHALL NOT change automatically on refresh ticks

#### Scenario: Zoom display updates on auto-cycle

- **WHEN** `periodic_zoom_change` is `true` and a refresh tick advances the zoom level
- **THEN** the zoom level display in the navigation bar SHALL update to show the new level
- **AND** the SVG viewBox SHALL update to reflect the new zoom level

#### Scenario: Auto-cycle triggers animation when enabled

- **WHEN** `periodic_zoom_change` is `true` and `zoom_animate` is `true`
- **AND** a refresh tick advances the zoom level
- **THEN** the viewBox SHALL animate smoothly from the current level dimensions to the next level
  dimensions over approximately 2000ms

#### Scenario: Auto-cycle is instant when animation disabled

- **WHEN** `periodic_zoom_change` is `true` and `zoom_animate` is `false`
- **AND** a refresh tick advances the zoom level
- **THEN** the viewBox SHALL update instantly without animation

#### Scenario: Auto-cycle animation interrupted by next tick

- **WHEN** `periodic_zoom_change` is `true` and `zoom_animate` is `true`
- **AND** a zoom animation is still in progress when the next refresh tick fires
- **THEN** the in-progress animation SHALL be cancelled
- **AND** a new animation SHALL begin from the current interpolated position to the next zoom level

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

### Requirement: Config parsing for periodic_zoom_max

The `setConfig()` method in `src/card/card.js` SHALL parse `config.periodic_zoom_max` as an integer.
If the value is missing, non-numeric, or outside the range [2, `MAX_ZOOM`], it SHALL default to
`MAX_ZOOM` (4). The parsed value SHALL be stored as `this._periodicZoomMax`.

#### Scenario: Valid periodic_zoom_max is stored

- **WHEN** `setConfig()` is called with `{ periodic_zoom_change: true, periodic_zoom_max: 3 }`
- **THEN** `this._periodicZoomMax` SHALL be `3`

#### Scenario: Missing periodic_zoom_max defaults to MAX_ZOOM

- **WHEN** `setConfig()` is called with `{ periodic_zoom_change: true }` (no `periodic_zoom_max`)
- **THEN** `this._periodicZoomMax` SHALL be `4`

#### Scenario: Non-integer periodic_zoom_max defaults to MAX_ZOOM

- **WHEN** `setConfig()` is called with `{ periodic_zoom_max: 2.5 }`
- **THEN** `this._periodicZoomMax` SHALL be `4`

#### Scenario: Below-minimum periodic_zoom_max defaults to MAX_ZOOM

- **WHEN** `setConfig()` is called with `{ periodic_zoom_max: 1 }`
- **THEN** `this._periodicZoomMax` SHALL be `4`

### Requirement: getStubConfig includes new options

The `getStubConfig()` static method SHALL return `periodic_zoom_change: false`, `refresh_mins: 1`,
`zoom_animate: true`, and `periodic_zoom_max: 4` alongside the existing `default_zoom: 2`.

#### Scenario: Stub config includes all options

- **WHEN** `SolarViewCard.getStubConfig()` is called
- **THEN** the result SHALL include
  `{ default_zoom: 2, periodic_zoom_change: false, periodic_zoom_max: 4, refresh_mins: 1, zoom_animate: true }`
