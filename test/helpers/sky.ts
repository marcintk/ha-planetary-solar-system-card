/**
 * Shared scan/bisection helpers for the observer suites.
 *
 * Pure functions over injected callbacks — no `src/` runtime imports — so a renderer test and
 * an astronomy test can find a rise/set or a twilight-band crossing the same way. Lifted
 * verbatim from `test/renderer/accuracy-horizon.test.ts` and
 * `test/renderer/accuracy-twilight.test.ts`, which used to keep private copies.
 */

export const MINUTE = 60_000;

/** `at("2026-03-20", "13:32")` → that instant as a UTC Date. */
export const at = (day: string, hhmm: string): Date => new Date(`${day}T${hhmm}:00Z`);

/**
 * When `altitudeAt` crosses `altitude` over one UTC day, refined to the second. A
 * minute-resolution scan would quantise the answer to the size of the error being measured.
 */
export function crossing(
  altitudeAt: (date: Date) => number,
  day: string,
  altitude: number,
  direction: "rise" | "set"
): Date | null {
  const start = at(day, "00:00").getTime();
  const crossed = (a: number, b: number) =>
    direction === "rise" ? a <= 0 && b > 0 : a >= 0 && b < 0;
  const height = (t: number) => altitudeAt(new Date(t)) - altitude;

  let previous = height(start);
  for (let minute = 1; minute <= 1440; minute++) {
    const t = start + minute * MINUTE;
    const now = height(t);
    if (crossed(previous, now)) {
      let lo = t - MINUTE;
      let hi = t;
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if (crossed(height(lo), height(mid))) hi = mid;
        else lo = mid;
      }
      return new Date(hi);
    }
    previous = now;
  }
  return null;
}

/**
 * How far `ours` falls outside the whole minute the almanac printed. The USNO rounds to the
 * nearest minute, so any instant within 30 s of the printed time is consistent with it; that
 * half-minute is the reference's own resolution, not slack, so it is subtracted off.
 */
export const secondsOutsidePrintedMinute = (ours: Date, printed: Date): number =>
  Math.max(0, Math.abs(ours.getTime() - printed.getTime()) - 30_000) / 1000;

/** °/min the altitude is moving at the moment it crosses — decides normal vs grazing. */
export function localRateDegPerMin(altitudeAt: (date: Date) => number, when: Date): number {
  return (
    altitudeAt(new Date(when.getTime() + 30_000)) - altitudeAt(new Date(when.getTime() - 30_000))
  );
}

/** Flat tolerance for a normal crossing (Sun ~6 s, Moon ~9 s sit under this today). */
export const CROSSING_TOLERANCE_SEC = 15;
/** Hard ceiling for any crossing, grazing or not — past this a shallow angle and a real
 * regression are indistinguishable. */
export const MAX_CROSSING_TOLERANCE_SEC = 120;
/** Below this °/min a crossing is near-tangential; the flat bound stops meaning what it says. */
export const GRAZING_RATE_DEG_PER_MIN = 0.09;
/** The altitude accuracy the card actually needs, used to derive a grazing crossing's bound. */
export const ALTITUDE_TOLERANCE_DEG = 0.1;

/**
 * Tolerance (seconds) for a crossing given the local rate it happens at: the flat number for a
 * normal crossing, or the altitude bound divided by the crossing's own slope for a grazing one,
 * capped at `MAX_CROSSING_TOLERANCE_SEC` either way.
 */
export function crossingToleranceSec(rateDegPerMin: number): number {
  const rate = Math.abs(rateDegPerMin);
  if (rate >= GRAZING_RATE_DEG_PER_MIN) return CROSSING_TOLERANCE_SEC;
  return Math.min((ALTITUDE_TOLERANCE_DEG / rate) * 60, MAX_CROSSING_TOLERANCE_SEC);
}

/**
 * First dawn (ascending) and dusk (descending) crossing of `thresholdDeg` on `dayStr`, scanning
 * minute-by-minute across that day *in the observer's own local time* — the window starts at
 * local midnight (derived from `lon`, ~15°/hour) so dawn is always found before dusk regardless
 * of where on Earth the site is. `elevationDeg` is injected so this file stays free of `src/`
 * imports.
 */
export function findThresholdCrossings(
  lat: number,
  lon: number,
  dayStr: string,
  thresholdDeg: number,
  elevationDeg: (lat: number, lon: number, date: Date) => number
): { dawn: Date | null; dusk: Date | null } {
  const localMidnightUtcMs = Date.parse(`${dayStr}T00:00:00Z`) - (lon / 15) * 3_600_000;
  const scanStart = new Date(localMidnightUtcMs);
  const samples: { time: Date; elev: number }[] = [];
  for (let m = 0; m <= 24 * 60; m++) {
    const t = new Date(scanStart.getTime() + m * MINUTE);
    samples.push({ time: t, elev: elevationDeg(lat, lon, t) });
  }

  let dawn: Date | null = null;
  let dusk: Date | null = null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    if (prev.elev < thresholdDeg && curr.elev >= thresholdDeg && !dawn) dawn = curr.time;
    if (prev.elev >= thresholdDeg && curr.elev < thresholdDeg && !dusk) dusk = curr.time;
  }
  return { dawn, dusk };
}
