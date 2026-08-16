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

// Short instrument name for the full-screen status bar, paired with the gallery source
// label so the two stay in sync (e.g. "GEO→SUN · SDO HMI · captured ..."). Kept separate
// from IMAGE_SOURCE_LABELS, which stays fuller for the error banner ("SDO HMI Continuum
// image unavailable").
const IMAGE_STATUS_INSTRUMENT: Record<ImageSource, string> = {
  earth: "DSCOVR",
  sun: "SDO HMI",
};

export function buildImageStatusBar(
  mode: ImageSource,
  dateText: string,
  imageDate: Date,
  now: Date,
  loaded: boolean
): TemplateResult {
  const status = loaded
    ? `captured ${dateText} · ${formatRelativeAge(imageDate, now)}`
    : "loading…";
  return html`<div class="status-bar">
    <span>${GALLERY_SOURCE_LABELS[mode]} · ${IMAGE_STATUS_INSTRUMENT[mode]} · ${status}</span>
  </div>`;
}
