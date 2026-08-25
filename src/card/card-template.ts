import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import { getMoonSkyAngles } from "../astronomy/parallactic.js";
import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import type { LocationData } from "../types.js";
import type { GalleryShape, GalleryViewModel } from "./gallery/gallery-controller.js";
import type { ImageSource } from "./gallery/sources.js";
import { SOURCES } from "./gallery/sources.js";
import { formatDate, formatRelativeWhen } from "./relative-time.js";

export function buildStatusBar(
  locationData: LocationData | null,
  locationName: string | null,
  currentDate: Date
): TemplateResult | typeof nothing {
  if (!locationData) return nothing;

  const elevDeg = computeSolarElevationDeg(locationData.lat, locationData.lon, currentDate);
  const mode = getSkyMode(elevDeg);
  const elevRounded = Math.round(elevDeg);
  const moonElevRounded = Math.round(
    getMoonSkyAngles(currentDate, locationData.lat, locationData.lon).altitudeDeg
  );
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
    <span>${name} | ${mode} (${elevRounded}°) | Moon (${moonElevRounded}°)</span>
    ${next && formatter ? html`<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>` : nothing}
  </div>`;
}

/**
 * Crops a thumbnail down to the body itself, then rescales it so every source ends up the same
 * size with the same margin — rather than each source's own, unequal frame margin.
 *
 * Two coupled numbers from one measurement: clip to the disc's own radius, then scale by
 * `TARGET_FRACTION` divided by that radius so it lands on the shared target instead of the
 * disc's own edge. They must stay coupled — `clip-path` resolves in the element's own
 * coordinates and `transform` applies to the result, so scaling without shrinking the clip by
 * the matching factor pushes the circle back outside the tile, which is the overflow this
 * exists to prevent.
 */
export function discStyle(source: ImageSource, shape: GalleryShape, rotationDeg = 0): string {
  const { disc: fraction, target, skyFrame } = SOURCES[source];
  const scale = `scale(${(target / fraction).toFixed(3)})`;
  const transform = rotationDeg ? `rotate(${rotationDeg.toFixed(1)}deg) ${scale}` : scale;
  // A sky-frame tile ignores gallery.shape and always circle-crops to the exact disc: it's the
  // one kind whose crop rotates with it, and a rotated inset() square still shows the source
  // JPEG's own black square canvas inside that rotated shape at every angle but 0/90/180/270 —
  // there's no square clip that avoids it. A circle is rotation-invariant, so it's the only
  // shape that gives an exact Moon crop with nothing but the tile's own backdrop around it,
  // whatever angle the observer's sky happens to be at.
  const effectiveShape = skyFrame ? "circle" : shape;
  const clip =
    effectiveShape === "circle"
      ? `circle(${(fraction * 50).toFixed(1)}%)`
      : `inset(${((1 - fraction) * 50).toFixed(1)}%)`;
  return `clip-path: ${clip}; transform: ${transform}`;
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

export function buildImageStatusBar(
  mode: ImageSource,
  dateText: string,
  imageDate: Date,
  now: Date,
  loaded: boolean
): TemplateResult {
  const spec = SOURCES[mode];
  const status = loaded
    ? `${spec.verb} ${dateText} · ${formatRelativeWhen(imageDate, now)}`
    : "loading…";
  return html`<div class="status-bar">
    <span>${spec.body} · ${spec.instrument} · ${status}</span>
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
