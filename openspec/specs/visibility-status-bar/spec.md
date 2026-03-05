## Purpose

Defines the transparent status bar overlay rendered at the top of the solar
system SVG. It displays the observer's location name, current sky condition
with solar elevation, and the time of the next mode transition — providing
actionable sky-condition information without extending the card dimensions.

## Requirements

### Requirement: Status bar overlay at top of card
A status bar element SHALL be rendered inside `.solar-view-wrapper` as an
absolutely-positioned overlay at the top of the SVG area. It SHALL have a fully
transparent background so the SVG is visible behind it. It SHALL NOT increase
the card's height or shift any other element.

#### Scenario: Status bar is positioned at top of solar view
- **GIVEN** the card is rendered with HA location data available
- **WHEN** the card HTML is built
- **THEN** a status bar element SHALL exist within `.solar-view-wrapper`
- **AND** it SHALL be positioned at the top edge of the SVG area
- **AND** `.solar-view-wrapper` SHALL use `position: relative`
- **AND** the status bar SHALL use `position: absolute; top: 0; left: 0; right: 0`

#### Scenario: Status bar background is transparent
- **GIVEN** the card is rendered
- **WHEN** the status bar element is present
- **THEN** its background SHALL be fully transparent (no opaque fill)
- **AND** the SVG content behind it SHALL remain visible

#### Scenario: Card height is unchanged by status bar
- **GIVEN** the card is rendered with the status bar
- **WHEN** the card layout is measured
- **THEN** the overall card height SHALL be the same as without the status bar

### Requirement: Status bar text format
The status bar SHALL display a single line of text in the format:

  `<location_name>  |  <Mode> (<elevation>°)  |  Next: <HH:MM>`

where:
- `<location_name>` is `hass.config.location_name`
- `<Mode>` is one of: `Day`, `Civil Twilight`, `Nautical Twilight`, `Astronomical Twilight`, `Night`
- `<elevation>` is the current solar elevation rounded to the nearest integer
- `<HH:MM>` is the time of the next mode transition in the HA timezone (24-hour format)
- If no transition is found within 24 hours, the `| Next: <HH:MM>` segment SHALL be omitted

#### Scenario: Daytime display format
- **GIVEN** the solar elevation is above 0°
- **WHEN** the status bar is rendered
- **THEN** the mode text SHALL be `Day`
- **AND** the elevation SHALL be a positive integer followed by `°`

#### Scenario: Night display without next transition (polar night)
- **GIVEN** the observer is in polar night with no transition in 24 hours
- **WHEN** the status bar is rendered
- **THEN** the text SHALL show `Night` and elevation
- **AND** the `| Next:` segment SHALL NOT be present

#### Scenario: Twilight modes labelled correctly
- **GIVEN** the solar elevation is between −6° and 0° (exclusive)
- **WHEN** the status bar is rendered
- **THEN** the mode text SHALL be `Civil Twilight`

- **GIVEN** the solar elevation is between −12° and −6° (exclusive)
- **WHEN** the status bar is rendered
- **THEN** the mode text SHALL be `Nautical Twilight`

- **GIVEN** the solar elevation is between −18° and −12° (exclusive)
- **WHEN** the status bar is rendered
- **THEN** the mode text SHALL be `Astronomical Twilight`

### Requirement: Status bar hidden without HA location
If no HA location data is available (e.g. the card is rendered before `set hass`
is called, or `hass.config.latitude` is undefined), the status bar element SHALL
NOT be rendered.

#### Scenario: No status bar before hass is set
- **GIVEN** the card renders before `set hass(hass)` is called
- **WHEN** the card HTML is inspected
- **THEN** no status bar element SHALL be present in the shadow DOM

#### Scenario: Status bar appears after hass is set
- **GIVEN** the card has rendered without location data
- **WHEN** `set hass(hass)` is called with valid location data and a re-render occurs
- **THEN** the status bar SHALL be present in the rendered output
