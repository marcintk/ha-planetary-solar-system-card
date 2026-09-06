/**
 * The one location × date matrix every observer/rendering suite shares.
 *
 * Before this module each of the eight suites invented its own sites and dates, so a gap at
 * (say) Kraków sunset in one file was invisible to the others. Now they all iterate `MATRIX`
 * (6 sites × 5 dates) and read their ground truth from the tables below, keyed the same way.
 *
 * ─── Regenerating the ground-truth tables ────────────────────────────────────────────────────
 *
 * USNO_RISESET   rise/set, whole UTC minutes:
 *   https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0
 *   `tz=0`, so a "set" of 00:39 is 00:39 UTC that morning (the previous evening local).
 *
 * USNO_ALTITUDES geocentric computed altitude (centre of body, no refraction / semidiameter /
 *   topocentric parallax — exactly what the functions under test return):
 *   https://aa.usno.navy.mil/api/celnav?date=<YYYY-MM-DD>&time=<hh:mm:ss>&coords=<lat>,<lon>
 *   read `almanac_data.hc`.
 *
 * MOON_EQUATORIAL J2000-referred RA/Dec:
 *   https://svs.gsfc.nasa.gov/api/dialamoon/<YYYY-MM-DDThh:mm>
 *   this project's `getMoonEquatorial` returns coordinates *of date*, ~0.4° of RA precession
 *   away from J2000 by 2026 — that offset is the tolerance in the consuming test, not error.
 *
 * MOON_PASS      one full Moon pass per site (rise → transit → set) with the parallactic angle
 *   q and altitude at each; regenerate from any ephemeris that reports topocentric q.
 *
 * Every table below is fully populated with real data. If a future extension adds a row whose
 * value isn't fetched yet, set it to `PLACEHOLDER` (NaN): the consuming suites turn that into a
 * loud, explicit failure naming the URL above rather than letting it silently pass.
 */

import type { LocationData } from "../../src/types.js";

/** Sentinel for a ground-truth cell that still needs fetching. Any assertion against it fails. */
export const PLACEHOLDER = Number.NaN;
export const isPlaceholder = (v: number): boolean => Number.isNaN(v);

export type SiteKey = "Quito" | "Denton" | "Montevideo" | "Kraków" | "Trondheim" | "Ushuaia";
export type DateKey =
  | "equinox"
  | "juneSolstice"
  | "decSolstice"
  | "ordinaryWinter"
  | "ordinaryLate";

/**
 * Six observers, equator → sub-arctic, both hemispheres — the superset of every site the suites
 * used to test individually. Each moves a piece of geometry a single mid-north latitude leaves
 * pinned: Quito the near-vertical equatorial horizon crossing, Montevideo the inverted seasons
 * and ~180°-away parallactic angle, Kraków an 8 h↔16 h day-length swing, Trondheim/Ushuaia the
 * grazing high-latitude crossings on either side of the equator.
 */
export const SITES: Record<SiteKey, LocationData> = {
  Quito: { lat: -0.1807, lon: -78.4678, timezone: "America/Guayaquil", zoneOverride: false },
  Denton: { lat: 33.2148, lon: -97.1331, timezone: "America/Chicago", zoneOverride: false },
  Montevideo: { lat: -34.9011, lon: -56.1645, timezone: "America/Montevideo", zoneOverride: false },
  Kraków: { lat: 50.0647, lon: 19.945, timezone: "Europe/Warsaw", zoneOverride: false },
  Trondheim: { lat: 63.4305, lon: 10.3951, timezone: "Europe/Oslo", zoneOverride: false },
  Ushuaia: {
    lat: -54.8019,
    lon: -68.303,
    timezone: "America/Argentina/Ushuaia",
    zoneOverride: false,
  },
};

/** Five UTC days in 2026: both solstices, an equinox, and two ordinary dates. */
export const DATES: Record<DateKey, string> = {
  equinox: "2026-03-20",
  juneSolstice: "2026-06-21",
  decSolstice: "2026-12-21",
  ordinaryWinter: "2026-01-15",
  ordinaryLate: "2026-08-22",
};

export const SITE_KEYS = Object.keys(SITES) as SiteKey[];
export const DATE_KEYS = Object.keys(DATES) as DateKey[];

