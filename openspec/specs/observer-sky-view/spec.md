### Requirement: Time-based visible sky overlay
The system SHALL render a half-plane overlay indicating the visible sky hemisphere based on the observer's local time and Earth's orbital position. The overlay MUST rotate continuously through 360° over 24 hours as Earth rotates. At local midnight (00:00), the visible hemisphere SHALL face directly away from the Sun. At local noon (12:00), the visible hemisphere SHALL face toward the Sun.

The observer angle SHALL be computed as:
```
observerAngle = earthOrbitalAngle + (localHours + localMinutes/60) / 24 * 2PI
```

Where `earthOrbitalAngle` is Earth's current orbital position around the Sun, and `localHours`/`localMinutes` are derived from the browser's local timezone via `Date.getHours()` and `Date.getMinutes()`. The previous formula included an extra `+ PI` term that inverted the direction; this has been removed.

#### Scenario: Midnight sky view
- **WHEN** the date is set to any date at local time 00:00
- **THEN** the visible sky overlay covers the hemisphere directly opposite the Sun from Earth's position (observer faces away from the Sun), and the observer angle SHALL equal `earthOrbitalAngle`

#### Scenario: Noon sky view
- **WHEN** the date is set to any date at local time 12:00
- **THEN** the visible sky overlay covers the hemisphere on the Sun's side from Earth's position (observer faces toward the Sun), and the observer angle SHALL equal `earthOrbitalAngle + PI`

#### Scenario: 6AM sky view rotation
- **WHEN** the date is set to any date at local time 06:00
- **THEN** the visible sky overlay is rotated 90° clockwise from the midnight position (one quarter of a full rotation)

#### Scenario: Overlay uses existing visual style
- **WHEN** the visible sky overlay is rendered
- **THEN** the overlay SHALL use the same `rgba(255, 255, 255, 0.04)` fill and clip-path technique as the current day/night split

### Requirement: Observer needle indicator
The system SHALL render a needle indicator on the Earth dot showing the observer's zenith direction — pointing toward the visible sky hemisphere. The needle SHALL extend from Earth's center to Earth's surface (Earth's body radius in pixels), with the tip at the surface. This represents the direction the observer is looking: away from the Sun at night, toward the Sun during the day.

#### Scenario: Needle rendered at Earth's position
- **WHEN** the solar system is rendered
- **THEN** a needle line SHALL extend from the Earth dot's center to Earth's surface, with a length equal to Earth's body radius (size property from planet data), and the tip SHALL be positioned at the edge of Earth's circle

#### Scenario: Needle visual style
- **WHEN** the needle is rendered
- **THEN** it SHALL be a white line with approximately 0.7 opacity, terminating with a small dot (radius 2px) at the surface for directionality

#### Scenario: Needle rotates with time
- **WHEN** the local time changes (e.g., navigating to today at a different time)
- **THEN** the needle direction SHALL update to reflect the new observer angle, rotating consistently with the overlay

#### Scenario: Needle points away from Sun at midnight
- **WHEN** the date is set to any date at local time 00:00
- **THEN** the needle SHALL point away from the Sun from Earth's position (toward the visible night sky, since at midnight the observer faces away from the Sun)

#### Scenario: Needle points toward Sun at noon
- **WHEN** the date is set to any date at local time 12:00
- **THEN** the needle SHALL point toward the Sun from Earth's position (toward the visible day sky, since at noon the observer faces toward the Sun)

#### Scenario: Needle points away from Sun at 9pm
- **WHEN** the date is set to any date at local time 21:00
- **THEN** the needle SHALL point mostly away from the Sun (rotated 315° from noon, or equivalently 135° past midnight), reflecting that the observer is looking at the night sky

### Requirement: Visibility cone originates from Earth's surface
The day/night overlay boundary SHALL be anchored at Earth's surface (offset from Earth's orbital center by Earth's body radius along the observer direction), not at Earth's orbital center. This simulates the visible sky as seen by an observer standing on Earth's surface.

#### Scenario: Cone boundary starts at Earth's surface
- **WHEN** the day/night split overlay is rendered
- **THEN** the half-plane boundary SHALL pass through a point offset from Earth's orbital position by Earth's body radius in the observer's zenith direction

#### Scenario: Cone anchor accounts for Earth's body size
- **WHEN** the day/night split anchor point is computed
- **THEN** the anchor SHALL be at `(earthOrbitalX + earthSize * cos(observerAngle), earthOrbitalY - earthSize * sin(observerAngle))` where earthSize is Earth's body radius from planet data

#### Scenario: Inner planets remain on day side
- **WHEN** the day/night split is rendered
- **THEN** Mercury and Venus (orbits inside Earth's) SHALL always be fully on the day side, as the boundary offset to Earth's surface does not change the half-plane orientation

### Requirement: Browser timezone usage
The system SHALL derive the observer's local time from the browser's timezone using standard `Date` local time methods (`getHours()`, `getMinutes()`). No additional timezone configuration SHALL be required.

#### Scenario: Automatic timezone detection
- **WHEN** the card is rendered
- **THEN** the local time used for the sky view SHALL match the browser's local timezone without any user configuration

#### Scenario: Date navigation preserves time
- **WHEN** the user navigates forward or backward by days or months
- **THEN** the time component of the date SHALL be preserved, and the visible sky overlay SHALL reflect that preserved time

#### Scenario: Today button uses current time
- **WHEN** the user clicks the "Today" button
- **THEN** the date SHALL be set to the current date AND current local time, and the visible sky overlay SHALL reflect the current moment

### Requirement: Time display in navigation bar
The system SHALL display the current time in `HH:MM` format alongside the date in the navigation bar. The time SHALL be derived from the same `_currentDate` used for rendering, ensuring the displayed time matches the observer needle and overlay position.

#### Scenario: Time shown with date
- **WHEN** the card is rendered
- **THEN** the navigation bar SHALL display the date and time in the format `YYYY-MM-DD HH:MM` (e.g., `2026-02-15 21:00`)

#### Scenario: Time updates on navigation
- **WHEN** the user navigates forward or backward by days or months
- **THEN** the displayed time SHALL reflect the time component of the current date

#### Scenario: Today button shows current time
- **WHEN** the user clicks the "Today" button
- **THEN** the displayed time SHALL show the current local time (hours and minutes)
