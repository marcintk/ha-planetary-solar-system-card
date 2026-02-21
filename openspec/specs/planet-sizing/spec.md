### Requirement: Planet visual size range
All planets SHALL have a visual radius (SVG circle `r` attribute) between 8px and 14px inclusive.

#### Scenario: Smallest planet meets minimum size
- **WHEN** Mercury is rendered on the solar system visualization
- **THEN** its circle radius SHALL be 8px

#### Scenario: Largest planet meets maximum size
- **WHEN** Earth is rendered on the solar system visualization
- **THEN** its circle radius SHALL be 14px

### Requirement: Planet size hierarchy
Planets SHALL maintain the following size hierarchy: Earth > Jupiter = Saturn > Venus = Mars = Uranus = Neptune > Mercury.

#### Scenario: Earth is the largest planet
- **WHEN** all planets are rendered
- **THEN** Earth's size (14px) SHALL be strictly greater than all other planets

#### Scenario: Gas giants are larger than rocky planets
- **WHEN** Jupiter and Saturn are rendered
- **THEN** their size (12px each) SHALL be greater than Venus, Mars, Uranus, and Neptune (10px each)

#### Scenario: Rocky planets share equal size
- **WHEN** Venus, Mars, Uranus, and Neptune are rendered
- **THEN** they SHALL all have the same size of 10px

### Requirement: Moon visual size
The Moon SHALL have a visual radius of 8px, equal to Mercury as the smallest rendered bodies.

#### Scenario: Moon size matches Mercury
- **WHEN** the Moon is rendered
- **THEN** its circle radius SHALL be 8px

### Requirement: Sun size unchanged
The Sun SHALL remain at its current visual radius of 12px.

#### Scenario: Sun retains original size
- **WHEN** the Sun is rendered at center
- **THEN** its circle radius SHALL be 12px

### Requirement: Moon offset from Earth
The Moon SHALL orbit at a pixel offset of 22px from Earth's center to prevent visual overlap with the enlarged Earth.

#### Scenario: Moon does not overlap Earth
- **WHEN** Earth (14px radius) and Moon (8px radius) are rendered
- **THEN** the Moon's center SHALL be 22px from Earth's center, ensuring no overlap

### Requirement: Label offset from body
Planet and Moon labels SHALL be positioned at `body.size + 6` pixels above the body center to maintain readable spacing with enlarged sizes.

#### Scenario: Label spacing adjusts to planet size
- **WHEN** a planet with size 14px is rendered with a label
- **THEN** the label y-coordinate SHALL be `body_center_y - 14 - 6` (20px above center)

#### Scenario: Label spacing for small body
- **WHEN** Mercury (8px) is rendered with a label
- **THEN** the label y-coordinate SHALL be `body_center_y - 8 - 6` (14px above center)

### Requirement: Day/night split boundary passes through Earth
The day/night overlay boundary line SHALL pass through Earth's orbital position, perpendicular to the Sun-Earth axis. The night overlay SHALL cover the half-plane on Earth's far side (away from the Sun).

#### Scenario: Split line intersects Earth's orbit
- **WHEN** the day/night split is rendered for any date
- **THEN** the boundary line SHALL pass through the point where Earth is located on its orbit, not through the Sun center

#### Scenario: Night overlay covers Earth's far side
- **WHEN** the day/night split is rendered
- **THEN** the semi-transparent night overlay SHALL cover the half of the view on Earth's side away from the Sun, starting from the boundary line at Earth's position

#### Scenario: Inner planets on day side
- **WHEN** the day/night split is rendered
- **THEN** Mercury and Venus (orbits inside Earth's) SHALL always be fully on the day side (between the Sun and the split boundary)
