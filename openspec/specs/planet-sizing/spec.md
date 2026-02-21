### Requirement: Planet visual size range
All planets SHALL have a visual radius (SVG circle `r` attribute) between 8px and 14px inclusive.

#### Scenario: Smallest planet meets minimum size
- **WHEN** Mercury is rendered on the solar system visualization
- **THEN** its circle radius SHALL be 8px

#### Scenario: Largest planet meets maximum size
- **WHEN** Earth is rendered on the solar system visualization
- **THEN** its circle radius SHALL be 14px

### Requirement: Planet size hierarchy
Planets SHALL maintain the following size hierarchy: Earth > Jupiter > Saturn body > Venus = Mars = Uranus = Neptune > Mercury. Saturn's rendered body radius SHALL be smaller than Jupiter to accommodate top-down ring rendering within the same total visual footprint.

#### Scenario: Earth is the largest planet
- **WHEN** all planets are rendered
- **THEN** Earth's size (14px) SHALL be strictly greater than all other planets

#### Scenario: Jupiter is larger than Saturn body
- **WHEN** Jupiter and Saturn are rendered
- **THEN** Jupiter's body size (12px) SHALL be greater than Saturn's rendered body size, because Saturn's body is reduced to make room for rings

#### Scenario: Saturn body reduced for ring accommodation
- **WHEN** Saturn is rendered
- **THEN** Saturn's body circle radius SHALL be approximately half of its data size value, so that the body plus ring fits within the original body-only diameter

#### Scenario: Rocky planets share equal size
- **WHEN** Venus, Mars, Uranus, and Neptune are rendered
- **THEN** they SHALL all have the same size of 10px

### Requirement: Saturn top-down ring rendering
Saturn SHALL be rendered with a circular ring (viewed from above) instead of an angled ellipse. The ring SHALL be a circle centered on Saturn with a stroke, and the total visual footprint (body + ring) SHALL NOT exceed Saturn's original body-only diameter.

#### Scenario: Saturn ring is a circle
- **WHEN** Saturn's rings are rendered
- **THEN** the ring SHALL be an SVG circle element (equal rx and ry, or a `<circle>`) centered at Saturn's position, NOT an ellipse with different rx/ry

#### Scenario: Ring stroke styling
- **WHEN** Saturn's ring circle is rendered
- **THEN** the ring SHALL have a stroke derived from Saturn's body color with reduced opacity, a stroke-width of approximately 4px, and no fill

#### Scenario: Total footprint within budget
- **WHEN** Saturn's body and ring are rendered together
- **THEN** the outermost edge of the ring (ring radius + half stroke-width) SHALL NOT exceed the original Saturn body radius from planet data

#### Scenario: Ring color matches Saturn
- **WHEN** Saturn's ring is rendered
- **THEN** the ring stroke color SHALL be derived from Saturn's hex color with approximately 0.6 opacity

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
