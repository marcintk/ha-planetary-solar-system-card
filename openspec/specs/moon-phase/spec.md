### Requirement: Moon phase calculation from date

The system SHALL compute the Moon's synodic phase from any given date. The phase SHALL be a
normalized value between 0 and 1, where 0 represents New Moon and 0.5 represents Full Moon. The
calculation SHALL use the synodic month period (29.53059 days) relative to a known New Moon epoch
(January 6, 2000 00:00 UTC). The function `getMoonPhase(date)` in `src/astronomy/moon-phase.js`
SHALL return an object with `phase` (0–1), `phaseName` (string), and `illumination` (0–1).

#### Scenario: New Moon date returns phase near 0

- **WHEN** `getMoonPhase` is called with a known New Moon date (e.g., 2024-01-11)
- **THEN** the returned `phase` SHALL be within 0.02 of 0 (or 1)
- **THEN** the returned `phaseName` SHALL be "New Moon"
- **THEN** the returned `illumination` SHALL be less than 0.05

#### Scenario: Full Moon date returns phase near 0.5

- **WHEN** `getMoonPhase` is called with a known Full Moon date (e.g., 2024-01-25)
- **THEN** the returned `phase` SHALL be within 0.02 of 0.5
- **THEN** the returned `phaseName` SHALL be "Full Moon"
- **THEN** the returned `illumination` SHALL be greater than 0.95

#### Scenario: First Quarter date returns correct phase

- **WHEN** `getMoonPhase` is called with a known First Quarter date (e.g., 2024-01-18)
- **THEN** the returned `phase` SHALL be within 0.04 of 0.25
- **THEN** the returned `phaseName` SHALL be "First Quarter"

#### Scenario: Phase wraps correctly across months

- **WHEN** `getMoonPhase` is called with two dates exactly 29.53 days apart
- **THEN** both returned `phase` values SHALL be within 0.01 of each other

### Requirement: Eight discrete phase names

The system SHALL map the continuous 0–1 phase value to one of exactly eight named phases. The
mapping SHALL divide the cycle into 8 equal segments centered on each phase's ideal value. The names
SHALL be: "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning
Gibbous", "Third Quarter", "Waning Crescent".

#### Scenario: Phase boundaries are correct

- **WHEN** `getMoonPhase` is called with a date yielding phase 0.10
- **THEN** `phaseName` SHALL be "Waxing Crescent"

#### Scenario: All eight phase names are reachable

- **WHEN** `getMoonPhase` is called with 8 dates evenly spaced across one synodic month
- **THEN** the returned `phaseName` values SHALL include all eight phase names

### Requirement: Illumination fraction calculation

The system SHALL compute the illumination fraction as a value between 0 and 1, derived from the
phase value using the formula `(1 - cos(2 * PI * phase)) / 2`. This produces 0 at New Moon, 0.5 at
quarters, and 1 at Full Moon.

#### Scenario: Illumination at quarter phases

- **WHEN** `getMoonPhase` is called with a First Quarter date
- **THEN** `illumination` SHALL be within 0.05 of 0.5

#### Scenario: Illumination is symmetric

- **WHEN** `getMoonPhase` is called with dates at phases 0.25 and 0.75
- **THEN** both `illumination` values SHALL be within 0.05 of each other

### Requirement: Moon phase SVG indicator rendering

The system SHALL render a moon phase indicator in the SVG via
`renderMoonPhaseIndicator(svg, date, hemisphere)` in `src/renderer/moon-phase.js`. The indicator
SHALL consist of a `<g>` group containing a circular moon disc (radius 10px) showing the illuminated
portion, and a text label with the phase name. The indicator SHALL be appended to the SVG element.

#### Scenario: Indicator creates SVG group with disc and label

- **WHEN** `renderMoonPhaseIndicator` is called with a valid SVG, date, and hemisphere
- **THEN** a `<g>` element SHALL be appended to the SVG
- **THEN** the group SHALL contain at least one `<circle>` element (the moon disc)
- **THEN** the group SHALL contain a `<text>` element with the phase name

#### Scenario: Full Moon renders fully illuminated disc

- **WHEN** `renderMoonPhaseIndicator` is called with a Full Moon date
- **THEN** the illuminated portion SHALL cover the full disc area

#### Scenario: New Moon renders dark disc

- **WHEN** `renderMoonPhaseIndicator` is called with a New Moon date
- **THEN** the disc SHALL appear fully dark (shadow covers entire disc)

### Requirement: Hemisphere-aware illumination direction

The system SHALL render the illuminated side of the Moon on the right for the Northern Hemisphere
(waxing phases) and on the left for the Southern Hemisphere. When `hemisphere` is "south", the
illumination direction SHALL be horizontally mirrored compared to "north".

#### Scenario: Northern hemisphere waxing crescent

- **WHEN** `renderMoonPhaseIndicator` is called with a Waxing Crescent date and hemisphere "north"
- **THEN** the right side of the disc SHALL be illuminated

#### Scenario: Southern hemisphere waxing crescent

- **WHEN** `renderMoonPhaseIndicator` is called with a Waxing Crescent date and hemisphere "south"
- **THEN** the left side of the disc SHALL be illuminated

### Requirement: Integration into renderSolarSystem

The main compositor `renderSolarSystem` in `src/renderer/index.js` SHALL call
`renderMoonPhaseIndicator` to add the moon phase indicator to the SVG output. The indicator SHALL be
rendered after all other elements so it appears on top.

#### Scenario: renderSolarSystem includes moon phase indicator

- **WHEN** `renderSolarSystem` is called with a date and hemisphere
- **THEN** the returned SVG SHALL contain a moon phase indicator group
- **THEN** the indicator SHALL be the last child group appended to the SVG

### Requirement: Indicator updates with date navigation

The moon phase indicator SHALL reflect the currently displayed date. When the user navigates to a
different date using the nav buttons (day-back, day-forward, month-back, month-forward, hour-back,
hour-forward, today), the indicator SHALL update to show the phase for the new date.

#### Scenario: Navigating forward one month changes phase

- **WHEN** the user clicks "month-forward"
- **THEN** the re-rendered SVG SHALL show the moon phase for the new date
- **THEN** the phase name SHALL differ from the previous date's phase (for most months)
