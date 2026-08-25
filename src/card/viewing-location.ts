import { getMoonSkyAngles } from "../astronomy/parallactic.js";
import { computeSolarElevationDeg, SUNSET_ELEVATION_DEG } from "../astronomy/solar-position.js";
import type { HASSConfig, Hemisphere, LocationData } from "../types.js";

// The sky tile's backdrop, anchored at the same elevation boundaries as getSkyMode()'s bands.
// Solid colors, not the visibility cone's translucent tints (CONE_DAY etc., see
// renderer/observer.ts) — the cone is designed to sit as a faint wash over the SVG view, but a
// tile-sized backdrop needs to read as "day" or "night" at a glance rather than disappear
// against the card background. Interpolated linearly between neighbors (skyBackgroundForElevation)
// rather than snapped by band name — a real sky doesn't jump hue the instant the Sun crosses
// -6 deg, so a hard lookup read as a visible seam at each boundary.
const SKY_ANCHORS: { elevDeg: number; rgb: readonly [number, number, number] }[] = [
  { elevDeg: SUNSET_ELEVATION_DEG, rgb: [0xd0, 0xd0, 0xd0] }, // Day
  { elevDeg: -6, rgb: [0x8a, 0x61, 0x42] }, // Civil Twilight
  { elevDeg: -12, rgb: [0x3a, 0x4a, 0x6b] }, // Nautical Twilight
  { elevDeg: -18, rgb: [0x2a, 0x1f, 0x42] }, // Astronomical Twilight
];

// #177: mix-blend-mode: color (.gallery-thumb-tint) takes hue/saturation from this backdrop and
// luminosity from the photo underneath — an achromatic (R===G===B) backdrop has no hue/saturation
// to give, so it silently no-ops instead of darkening. Astronomical Twilight's own hue, scaled
// near-black, keeps the plateau reading as "night" while staying chromatic enough to blend.
const NIGHT_RGB: readonly [number, number, number] = [0x06, 0x05, 0x0a];

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, "0");
}

