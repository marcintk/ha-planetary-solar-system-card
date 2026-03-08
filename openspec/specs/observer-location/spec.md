## Purpose

Defines how the card obtains the observer's real geographic location from Home Assistant
configuration and uses it to compute accurate solar position data. Replaces the orbital-geometry
approximation and browser geolocation API with synchronous HA config values.

## Requirements

### Requirement: HA config extraction

The card SHALL read `latitude`, `longitude`, `time_zone`, and `location_name` from `hass.config` in
the `set hass(hass)` setter and store them for use in rendering. These values are available
synchronously and require no async calls.

#### Scenario: Location data captured on hass assignment

- **GIVEN** a Home Assistant instance with configured location
- **WHEN** `set hass(hass)` is called
- **THEN** the card SHALL store `hass.config.latitude`, `hass.config.longitude`,
  `hass.config.time_zone`, and `hass.config.location_name` as instance state

#### Scenario: Hemisphere derived from latitude

- **GIVEN** `hass.config.latitude` is available
- **WHEN** the card determines hemisphere for season labels
- **THEN** hemisphere SHALL be `"south"` if latitude < 0, otherwise `"north"`
- **AND** no call to `navigator.geolocation` SHALL be made

### Requirement: Local time extraction in HA timezone

A function `getLocalTimeInZone(date, timezone)` SHALL return the local hours and minutes for the
given `Date` object interpreted in the specified IANA timezone string (e.g. `"America/Chicago"`),
using the `Intl.DateTimeFormat` API.

#### Scenario: Returns correct local time for a given timezone

- **GIVEN** a UTC `Date` and an IANA timezone string
- **WHEN** `getLocalTimeInZone` is called
- **THEN** it SHALL return `{ hours, minutes }` representing local time in that timezone
- **AND** the result SHALL differ from `date.getHours()` when the browser timezone differs from the
  target timezone

#### Scenario: Falls back to UTC on invalid timezone string

- **GIVEN** an invalid or unrecognised IANA timezone string
- **WHEN** `getLocalTimeInZone` is called
- **THEN** it SHALL return `{ hours, minutes }` in UTC without throwing

### Requirement: Solar elevation from spherical geometry

A function `computeSolarElevationDeg(lat, lon, date, timezone)` SHALL compute the Sun's altitude
above the observer's horizon using the standard spherical astronomy formula:

```
δ  = -23.45° × cos( 360/365 × (dayOfYear + 10) )
H  = 15° × (localSolarHour - 12)
sin(alt) = sin(lat)×sin(δ) + cos(lat)×cos(δ)×cos(H)
```

where `localSolarHour` accounts for the observer's longitude offset from the prime meridian. The
function SHALL return elevation in degrees in the range [−90, 90].

#### Scenario: Solar elevation near 90° at local solar noon

- **GIVEN** an observer at a mid-latitude location
- **WHEN** `computeSolarElevationDeg` is called at the approximate local solar noon
- **THEN** the returned elevation SHALL be positive and greater than 60°

#### Scenario: Solar elevation negative at local midnight

- **GIVEN** an observer at any latitude
- **WHEN** `computeSolarElevationDeg` is called at local midnight
- **THEN** the returned elevation SHALL be negative (Sun below horizon)

#### Scenario: Elevation at sunrise/sunset near 0°

- **GIVEN** a date and location where sunrise occurs
- **WHEN** `computeSolarElevationDeg` is called at the expected sunrise time
- **THEN** the returned elevation SHALL be within ±2° of 0°

### Requirement: Next mode transition time

A function `computeNextTransitionTime(lat, lon, date, timezone)` SHALL find the next time — after
`date` — at which the sky mode changes between Day, Civil Twilight, Nautical Twilight, Astronomical
Twilight, and Night. Mode boundaries are at solar elevations 0°, −6°, −12°, and −18°.

The function SHALL use a minute-by-minute forward scan (up to 24 hours) followed by binary-search
refinement within the detected 1-minute bracket, and SHALL return `{ time: Date, toMode: string }`
or `null` if no transition is found.

#### Scenario: Returns next sunrise during night

- **GIVEN** an observer in full night (elevation < −18°)
- **WHEN** `computeNextTransitionTime` is called
- **THEN** it SHALL return a `{ time, toMode }` where `toMode` is `"Astronomical Twilight"`
- **AND** `time` SHALL be a `Date` within the next 24 hours

#### Scenario: Returns null during polar day/night

- **GIVEN** an observer at a latitude experiencing continuous day or night
- **WHEN** `computeNextTransitionTime` is called
- **THEN** it SHALL return `null`

#### Scenario: Returned time is more precise than 1 minute

- **GIVEN** any observer location with a transition in the next 24 hours
- **WHEN** `computeNextTransitionTime` is called
- **THEN** the returned `time` SHALL be refined to within 60 seconds of the true crossing
