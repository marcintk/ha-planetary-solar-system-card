import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import { getMoonPhase } from "../astronomy/moon-phase.js";
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
        // An overridden zone isn't HA's own, so name it — "18:42" alone would read as local
        // time to someone whose HA sits in a different zone. "short" prefers a real abbreviation
        // (CDT) where the locale has one and falls back to an offset (GMT+5:30) where it doesn't,
        // which covers both a named IANA zone and a longitude-estimated Etc/GMT±N.
        timeZoneName: locationData.zoneOverride ? "short" : undefined,
      })
    : null;

  const name = locationName || "";
  return html`<div class="status-bar">
    <span>${name} | ${mode} (${elevRounded}°)</span>
    ${next && formatter ? html`<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>` : nothing}
  </div>`;
}

// Sources backed by a fetched NASA image: they have a URL, a capture date, a cache/backoff
// cycle, and can open full-screen. Every Record<ImageSource, ...> below is keyed on exactly
// these, which is why moon — drawn locally, never fetched, never full-screen — is NOT one.
export type ImageSource = "earth" | "sun";

// Anything that can occupy a slot in the gallery strip. Moon is display-only: it has no URL
// and no panel, so it appears here and nowhere else.
export type GallerySource = ImageSource | "moon";

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  earth: "DSCOVR Earth",
  sun: "SDO HMI Continuum",
};

// Labels for the gallery thumbnail strip — the left half of every tile's caption.
export const GALLERY_SOURCE_LABELS: Record<GallerySource, string> = {
  moon: "MOON",
  earth: "DSCOVR/E",
  sun: "SDO/S",
};

/**
 * Tooltip for the moon tile — the counterpart to the NASA tiles' "Show <source>", which
 * would be a lie here since nothing opens.
 *
 * Says "tonight" only while the view is live. The date-nav buttons can put the card on any
 * date, and the disc follows them, so a fixed "Tonight's Moon" would quietly misdescribe
 * every navigated view. Illumination is the one thing the caption has no room for, which is
 * what makes this worth a tooltip rather than a repeat of the phase name.
 */
export function buildMoonTitle(date: Date, isLiveMode: boolean): string {
  const { phaseName, illumination } = getMoonPhase(date);
  const when = isLiveMode ? "Tonight's Moon" : `Moon on ${formatDate(date)}`;
  return `${when} — ${phaseName}, ${Math.round(illumination * 100)}% illuminated`;
}

/**
 * The caption overlaid on a gallery thumbnail: source on the left, detail on the right.
 *
 * Shared by every tile rather than written out per branch. The moon tile is built from a
 * different element than the fetched ones (a <div>, since it has no full-screen view), and
 * when each branch spelled its own caption out the two drifted apart — different spans, and
 * a moon-only `justify-content` override that shifted the text off the baseline its
 * neighbours sat on. One builder means they cannot diverge again.
 */
export function buildGalleryCaption(label: string, detail: string): TemplateResult {
  return html`<div class="gallery-info">
    <span class="gallery-label">${label}</span>
    <span class="gallery-age">${detail}</span>
  </div>`;
}

// Sources that need fetching/hydrating — the network-backed ones only.
export const IMAGE_SOURCES: ImageSource[] = ["earth", "sun"];

// Every name accepted in `gallery.sources`. Order here is only the validation set; the
// user's own list order is what decides layout.
export const GALLERY_SOURCES: GallerySource[] = ["moon", "earth", "sun"];

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
