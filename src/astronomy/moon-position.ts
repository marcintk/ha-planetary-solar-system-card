/**
 * The Moon's equatorial coordinates *of date* (Meeus, *Astronomical Algorithms*, ch. 47),
 * plus Greenwich mean sidereal time.
 *
 * Separate from moon-phase.ts on purpose. That module answers "how lit is it", which the
 * three largest periodic terms settle to well inside a phase-name segment. This one answers
 * "where is it on the sky", which feeds a parallactic angle — and there the same three terms
 * leave up to 6.07° of orientation error, against 0.62° for the series below. The phase
 * module keeps its cheaper approximation; nothing here replaces it.
 *
 * Coordinates are *of date*, not J2000. A local hour angle is measured against the true
 * equinox of the moment, so precessing back to J2000 would introduce the ~0.4° error it
 * looks like it removes. (NASA's Dial-a-Moon reports J2000, which is why the two differ by
 * that much; de-precessed, this series agrees with it to 0.034° in right ascension.)
 */

const DEG = Math.PI / 180;
const sin = (degrees: number) => Math.sin(degrees * DEG);
const cos = (degrees: number) => Math.cos(degrees * DEG);
const tan = (degrees: number) => Math.tan(degrees * DEG);
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;

export interface MoonEquatorial {
  /** Right ascension of date, degrees in [0, 360). */
  raDeg: number;
  /** Declination of date, degrees in [-90, 90]. */
  decDeg: number;
}

// Meeus 47.A / 47.B, leading terms: [D, M, M', F, coefficient in 1e-6 degrees]. Truncated
// where the remaining rows stop moving the result by more than a few arc-seconds — far below
// the sub-pixel budget a 104 px thumbnail works to. The eccentricity factor E that scales the
// M-dependent rows is omitted for the same reason (it shifts them by ~0.2%).
type Term = readonly [number, number, number, number, number];

const LONGITUDE_TERMS: readonly Term[] = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
];

const LATITUDE_TERMS: readonly Term[] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
];

function daysSinceJ2000(date: Date): number {
  // 2440587.5 converts a Unix epoch day count to a Julian Day; 2451545 is JD at J2000.0.
  return date.getTime() / 86400000 + 2440587.5 - 2451545;
}

/**
 * Greenwich mean sidereal time in degrees — the angle Earth's rotation has carried the prime
 * meridian past the equinox. Subtracting a body's right ascension from it (plus the
 * observer's longitude) gives the local hour angle every horizon calculation is built on.
 */
export function greenwichSiderealDeg(date: Date): number {
  return norm360(280.46061837 + 360.98564736629 * daysSinceJ2000(date));
}

export function getMoonEquatorial(date: Date): MoonEquatorial {
  const d = daysSinceJ2000(date);
  const T = d / 36525;

  // Mean arguments (Meeus 47.1–47.5)
  const meanLongitude = 218.3164477 + 481267.88123421 * T;
  const elongation = 297.8501921 + 445267.1114034 * T;
  const sunAnomaly = 357.5291092 + 35999.0502909 * T;
  const moonAnomaly = 134.9633964 + 477198.8675055 * T;
  const argumentOfLatitude = 93.272095 + 483202.0175233 * T;

  const sumTerms = (terms: readonly Term[]) =>
    terms.reduce(
      (total, [dD, dM, dMp, dF, coefficient]) =>
        total +
        coefficient *
          1e-6 *
          sin(dD * elongation + dM * sunAnomaly + dMp * moonAnomaly + dF * argumentOfLatitude),
      0
    );

  const eclipticLon = meanLongitude + sumTerms(LONGITUDE_TERMS);
  const eclipticLat = sumTerms(LATITUDE_TERMS);
  // Mean obliquity, linear term only — it drifts 0.013° per century, so higher orders cannot
  // reach the sub-pixel budget within any date this card will be asked about.
  const obliquity = 23.4393 - 3.563e-7 * d;

  return {
    raDeg: norm360(
      Math.atan2(
        sin(eclipticLon) * cos(obliquity) - tan(eclipticLat) * sin(obliquity),
        cos(eclipticLon)
      ) / DEG
    ),
    decDeg:
      Math.asin(
        sin(eclipticLat) * cos(obliquity) + cos(eclipticLat) * sin(obliquity) * sin(eclipticLon)
      ) / DEG,
  };
}
