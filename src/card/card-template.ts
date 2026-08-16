import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import type { LocationData } from "../types.js";
import { formatRelativeAge } from "./relative-time.js";

export function buildStatusBar(
  locationData: LocationData | null,
  locationName: string | null,
  currentDate: Date
): TemplateResult | typeof nothing {
  if (!locationData) return nothing;

  const elevDeg = computeSolarElevationDeg(locationData.lat, locationData.lon, currentDate);
  const mode = getSkyMode(elevDeg);
  const elevRounded = Math.round(elevDeg);
  const next = computeNextTransitionTime(locationData.lat, locationData.lon, currentDate);
  const formatter = next
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: locationData.timezone || "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  const name = locationName || "";
  return html`<div class="status-bar">
    <span>${name} | ${mode} (${elevRounded}°)</span>
    ${next && formatter ? html`<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>` : nothing}
  </div>`;
}

export type ImageSource = "earth" | "sun";

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  earth: "DSCOVR Earth",
  sun: "SDO HMI Continuum",
};

// Labels for the gallery thumbnail strip.
export const GALLERY_SOURCE_LABELS: Record<ImageSource, string> = {
  earth: "L1→EARTH",
  sun: "GEO→SUN",
};

export const GALLERY_SOURCES: ImageSource[] = ["earth", "sun"];

export function buildImageStatusBar(
  mode: ImageSource,
  dateText: string,
  imageDate: Date,
  now: Date
): TemplateResult {
  return html`<div class="status-bar">
    <span>${IMAGE_SOURCE_LABELS[mode]} · captured ${dateText} (${formatRelativeAge(imageDate, now)})</span>
  </div>`;
}