/** Every (site, date) pair — the argument to `it.each` in the matrix-driven suites. */
export const MATRIX: ReadonlyArray<{ site: SiteKey; date: DateKey }> = SITE_KEYS.flatMap((site) =>
  DATE_KEYS.map((date) => ({ site, date }))
);

/**
 * Apparent altitude a body must reach to count as risen. The almanac lifts the Sun by
 * refraction (34') plus a half-disc (16') and nets the Moon near the geometric horizon
 * (16' semidiameter ≈ cancelled by 57' parallax).
 */
export const RISE_ALTITUDE = { sun: -0.8333, moon: 0.125 } as const;

/** Twilight boundary elevations, brightest to darkest. */
export const TWILIGHT_THRESHOLDS = [0, -6, -12, -18] as const;

// ─── USNO rise/set ──────────────────────────────────────────────────────────────────────────

export type RiseSet = {
  sunRise: string;
  sunSet: string;
  moonRise: string;
  moonSet: string;
  /**
   * Trondheim only: on 2026-01-15 and 2026-08-22 the Moon's ~50 min/day drift skips a
   * calendar-day crossing entirely ("continuously below the Horizon"), so the nearest day with
   * a real moonrise *and* moonset is used for the whole row. Not a model gap — this site's own
   * geometry that day.
   */
  dayOverride?: string;
};

/**
 * All 30 rows real, from the USNO rstt endpoint (`tz=0`). 25 carried over verbatim from the
 * old `accuracy-horizon.test.ts` array (Denton, Montevideo, Kraków, Trondheim, Ushuaia);
 * Quito's 5 fetched for coords `-0.1807,-78.4678`.
 */
export const USNO_RISESET: Record<SiteKey, Record<DateKey, RiseSet>> = {
  Quito: {
    ordinaryWinter: { sunRise: "11:19", sunSet: "23:27", moonRise: "08:33", moonSet: "20:59" },
    equinox: { sunRise: "11:18", sunSet: "23:24", moonRise: "12:28", moonSet: "00:02" },
    juneSolstice: { sunRise: "11:12", sunSet: "23:19", moonRise: "17:04", moonSet: "04:41" },
    ordinaryLate: { sunRise: "11:14", sunSet: "23:20", moonRise: "19:05", moonSet: "06:39" },
    decSolstice: { sunRise: "11:08", sunSet: "23:16", moonRise: "20:56", moonSet: "08:23" },
  },
  Denton: {
    ordinaryWinter: { sunRise: "13:32", sunSet: "23:44", moonRise: "11:15", moonSet: "20:50" },
    equinox: { sunRise: "12:32", sunSet: "00:39", moonRise: "13:15", moonSet: "01:40" },
    juneSolstice: { sunRise: "11:20", sunSet: "01:41", moonRise: "18:25", moonSet: "06:02" },
    ordinaryLate: { sunRise: "11:56", sunSet: "01:07", moonRise: "21:47", moonSet: "06:31" },
    decSolstice: { sunRise: "13:28", sunSet: "23:25", moonRise: "21:00", moonSet: "10:50" },
  },
  Montevideo: {
    ordinaryWinter: { sunRise: "08:47", sunSet: "23:01", moonRise: "05:32", moonSet: "20:57" },
    equinox: { sunRise: "09:48", sunSet: "21:56", moonRise: "11:26", moonSet: "22:40" },
    juneSolstice: { sunRise: "10:52", sunSet: "20:41", moonRise: "15:29", moonSet: "03:02" },
    ordinaryLate: { sunRise: "10:17", sunSet: "21:19", moonRise: "16:03", moonSet: "06:37" },
    decSolstice: { sunRise: "08:28", sunSet: "22:58", moonRise: "20:41", moonSet: "05:40" },
  },
  Kraków: {
    ordinaryWinter: { sunRise: "06:33", sunSet: "15:06", moonRise: "04:26", moonSet: "11:27" },
    equinox: { sunRise: "04:43", sunSet: "16:53", moonRise: "04:58", moonSet: "19:07" },
    juneSolstice: { sunRise: "02:31", sunSet: "18:53", moonRise: "10:16", moonSet: "22:26" },
    ordinaryLate: { sunRise: "03:40", sunSet: "17:45", moonRise: "15:03", moonSet: "21:59" },
    decSolstice: { sunRise: "06:36", sunSet: "14:40", moonRise: "11:54", moonSet: "03:35" },
  },
  Trondheim: {
    ordinaryWinter: {
      dayOverride: "2026-01-14",
      sunRise: "08:40",
      sunSet: "14:16",
      moonRise: "06:53",
      moonSet: "08:34",
    },
    equinox: { sunRise: "05:20", sunSet: "17:34", moonRise: "05:08", moonSet: "20:34" },
    juneSolstice: { sunRise: "01:02", sunSet: "21:38", moonRise: "10:55", moonSet: "22:55" },
    ordinaryLate: {
      dayOverride: "2026-08-20",
      sunRise: "03:29",
      sunSet: "19:13",
      moonRise: "16:47",
      moonSet: "18:01",
    },
    decSolstice: { sunRise: "09:01", sunSet: "13:32", moonRise: "10:38", moonSet: "06:07" },
  },
  Ushuaia: {
    ordinaryWinter: { sunRise: "08:22", sunSet: "01:03", moonRise: "04:34", moonSet: "23:42" },
    equinox: { sunRise: "10:35", sunSet: "22:46", moonRise: "12:51", moonSet: "22:48" },
    juneSolstice: { sunRise: "12:59", sunSet: "20:11", moonRise: "16:16", moonSet: "03:46" },
    ordinaryLate: { sunRise: "11:38", sunSet: "21:35", moonRise: "15:00", moonSet: "09:20" },
    decSolstice: { sunRise: "07:51", sunSet: "01:11", moonRise: "23:08", moonSet: "05:11" },
  },
};

