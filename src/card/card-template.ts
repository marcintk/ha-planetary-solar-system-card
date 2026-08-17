import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import type { LocationData } from "../types.js";
import type { GalleryViewModel } from "./gallery/gallery-controller.js";
import { formatRelativeAge } from "./relative-time.js";

export function formatDate(date: Date): string {
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

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
  earth: "DSCOVR/E",
  sun: "SDO/S",
};

export const GALLERY_SOURCES: ImageSource[] = ["earth", "sun"];

// Full-screen status bar leads with the target body, the probe name follows (e.g.
// "EARTH · DSCOVR · captured ..."). Kept separate from IMAGE_SOURCE_LABELS, which stays
// fuller for the error banner ("SDO HMI Continuum image unavailable").
const IMAGE_STATUS_TARGET: Record<ImageSource, string> = {
  earth: "EARTH",
  sun: "SUN",
};
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
    <span>${IMAGE_STATUS_TARGET[mode]} · ${IMAGE_STATUS_INSTRUMENT[mode]} · ${status}</span>
  </div>`;
}

// Picks which status bar variant to show — error banner wins outright, then the image panel's
// own status line, falling back to the location/sky status bar. Owns the branching card.ts's
// render() used to reconstruct from GalleryViewModel's raw fields on every render.
export function buildStatusBarView(
  gallery: GalleryViewModel,
  locationData: LocationData | null,
  locationName: string | null,
  currentDate: Date
): TemplateResult | typeof nothing {
  if (gallery.error) {
    return html`<div class="status-bar">
      <span>${gallery.error}</span>
    </div>`;
  }
  if (gallery.panelSource === "none") {
    return buildStatusBar(locationData, locationName, currentDate);
  }
  return buildImageStatusBar(
    gallery.panelSource,
    gallery.imageDate ? formatDate(gallery.imageDate) : "",
    gallery.imageDate ?? new Date(),
    new Date(),
    gallery.imageLoaded
  );
}
