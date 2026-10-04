interface VisiblePlanetsResult {
  planets: readonly string[];
  validUntil: Date;
}

interface CacheEntry {
  planets: readonly string[];
  computedFor: number;
  validUntil: number;
  lat: number;
  lon: number;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Memoises the last "visible tonight" result. Planets move slowly, so the list can only change when
 * the night window rolls over (past `validUntil`), the location moves (0.1 degree granularity), or
 * the user navigates to a date earlier than the one the entry was computed for.
 */
export function createVisiblePlanetsCache(
  compute: (lat: number, lon: number, date: Date) => VisiblePlanetsResult
): (lat: number, lon: number, date: Date) => readonly string[] {
  let entry: CacheEntry | undefined;
  return (lat, lon, date) => {
    const rLat = round1(lat);
    const rLon = round1(lon);
    const t = date.getTime();
    if (
      entry &&
      entry.lat === rLat &&
      entry.lon === rLon &&
      entry.computedFor <= t &&
      t <= entry.validUntil
    ) {
      return entry.planets;
    }
    const result = compute(lat, lon, date);
    entry = {
      planets: result.planets,
      computedFor: t,
      validUntil: result.validUntil.getTime(),
      lat: rLat,
      lon: rLon,
    };
    return entry.planets;
  };
}