// Below -18 deg the Sun is far enough down that astronomical twilight has already given way to
// true night — a real, physically-defined boundary (unlike the twilight steps above it), so it
// stays a flat plateau rather than another interpolation zone.
export function skyBackgroundForElevation(elevDeg: number): string {
  const first = SKY_ANCHORS[0];
  const last = SKY_ANCHORS[SKY_ANCHORS.length - 1];
  if (elevDeg >= first.elevDeg) return rgbToHex(first.rgb);
  if (elevDeg < last.elevDeg) return rgbToHex(NIGHT_RGB);

  for (let i = 0; i < SKY_ANCHORS.length - 1; i++) {
    const hi = SKY_ANCHORS[i];
    const lo = SKY_ANCHORS[i + 1];
    if (elevDeg <= hi.elevDeg && elevDeg >= lo.elevDeg) {
      const t = (hi.elevDeg - elevDeg) / (hi.elevDeg - lo.elevDeg);
      const rgb: [number, number, number] = [0, 1, 2].map(
        (c) => hi.rgb[c] + t * (lo.rgb[c] - hi.rgb[c])
      ) as [number, number, number];
      return rgbToHex(rgb);
    }
  }
  /* v8 ignore next */
  return rgbToHex(NIGHT_RGB);
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

// #178: a rising/setting Moon looks orange/red from crossing more atmosphere near the horizon
// (extinction) — a different phenomenon from twilight color: the tint itself is driven by the
// Moon's own altitude, not the Sun's, and composes with skyBackgroundForElevation as a second
// overlay rather than replacing it. Its visible *strength* isn't fully independent of the Sun
// though — see the contrast-fade comment below moonExtinctionTint's ramp coefficient.
const MOON_EXTINCTION_RGB: readonly [number, number, number] = [0xff, 0x66, 0x1a];

// A first version of this used `(1 - sin(altitude))^1.5`, calibrated only by eye against two
// sample altitudes — it gave a real, well-up Moon at 22deg an alpha of 0.49, roughly half
// strength, when a Moon that high actually reads as close to white. Replaced with a curve
// grounded in the real physics of why a low Moon reddens at all.
//
// airmass(): Kasten & Young 1989 — how many atmospheres-worth of air a sightline crosses,
// stated to stay accurate all the way to the horizon (unlike the naive secant `1/sin(altitude)`,
// which diverges to infinity there instead of the true, refraction-limited ~38).
function airmass(altitudeDeg: number): number {
  const altDeg = Math.max(altitudeDeg, 0);
  const altRad = (altDeg * Math.PI) / 180;
  return 1 / (Math.sin(altRad) + 0.50572 * (altDeg + 6.07995) ** -1.6364);
}

// A second version used `1 - exp(-k * (airmass - 1))` directly, k picked from a real published
// differential-extinction coefficient (~0.15 mag/airmass) — physically grounded, but it still
// overstated things: a Moon at 22deg (airmass 2.6) came out at 0.22 strength, a visible cast on
// a Moon real observers report as reading white. The gap is that "magnitudes of physical
// extinction" and "how much a UI overlay should visibly recolor a photo" aren't the same scale
// — human color perception needs the airmass excess to build up well past the zenith baseline
// before it reads as anything at all, then catches up fast right near the horizon. Squaring the
// excess before the exponential is what buys that: it pushes the early/moderate range down much
// harder than the plain linear version while keeping the same near-total saturation at the
// horizon. The exponent is a perceptual calibration knob, not a cited constant the way the
// airmass formula above is.
const EXTINCTION_RAMP_COEFFICIENT = 0.004;

// The extinction color above is the Moon's true tint — unaffected by the Sun's position, since
// the reddening happens along the sightline to the Moon, not to the Sun. But how strongly that
// true tint actually *reads* to an observer does depend on the Sun: a bright sky floods the same
// sightline with scattered light (veiling luminance) and simultaneous-contrast perception further
// desaturates a tinted object seen against a bright field — the same reason a red filter looks
// vivid on a dark background and washed-out on a white one. Both effects fade the *visible*
// strength of the true tint toward the sky's own brightness, they don't change the tint itself —
// which is why this multiplies the strength computed above rather than feeding into it.
//
// Reuses the same day/night luma extremes as the sky wash rather than a second calibrated curve:
// the two washes already agree on what "day" and "night" brightness mean, so the fade should too.
const DAY_LUMA = luma(SKY_ANCHORS[0].rgb);
const NIGHT_LUMA = luma(NIGHT_RGB);

function luma(rgb: readonly [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

// 0 at night (no veiling, full contrast against a dark sky) to 1 in full daylight (sky luminance
// swamps the Moon's own tint). Linear in luma rather than sun elevation directly, so it tracks
// the same brightness the sky wash itself already renders instead of re-deriving twilight bands.
function skyBrightnessFraction(sunElevDeg: number): number {
  const currentLuma = luma(hexToRgb(skyBackgroundForElevation(sunElevDeg)));
  return Math.max(0, Math.min(1, (currentLuma - NIGHT_LUMA) / (DAY_LUMA - NIGHT_LUMA)));
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * How strongly the Moon's own altitude should redden/dim it right now, as an rgba() string
 * whose alpha carries the strength — mix-blend-mode: color reads alpha as how much of the
 * backdrop's own hue survives, so a fading alpha is a fading tint rather than a second color
 * to mix by hand.
 *
 * `sunElevDeg` fades that strength toward zero as the sky brightens — see the contrast-fade
 * comment above. It does not gate the tint on its own: even a bright sky still shows *some*
 * extinction on a Moon right at the horizon, it just reads weaker than the same Moon would
 * against a dark one.
 */
export function moonExtinctionTint(altitudeDeg: number, sunElevDeg: number): string {
  const airmassExcess = airmass(altitudeDeg) - 1;
  const rawStrength = Math.max(
    0,
    Math.min(1, 1 - Math.exp(-EXTINCTION_RAMP_COEFFICIENT * airmassExcess ** 2))
  );
  const strength = rawStrength * (1 - skyBrightnessFraction(sunElevDeg));
  const [r, g, b] = MOON_EXTINCTION_RGB;
  return `rgba(${r}, ${g}, ${b}, ${strength.toFixed(2)})`;
}

// HASS and config.location update independently (hass setter vs. setConfig), so each source
// is kept as one grouped field rather than losing either one to an eager merge — `data` and
// `name` below resolve them on read, override winning per-field.
interface HassLocation {
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  name: string | null;
}

interface LocationOverride {
  lat: number;
  lon: number;
  timezone: string;
}

/** How the Moon hangs in the observer's sky at one instant. */
export interface SkyFrame {
  /** Parallactic angle — how far to turn the geocentric render into this observer's view. */
  rotation: number;
  /** True when the Earth is in the way from here, so there is no Moon to show. */
  belowHorizon: boolean;
  /** What the sky itself looks like right now, whether or not the Moon is up. */
  background: string;
  /** How much the Moon's own altitude should redden/dim it right now — see moonExtinctionTint(). */
  extinction: string;
}

/**
 * Where the user is watching from, and what their sky looks like.
 *
 * Merges HA's own location with a `config.location` override, and answers the three questions
 * the card asks about the observer: where they are (`data`/`name`), which way their seasons run
 * (`hemisphere`), and how the Moon sits in their sky right now (`skyFrame`). Previously these
 * lived as six fields and two methods on the card element, which meant the merge rules and the
 * sky astronomy could only be exercised by mounting a custom element in jsdom.
 *
 * Named for the observer's position rather than "Observer", which renderer/observer.ts already
 * owns for the needle and the visibility cone drawn on the solar view.
 */
export class ViewingLocation {
  private _hass: HassLocation;
  private _override: LocationOverride | null;
  private _nameOverride: string | null;

  constructor() {
    this._hass = { lat: null, lon: null, timezone: null, name: null };
    this._override = null;
    this._nameOverride = null;
  }

  /**
   * Takes HA's own location. Returns whether anything actually moved, so the caller re-renders
   * on a real change rather than on every hass assignment — HA reassigns that property on every
   * state update in the whole system, which is far more often than the card's location changes.
   */
  update(hass: HASSConfig): boolean {
    const next: HassLocation = {
      lat: hass.config?.latitude ?? null,
      lon: hass.config?.longitude ?? null,
      timezone: hass.config?.time_zone || null,
      name: hass.config?.location_name || null,
    };
    const prev = this._hass;
    if (
      next.lat === prev.lat &&
      next.lon === prev.lon &&
      next.timezone === prev.timezone &&
      next.name === prev.name
    ) {
      return false;
    }
    this._hass = next;
    return true;
  }

  /** Applies `config.location` — already validated and zone-resolved by parseCardConfig. */
  configure(override: LocationOverride | null, nameOverride: string | null): void {
    this._override = override;
    this._nameOverride = nameOverride;
  }

  get data(): LocationData | null {
    const override = this._override;
    const lat = override?.lat ?? this._hass.lat;
    const lon = override?.lon ?? this._hass.lon;
    return lat != null && lon != null
      ? {
          lat,
          lon,
          timezone: override?.timezone ?? this._hass.timezone ?? "UTC",
          zoneOverride: override != null,
        }
      : null;
  }

  get name(): string | null {
    return this._nameOverride ?? this._hass.name;
  }

  // Derived rather than remembered: with no location known there is no hemisphere to report,
  // and north is the same default the card starts at. (The card used to cache the last
  // hemisphere it saw, so losing the location mid-session kept the old seasons on screen.)
  get hemisphere(): Hemisphere {
    const lat = this.data?.lat;
    return lat != null && lat < 0 ? "south" : "north";
  }

  /**
   * How the Moon hangs in this observer's sky at `now`.
   *
   * Returns null-safe defaults when no location is known yet: an unrotated frame on the
   * default black backdrop is the geocentric one, which is the honest thing to show when
   * there is no observer to rotate or light for.
   *
   * "Below horizon" isn't a failure — it means the Earth is in the way from here, which is
   * true on roughly half of any given hour's worth of nights, at every latitude, because the
   * Moon keeps its own hours rather than the Sun's — but it does mean there's nothing to show:
   * the caller leaves the image out rather than rendering a Moon that isn't in the sky. The
   * backdrop answers a separate question, what the sky itself looks like right now, so it's
   * still lit correctly either way.
   *
   * `now` is passed in rather than read here, so one render paints the tile, its tint and the
   * full-screen panel from a single instant instead of three slightly different ones.
   */
  skyFrame(now: Date): SkyFrame {
    const location = this.data;
    if (!location) {
      return {
        rotation: 0,
        belowHorizon: false,
        background: "#000",
        extinction: "rgba(0, 0, 0, 0)",
      };
    }

    const { parallacticDeg, altitudeDeg } = getMoonSkyAngles(now, location.lat, location.lon);
    const sunElevDeg = computeSolarElevationDeg(location.lat, location.lon, now);
    return {
      rotation: parallacticDeg,
      belowHorizon: altitudeDeg <= 0,
      background: skyBackgroundForElevation(sunElevDeg),
      extinction: moonExtinctionTint(altitudeDeg, sunElevDeg),
    };
  }
}
