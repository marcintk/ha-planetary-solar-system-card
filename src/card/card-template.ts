import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import type { LocationData } from "../types.js";

export function buildStatusBarHtml(
  locationData: LocationData | null,
  locationName: string | null,
  currentDate: Date
): string {
  if (!locationData) return "";

  const elevDeg = computeSolarElevationDeg(locationData.lat, locationData.lon, currentDate);
  const mode = getSkyMode(elevDeg);
  const elevRounded = Math.round(elevDeg);
  const next = computeNextTransitionTime(locationData.lat, locationData.lon, currentDate);
  let rightSpan = "";
  if (next) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: locationData.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    rightSpan = `<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>`;
  }
  const name = locationName || "";
  return `<div class="status-bar"><span>${name} | ${mode} (${elevRounded}°)</span>${rightSpan}</div>`;
}
