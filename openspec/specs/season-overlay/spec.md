### Requirement: Season quadrant dividing lines
The renderer SHALL draw two dotted lines through the Sun (center of the SVG), one horizontal and one vertical, spanning the full viewBox extent. These lines divide the solar system into four season quadrants.

#### Scenario: Horizontal dividing line
- **WHEN** the solar system is rendered
- **THEN** a horizontal dotted line SHALL be drawn from x=0 to x=VIEW_SIZE at y=CENTER, passing through the Sun

#### Scenario: Vertical dividing line
- **WHEN** the solar system is rendered
- **THEN** a vertical dotted line SHALL be drawn from y=0 to y=VIEW_SIZE at x=CENTER, passing through the Sun

#### Scenario: Line styling is subtle
- **WHEN** the dividing lines are rendered
- **THEN** the lines SHALL use a dashed/dotted stroke with opacity between 0.2 and 0.3 so they recede behind planets and orbits

#### Scenario: Lines render behind orbits
- **WHEN** the SVG is composed
- **THEN** the season dividing lines SHALL be rendered after the day/night background but before orbit circles, so orbits and planets appear on top

### Requirement: Season name labels curved along Neptune orbit
The renderer SHALL display four season name labels (Spring, Summer, Autumn, Winter), each positioned as curved text following an arc segment of Neptune's orbit within its respective quadrant.

#### Scenario: Four season labels displayed
- **WHEN** the solar system is rendered
- **THEN** exactly four season labels SHALL appear: "Spring", "Summer", "Autumn", "Winter", one in each quadrant

#### Scenario: Labels follow Neptune orbit curvature
- **WHEN** a season label is rendered
- **THEN** the label text SHALL follow a curved path along Neptune's orbit (MAX_RADIUS from center) using SVG textPath elements

#### Scenario: Labels are readable
- **WHEN** season labels are rendered
- **THEN** each label SHALL use a font-size between 18 and 22 pixels and be centered within its quadrant arc

#### Scenario: Northern Hemisphere season positions
- **WHEN** the hemisphere is "north"
- **THEN** the seasons SHALL be positioned as: Spring in bottom-left quadrant, Summer in bottom-right, Autumn in top-right, Winter in top-left

### Requirement: Hemisphere detection via browser geolocation
The card SHALL attempt to detect the user's hemisphere using the browser Geolocation API and adjust season label positions accordingly.

#### Scenario: Northern Hemisphere detected
- **WHEN** the browser geolocation returns a latitude >= 0
- **THEN** the card SHALL use Northern Hemisphere season mapping

#### Scenario: Southern Hemisphere detected
- **WHEN** the browser geolocation returns a latitude < 0
- **THEN** the card SHALL swap season labels: Spring↔Autumn and Summer↔Winter compared to Northern Hemisphere positions

#### Scenario: Geolocation unavailable
- **WHEN** the browser geolocation is unavailable or the user denies permission
- **THEN** the card SHALL default to Northern Hemisphere season mapping

#### Scenario: Late geolocation response
- **WHEN** the geolocation response arrives after the initial render
- **THEN** the card SHALL re-render with the correct hemisphere season mapping

### Requirement: AU distance labels on diagonal
The orbit AU distance labels SHALL be positioned along the top-right diagonal (approximately 315 degrees from center) instead of at the top of each orbit.

#### Scenario: AU label position
- **WHEN** an orbit is rendered with its AU distance label
- **THEN** the label SHALL be positioned at approximately 315 degrees (top-right diagonal) from the orbit center, offset slightly outward from the orbit circle

#### Scenario: AU labels do not collide with season lines
- **WHEN** AU labels and season dividing lines are both rendered
- **THEN** AU labels SHALL NOT overlap with the horizontal or vertical season dividing lines
