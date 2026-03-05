## Purpose

Defines the visibility cone and horizon line displayed at Earth's orbital position. These elements communicate the current daylight, twilight, and night conditions to the observer, using the Sun's elevation angle computed from the observer's real geographic location via the `observer-location` capability.

## Requirements

### Requirement: Fixed horizon arc
The visibility display at Earth's orbital position SHALL include a fixed dashed
line spanning exactly 180° (half-angle 90°), centred on the observer's zenith
direction. This line represents the horizon boundary between the visible
hemisphere above and the ground below, and SHALL always be rendered regardless
of the Sun's position or elevation.

#### Scenario: Horizon line is always rendered
- **GIVEN** the card is rendered for any date and time
- **WHEN** the visibility display at Earth's position is drawn
- **THEN** a dashed line SHALL be rendered across the full 180° horizon
- **AND** the line SHALL be centred on the computed observer zenith direction

#### Scenario: Horizon line does not change with solar position
- **GIVEN** the card displays a date where the Sun is below the horizon
- **WHEN** the horizon line is rendered
- **THEN** its angular extent SHALL remain 180°
- **AND** it SHALL be rendered as a dashed stroke

### Requirement: Day cone fill
When the Sun is above the observer's horizon (solar elevation ≥ 0°), a filled
cone spanning 180° SHALL be rendered behind the horizon line. The fill SHALL use
a warm, clearly visible colour (e.g. pale yellow) with sufficient opacity to be
perceived against the dark background.

#### Scenario: Cone is rendered during daytime
- **GIVEN** the computed solar elevation is greater than or equal to 0°
- **WHEN** the visibility display is drawn
- **THEN** a filled 180° cone SHALL be present
- **AND** its fill colour SHALL be a warm/yellow tone

#### Scenario: Cone spans exactly the visible hemisphere
- **GIVEN** the Sun is above the horizon
- **WHEN** the cone is rendered
- **THEN** the cone half-angle SHALL be exactly 90°
- **AND** it SHALL be centred on the observer zenith direction

### Requirement: Twilight cone fill
When the Sun is below the observer's horizon but within the twilight zone
(−18° ≤ solar elevation < 0°), a filled cone SHALL be rendered. The cone SHALL
expand beyond the 180° horizon boundary to represent the portion of sky still
lit by the Sun below the horizon. The fill SHALL be darker than the day fill but
SHALL remain perceptibly lighter than the card background.

The cone half-angle during twilight is computed as:

  `halfAngle = 90° − elevationDeg`

Since `elevationDeg` is negative during twilight, this expands the cone beyond
90°. At elevation 0° the half-angle is 90° (flush with the horizon line); at
elevation −18° the half-angle is 108° (36° total extension below the horizon).

#### Scenario: Twilight cone expands beyond the horizon
- **GIVEN** the computed solar elevation is between −18° (inclusive) and 0° (exclusive)
- **WHEN** the visibility display is drawn
- **THEN** a filled cone SHALL be present with half-angle = `90° − elevationDeg`
- **AND** the half-angle SHALL be greater than 90° (cone spans more than 180°)
- **AND** its fill colour SHALL be visibly different from (darker than) the day cone fill
- **AND** the fill SHALL be lighter than the background, not invisible

#### Scenario: Twilight cone at horizon boundary matches day cone width
- **GIVEN** the solar elevation is exactly 0°
- **WHEN** the twilight or day cone is rendered
- **THEN** the cone half-angle SHALL be exactly 90° (no expansion below horizon)

### Requirement: Night — cone absent
When the Sun is below the twilight zone (solar elevation < −18°), the filled
cone SHALL NOT be rendered. Only the 180° dashed horizon line SHALL remain
visible, communicating that no sunlight reaches the observer.

#### Scenario: No cone fill during full night
- **GIVEN** the computed solar elevation is below −18°
- **WHEN** the visibility display is drawn
- **THEN** no filled cone element SHALL be present in the SVG output
- **AND** the dashed horizon line SHALL still be rendered

#### Scenario: Transition from twilight to night removes cone
- **GIVEN** the Sun's elevation crosses −18° downward
- **WHEN** the visibility display is re-rendered
- **THEN** the filled cone SHALL disappear
- **AND** only the dashed horizon line SHALL remain

### Requirement: Solar elevation computed from observer location
The solar elevation angle used for the visibility cone SHALL be computed by the
`computeSolarElevationDeg` function from the `observer-location` capability, using
the observer's real latitude, longitude, and local time in the HA timezone.

The orbital angle SHALL continue to be used solely to determine the orientation
(direction) of the cone and horizon line in the SVG diagram. The orbital angle
SHALL NOT be used as the source of elevation magnitude.

#### Scenario: Correct solar elevation at local noon
- **GIVEN** the observer's latitude and longitude are known
- **AND** the current local time (in the HA timezone) is solar noon at that longitude
- **WHEN** solar elevation is computed
- **THEN** the elevation SHALL be positive and close to `90° − |lat − declination|`

#### Scenario: Correct solar elevation at local midnight
- **GIVEN** the observer's latitude and longitude are known
- **AND** the current local time (in the HA timezone) is local midnight
- **WHEN** solar elevation is computed
- **THEN** the elevation SHALL be negative (Sun below horizon)

#### Scenario: Cone color reflects real sky condition
- **GIVEN** a user in Dallas, TX (lat ≈ 32.8°N, lon ≈ −96.8°W) at 14:00 CST
- **WHEN** the visibility cone is rendered
- **THEN** the cone SHALL use the Day color (elevation > 0°)

#### Scenario: Cone orientation driven by orbital angle independent of elevation
- **GIVEN** any date and observer location
- **WHEN** the visibility cone is rendered
- **THEN** the direction the cone points (observer zenith in the SVG) SHALL be derived
  from the Earth orbital angle and local time angle as before
- **AND** this direction SHALL be independent of the elevation value
