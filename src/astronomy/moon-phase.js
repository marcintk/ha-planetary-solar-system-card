/**
 * Moon phase calculation using synodic month cycle.
 */

/** Synodic month in days (New Moon to New Moon). */
const SYNODIC_MONTH = 29.53059;

/** Known New Moon epoch: January 6, 2000 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

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

/**
 * Compute the Moon's synodic phase for a given date.
 * @param {Date} date
 * @returns {{ phase: number, phaseName: string, illumination: number }}
 *   - phase: 0–1 where 0 = New Moon, 0.5 = Full Moon
 *   - phaseName: one of 8 discrete phase names
 *   - illumination: 0–1 fraction of visible disc illuminated
 */
export function getMoonPhase(date) {
  const daysSinceEpoch = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
  const phase =
    (((daysSinceEpoch % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;

  // Map to 8 segments: each segment is 1/8 wide, centered on ideal values 0, 0.125, 0.25, ...
  const segment = Math.floor(((phase + 1 / 16) % 1) * 8);
  const phaseName = PHASE_NAMES[segment];

  // Illumination: 0 at New Moon, 1 at Full Moon, 0.5 at quarters
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  return { phase, phaseName, illumination };
}