/** The UTC day a rise/set row is actually about (honours `dayOverride`). */
export const riseSetDay = (site: SiteKey, date: DateKey): string =>
  USNO_RISESET[site][date].dayOverride ?? DATES[date];

/** True when a rise/set row is still a placeholder (any field un-fetched). */
export const riseSetIsPlaceholder = (r: RiseSet): boolean =>
  r.sunRise === "PLACEHOLDER" ||
  r.sunSet === "PLACEHOLDER" ||
  r.moonRise === "PLACEHOLDER" ||
  r.moonSet === "PLACEHOLDER";

// ─── USNO geocentric altitudes ──────────────────────────────────────────────────────────────

export type AltSample = {
  site: SiteKey;
  date: DateKey;
  /** HH:MM UTC on that date. */
  utc: string;
  body: "Sun" | "Moon";
  /** `almanac_data.hc` from the celnav endpoint, or PLACEHOLDER. */
  altitudeDeg: number;
};

/**
 * Explicit samples rather than a rigid grid: a full 6×5×6×2 grid would be mostly noise. The
 * Denton / Montevideo / Kraków rows (equinox + both solstices) are carried over verbatim from
 * the old `accuracy-altitude.test.ts`; Quito / Trondheim / Ushuaia have an equinox column
 * each, fetched from the celnav endpoint. Every row is real — extend with more dates as needed.
 */
