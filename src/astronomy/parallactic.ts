/**
 * How the Moon hangs in one observer's sky.
 *
 * NASA renders the Moon from the centre of the Earth with celestial north up. That frame is
 * within ~1° of correct for everyone alive — the Moon is 384,400 km away and Earth's radius
 * is only 6,378 km — but it says nothing about *which way up* the Moon appears, and that
 * varies by up to ±90° with latitude, longitude and the hour.
 *
 * The parallactic angle is the missing rotation: the angle at the Moon between the direction
 * to the celestial pole (which the render puts at the top) and the direction to the
 * observer's zenith (which is up when you actually look). Rotating the frame clockwise by it
 * turns a geocentric portrait into the observer's own view.
 *
 * This replaces the hemisphere flip outright rather than refining it. A southern observer's
 * angle simply lands near 180° from a northern one's at the same instant, so no latitude
 * branch is needed anywhere — and the equator, where a sign test on latitude swings the
 * rendering by 180° over a fifth of a degree of travel, stops being a special case.
 */

import { getMoonEquatorial, greenwichSiderealDeg } from "./moon-position.js";

const DEG = Math.PI / 180;
const sin = (degrees: number) => Math.sin(degrees * DEG);
const cos = (degrees: number) => Math.cos(degrees * DEG);
const tan = (degrees: number) => Math.tan(degrees * DEG);

export interface MoonSkyAngles {
  /**
   * Parallactic angle in degrees, (-180, 180]. Rotate a celestial-north-up frame clockwise
   * by this to match the observer's sky.
   */
  parallacticDeg: number;
  /**
   * The Moon's altitude above the observer's horizon, degrees. Negative means it is not in
   * their sky at all — which happens on roughly half of any given hour's worth of nights,
   * at every latitude, because the Moon keeps its own hours rather than the Sun's.
   */
  altitudeDeg: number;
}

/**
 * Both angles come out of one hour-angle calculation, so they are returned together rather
 * than recomputed by two callers — the caption needs the altitude for exactly the moments
 * the rotation describes.
 */
export function getMoonSkyAngles(date: Date, latDeg: number, lonDeg: number): MoonSkyAngles {
  const { raDeg, decDeg } = getMoonEquatorial(date);
  const hourAngle = greenwichSiderealDeg(date) + lonDeg - raDeg;

  return {
    parallacticDeg:
      Math.atan2(sin(hourAngle), tan(latDeg) * cos(decDeg) - sin(decDeg) * cos(hourAngle)) / DEG,
    altitudeDeg:
      Math.asin(sin(latDeg) * sin(decDeg) + cos(latDeg) * cos(decDeg) * cos(hourAngle)) / DEG,
  };
}
