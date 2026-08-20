/**
 * Moon phase from the true Sun–Moon elongation (Meeus, *Astronomical Algorithms*,
 * ch. 25/47).
 */

/** Phase name boundaries — 8 equal segments centered on each phase's ideal value. */
const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Third Quarter",
  "Waning Crescent",
];

const sin = (degrees: number) => Math.sin((degrees * Math.PI) / 180);

/**
 * Compute the Moon's synodic phase for a given date.
 * @param {Date} date
 * @returns {{ phase: number, phaseName: string, illumination: number }}
 *   - phase: 0–1 where 0 = New Moon, 0.5 = Full Moon
 *   - phaseName: one of 8 discrete phase names
 *   - illumination: 0–1 fraction of visible disc illuminated
 */
import type { MoonPhase } from "../types.js";

export function getMoonPhase(date: Date): MoonPhase {
  // Julian centuries since J2000.0
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;

  // Mean arguments, degrees (Meeus 47.1–47.4)
  const Lp = 218.3164477 + 481267.88123421 * T; // Moon's mean longitude
  const D = 297.8501921 + 445267.1114034 * T; // Moon's mean elongation
  const M = 357.5291092 + 35999.0502909 * T; // Sun's mean anomaly
  const Mp = 134.9633964 + 477198.8675055 * T; // Moon's mean anomaly

  // ponytail: three largest terms of Meeus 47.A — main term, evection, variation. Leaves
  // ~0.5 h RMS, far inside the 1.85-day-wide phase-name segments on a 60 px disc. Add rows
  // from 47.A if that ever matters. The evection coefficient is POSITIVE (+1274027 in the
  // table); issue #124's repro script has it negative, which biases its reference ~3.5 h.
  const moonLon = Lp + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D);
  const sunLon = 280.46646 + 36000.76983 * T + 1.914602 * sin(M) + 0.019993 * sin(2 * M);

  // Elongation of the Moon from the Sun, as a fraction of a cycle.
  const phase = ((((moonLon - sunLon) % 360) + 360) % 360) / 360;

  // Map to 8 segments: each segment is 1/8 wide, centered on ideal values 0, 0.125, 0.25, ...
  const segment = Math.floor(((phase + 1 / 16) % 1) * 8);
  const phaseName = PHASE_NAMES[segment];

  // Illumination: 0 at New Moon, 1 at Full Moon, 0.5 at quarters
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  return { phase, phaseName, illumination };
}