export const USNO_ALTITUDES: AltSample[] = [
  s("Denton", "equinox", "00:00", "Sun", 7.410036),
  s("Denton", "equinox", "00:00", "Moon", 20.05394),
  s("Denton", "equinox", "12:00", "Sun", -7.538953),
  s("Denton", "equinox", "16:00", "Sun", 40.583609),
  s("Denton", "equinox", "16:00", "Moon", 33.610369),
  s("Denton", "equinox", "20:00", "Sun", 51.41746),
  s("Denton", "equinox", "20:00", "Moon", 69.383229),
  s("Denton", "juneSolstice", "00:00", "Sun", 18.594595),
  s("Denton", "juneSolstice", "00:00", "Moon", 59.766456),
  s("Denton", "juneSolstice", "04:00", "Moon", 24.953286),
  s("Denton", "juneSolstice", "12:00", "Sun", 6.691745),
  s("Denton", "juneSolstice", "16:00", "Sun", 55.696645),
  s("Denton", "juneSolstice", "20:00", "Sun", 68.061421),
  s("Denton", "juneSolstice", "20:00", "Moon", 18.965891),
  s("Denton", "decSolstice", "00:00", "Sun", -7.457506),
  s("Denton", "decSolstice", "00:00", "Moon", 44.725169),
  s("Denton", "decSolstice", "04:00", "Moon", 77.033025),
  s("Denton", "decSolstice", "08:00", "Moon", 32.180452),
  s("Denton", "decSolstice", "16:00", "Sun", 23.441045),
  s("Denton", "decSolstice", "20:00", "Sun", 29.148178),
  s("Montevideo", "equinox", "12:00", "Sun", 25.770928),
  s("Montevideo", "equinox", "12:00", "Moon", 6.590283),
  s("Montevideo", "equinox", "16:00", "Sun", 55.029037),
  s("Montevideo", "equinox", "16:00", "Moon", 41.046877),
  s("Montevideo", "equinox", "20:00", "Sun", 22.591563),
  s("Montevideo", "equinox", "20:00", "Moon", 28.204048),
  s("Montevideo", "juneSolstice", "00:00", "Moon", 33.909388),
  s("Montevideo", "juneSolstice", "12:00", "Sun", 10.744776),
  s("Montevideo", "juneSolstice", "16:00", "Sun", 31.573671),
  s("Montevideo", "juneSolstice", "16:00", "Moon", 6.278126),
  s("Montevideo", "juneSolstice", "20:00", "Sun", 6.303288),
  s("Montevideo", "juneSolstice", "20:00", "Moon", 49.824643),
  s("Montevideo", "decSolstice", "00:00", "Sun", -11.383769),
  s("Montevideo", "decSolstice", "00:00", "Moon", 32.915597),
  s("Montevideo", "decSolstice", "04:00", "Moon", 16.396461),
  s("Montevideo", "decSolstice", "08:00", "Sun", -5.640329),
  s("Montevideo", "decSolstice", "12:00", "Sun", 40.678989),
  s("Montevideo", "decSolstice", "16:00", "Sun", 77.94117),
  s("Montevideo", "decSolstice", "20:00", "Sun", 33.652492),
  s("Kraków", "equinox", "04:00", "Sun", -7.768046),
  s("Kraków", "equinox", "08:00", "Sun", 28.431054),
  s("Kraków", "equinox", "08:00", "Moon", 28.594278),
  s("Kraków", "equinox", "12:00", "Sun", 37.560459),
  s("Kraków", "equinox", "12:00", "Moon", 50.409626),
  s("Kraków", "equinox", "16:00", "Sun", 7.623453),
  s("Kraków", "equinox", "16:00", "Moon", 28.003995),
  s("Kraków", "juneSolstice", "04:00", "Sun", 11.405118),
  s("Kraków", "juneSolstice", "08:00", "Sun", 48.836279),
  s("Kraków", "juneSolstice", "12:00", "Sun", 59.338475),
  s("Kraków", "juneSolstice", "12:00", "Moon", 15.679471),
  s("Kraków", "juneSolstice", "16:00", "Sun", 24.361925),
  s("Kraków", "juneSolstice", "16:00", "Moon", 38.627779),
  s("Kraków", "juneSolstice", "20:00", "Sun", -8.203469),
  s("Kraków", "juneSolstice", "20:00", "Moon", 21.973887),
  s("Kraków", "decSolstice", "00:00", "Moon", 30.816477),
  s("Kraków", "decSolstice", "04:00", "Moon", -2.854234),
  s("Kraków", "decSolstice", "08:00", "Sun", 8.578368),
  s("Kraków", "decSolstice", "12:00", "Sun", 14.296938),
  s("Kraków", "decSolstice", "12:00", "Moon", 0.856948),
  s("Kraków", "decSolstice", "16:00", "Sun", -11.937239),
  s("Kraków", "decSolstice", "16:00", "Moon", 35.977882),
  s("Kraków", "decSolstice", "20:00", "Moon", 64.444688),
  // New sites — equinox, `almanac_data.hc` from the celnav endpoint. Sampled where the body is
  // above (or within refraction of) the horizon, since celnav only reports risen objects.
  s("Quito", "equinox", "12:00", "Sun", 9.67308),
  s("Quito", "equinox", "15:00", "Sun", 54.681765),
  s("Quito", "equinox", "15:00", "Moon", 36.073871),
  s("Quito", "equinox", "18:00", "Sun", 80.305786),
  s("Quito", "equinox", "18:00", "Moon", 74.480398),
  s("Quito", "equinox", "21:00", "Sun", 35.298716),
  s("Quito", "equinox", "21:00", "Moon", 53.954386),
  s("Trondheim", "equinox", "06:00", "Sun", 3.669149),
  s("Trondheim", "equinox", "06:00", "Moon", 5.863755),
  s("Trondheim", "equinox", "12:00", "Sun", 26.207227),
  s("Trondheim", "equinox", "12:00", "Moon", 36.791704),
  s("Trondheim", "equinox", "18:00", "Sun", -3.766939),
  s("Trondheim", "equinox", "18:00", "Moon", 15.580845),
  s("Trondheim", "equinox", "21:00", "Moon", -2.105173),
  s("Ushuaia", "equinox", "12:00", "Sun", 11.318103),
  s("Ushuaia", "equinox", "15:00", "Sun", 31.445769),
  s("Ushuaia", "equinox", "15:00", "Moon", 14.715374),
  s("Ushuaia", "equinox", "18:00", "Sun", 32.777281),
  s("Ushuaia", "equinox", "18:00", "Moon", 23.107587),
  s("Ushuaia", "equinox", "21:00", "Sun", 14.084867),
  s("Ushuaia", "equinox", "21:00", "Moon", 12.818085),
];

