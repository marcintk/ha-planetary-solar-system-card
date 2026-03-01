## Purpose

Defines the visibility arc display at Earth's orbital position. The arcs communicate the current daylight and twilight conditions to the observer, using the Sun's elevation angle derived from existing orbital data.

## Requirements

### Requirement: Fixed horizon arc
The visibility display at Earth's orbital position SHALL include a fixed outer arc spanning exactly 180° (half-angle 90°), centred on the observer's zenith direction. This arc represents the complete visible hemisphere above the observer's horizon and SHALL always be rendered regardless of the Sun's position.

#### Scenario: Outer arc is always 180 degrees
- **GIVEN** the card is rendered for any date and time
- **WHEN** the visibility arcs at Earth's position are displayed
- **THEN** the outer arc SHALL subtend exactly 180° (half-angle 90°)
- **AND** the outer arc SHALL be centred on the computed observer zenith direction

#### Scenario: Outer arc does not change with solar position
- **GIVEN** the card displays a date where the Sun is below the horizon
- **WHEN** the outer arc is rendered
- **THEN** its angular extent SHALL remain 180°

### Requirement: Dynamic twilight arc
The visibility display SHALL include a second inner arc whose angular extent reflects the current twilight condition at the observer's position. The inner arc half-angle SHALL be computed from the Sun's elevation angle relative to the observer's horizon:

| Sun elevation | Inner arc half-angle |
|---|---|
| Above horizon (≥ 0°) | 90° (coincides with outer arc — no twilight zone visible) |
| 0° to −18° below horizon | `90° + elevation_deg` (shrinks from 90° toward 72°) |
| Below −18° (full astronomical night) | Arc SHALL NOT be rendered |

The angular distance between the outer arc and the inner arc represents the twilight zone — the portion of sky that is illuminated by the Sun even though the Sun itself is below the horizon.

#### Scenario: No twilight wedge during daytime
- **GIVEN** the computed solar elevation is greater than or equal to 0°
- **WHEN** the visibility arcs are rendered
- **THEN** the inner arc half-angle SHALL equal 90°
- **AND** no visible gap SHALL exist between the inner and outer arcs

#### Scenario: Twilight wedge grows as Sun sets
- **GIVEN** the Sun's elevation is between 0° and −18°
- **WHEN** the visibility arcs are rendered
- **THEN** the inner arc half-angle SHALL equal `90 + elevation_degrees`
- **AND** a visible wedge SHALL appear between the inner and outer arcs
- **AND** the wedge SHALL widen as the Sun moves deeper below the horizon

#### Scenario: Inner arc absent during full night
- **GIVEN** the Sun's elevation is below −18°
- **WHEN** the visibility arcs are rendered
- **THEN** the inner arc SHALL NOT be rendered

### Requirement: Solar elevation computed from orbital data
The solar elevation angle used for the twilight arc SHALL be derived from the existing Earth orbital angle and observer angle already available at render time. No external geolocation or astronomical API SHALL be required.

The computation SHALL use a proper angular difference function (e.g. `atan2(sin(a−b), cos(a−b))`) to avoid 2π wrap-around errors.

#### Scenario: Correct solar elevation at local noon
- **GIVEN** the observer angle aligns with the Earth-to-Sun direction
- **WHEN** solar elevation is computed
- **THEN** the elevation SHALL be approximately 90° (Sun overhead)

#### Scenario: Correct solar elevation at local midnight
- **GIVEN** the observer angle points directly away from the Sun
- **WHEN** solar elevation is computed
- **THEN** the elevation SHALL be approximately −90° (Sun directly below)
