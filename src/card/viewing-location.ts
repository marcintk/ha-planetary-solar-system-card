import { getMoonSkyAngles } from "../astronomy/parallactic.js";
import { computeSolarElevationDeg, getSkyMode } from "../astronomy/solar-position.js";
import type { HASSConfig, Hemisphere, LocationData } from "../types.js";

// The sky tile's backdrop, by getSkyMode()'s own band names. Solid colors, not the visibility
// cone's translucent tints (CONE_DAY etc., see renderer/observer.ts) — the cone is designed to
// sit as a faint wash over the SVG view, but a tile-sized backdrop needs to read as "day" or
// "night" at a glance rather than disappear against the card background. Day and night are the
// two ends of the range (light vs. black); the three twilight steps carry the same warm-cool-
// violet hue progression as the cone's own bands, just fully opaque instead of near-invisible.
const MOON_SKY_BACKGROUND: Record<string, string> = {
  Day: "#d0d0d0",
  "Civil Twilight": "#8a6142",
  "Nautical Twilight": "#3a4a6b",
  "Astronomical Twilight": "#2a1f42",
  Night: "#000000",
};

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
    if (!location) return { rotation: 0, belowHorizon: false, background: "#000" };

    const { parallacticDeg, altitudeDeg } = getMoonSkyAngles(now, location.lat, location.lon);
    const sunElevDeg = computeSolarElevationDeg(location.lat, location.lon, now);
    return {
      rotation: parallacticDeg,
      belowHorizon: altitudeDeg <= 0,
      background: MOON_SKY_BACKGROUND[getSkyMode(sunElevDeg)],
    };
  }
}