function s(
  site: SiteKey,
  date: DateKey,
  utc: string,
  body: "Sun" | "Moon",
  altitudeDeg: number
): AltSample {
  return { site, date, utc, body, altitudeDeg };
}

// ─── NASA SVS Moon equatorial (geocentric — dates only, no site) ─────────────────────────────

export type MoonEquatorial = {
  /** Reference instant, always 12:00 UTC on the canonical date. */
  utc: string;
  /** J2000 right ascension, degrees (= dial-a-moon `j2000_ra` hours × 15). */
  raDeg: number;
  /** J2000 declination, degrees. */
  decDeg: number;
};

/**
 * From NASA SVS Dial-a-Moon (`dialamoon/<date>T12:00`), `j2000_ra` × 15 for degrees. Consumed
 * by `accuracy-ephemeris.test.ts`. `getMoonEquatorial` returns coordinates *of date*, ~0.4° of
 * RA precession from J2000 by 2026 — that offset is the tolerance in the consuming test, not
 * model error.
 */
export const MOON_EQUATORIAL: Record<DateKey, MoonEquatorial> = {
  equinox: { utc: `${DATES.equinox}T12:00:00Z`, raDeg: 15.7605, decDeg: 10.3622 },
  juneSolstice: { utc: `${DATES.juneSolstice}T12:00:00Z`, raDeg: 174.4695, decDeg: 0.1965 },
  decSolstice: { utc: `${DATES.decSolstice}T12:00:00Z`, raDeg: 49.389, decDeg: 23.5026 },
  ordinaryWinter: { utc: `${DATES.ordinaryWinter}T12:00:00Z`, raDeg: 256.1115, decDeg: -27.9197 },
  ordinaryLate: { utc: `${DATES.ordinaryLate}T12:00:00Z`, raDeg: 264.5535, decDeg: -28.1061 },
};

// ─── Moon pass (parallactic angle) — per site, its own instants ──────────────────────────────

export type MoonPassPoint = { utc: string; parallacticDeg: number; altitudeDeg: number };
export type MoonPass = { moonrise: MoonPassPoint; transit: MoonPassPoint; moonset: MoonPassPoint };

/**
 * A Moon pass is inherently tied to a specific pass, not to a solar date, so this table shares
 * only `SITES`. Denton is the real pass consumed by `accuracy-ephemeris.test.ts`; add other
 * sites here with q and altitude at that site's rise / transit / set if a detailed pass check
 * is wanted for them (the per-site invariant sweep in `parallactic.test.ts` already covers all
 * six without ground truth).
 */
export const MOON_PASS: Partial<Record<SiteKey, MoonPass>> = {
  Denton: {
    moonrise: { utc: "2026-08-20T20:00:00Z", parallacticDeg: -52.17, altitudeDeg: 0.19 },
    transit: { utc: "2026-08-21T00:50:00Z", parallacticDeg: -0.665, altitudeDeg: 29.98 },
    moonset: { utc: "2026-08-21T05:45:00Z", parallacticDeg: 52.087, altitudeDeg: -0.13 },
  },
};
