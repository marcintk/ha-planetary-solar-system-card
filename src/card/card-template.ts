import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import type { LocationData } from "../types.js";
import type { GalleryShape, GalleryViewModel } from "./gallery/gallery-controller.js";
import { formatRelativeWhen } from "./relative-time.js";

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

// Every source in the gallery: a fetched NASA image with a URL, a capture date, a
// cache/backoff cycle, and a full-screen view.
//
// "moon" and "mymoon" are the same NASA render at the same instant: the object tile shows it
// geocentric, celestial-north-up; the sky tile rotates it into the observer's own orientation.
export type ImageSource = "mymoon" | "moon" | "earth" | "sun";

// Everything that can occupy a slot in the strip. Same set as ImageSource now that the
// locally drawn disc is gone — kept as its own alias since the strip is the concept these
// call sites care about, not the fetch mechanics.
export type GallerySource = ImageSource;

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  mymoon: "NASA SVS Moon",
  moon: "NASA SVS Moon",
  earth: "DSCOVR Earth",
  sun: "SDO HMI Continuum",
};

// Labels for the gallery thumbnail strip — the top line of every tile's caption.
export const GALLERY_SOURCE_LABELS: Record<GallerySource, string> = {
  mymoon: "MYMOON",
  moon: "MOON",
  earth: "EARTH",
  sun: "SUN",
};

/**
 * The fraction of its own frame each source's disc spans **at its largest**.
 *
 * Every source ships a disc centred on black, but each leaves a different margin, and the
 * margin is not constant: apparent size changes as the geometry does. Measured from the
 * imagery — Moon 96.3% at perigee (from SVS's own `diameter` arcsec, anchored on a measured
 * full-moon frame), Sun 94.3% at perihelion, Earth 74.4-82.2% across DSCOVR's Lissajous orbit
 * around L1, which is much the widest swing of the three.
 *
 * Earth is pinned to exactly its largest sampled measurement rather than padded above it: this
 * value is also what every source gets rescaled against to reach a shared on-screen size (see
 * `TARGET_FRACTION`), so slack here no longer just leaves a thin black ring — it stays visible
 * as Earth reading smaller than Sun and Moon on every day but its widest. Four sampled dates
 * are not the whole orbit, so a day beyond all of them could still slice the limb — accepted
 * deliberately, since DSCOVR's orbit repeats roughly every six months and is unlikely to clear
 * the sampled ceiling by much.
 */
const DISC_FRACTION: Record<ImageSource, number> = {
  mymoon: 0.95,
  moon: 0.95,
  earth: 0.82,
  sun: 0.945,
};

/**
 * Every body renders at this same fraction of its tile, whichever source it is — and whichever
 * shape: square and circle share this table, so the object is the same on-screen size in both,
 * only the crop around it (inset square vs round) changes. Without a shared target each
 * source's own frame margin bleeds through at a different size — Earth's loose DSCOVR crop
 * noticeably smaller than the Moon's tight SVS one — which reads as inconsistency rather than
 * as the bodies' real relative sizes. A fixed target and a uniform margin instead put every
 * tile on equal footing, and staying under 1.0 everywhere leaves a safety margin against
 * DISC_FRACTION being a sampled ceiling rather than a proven one (see its own comment).
 *
 * Sun gets its own, smaller target rather than sharing the rest's 0.90: Moon and Earth are
 * pinned to their largest measurement (see DISC_FRACTION), so most days show them well under
 * that — genuinely smaller, not just cropped differently, since their distance really varies.
 * The Sun's distance barely does (~3% over a year, against the Moon's ~14%), so it renders at
 * its full target on nearly every frame, and matching Moon/Earth's on-screen size means giving
 * it a lower one of its own instead of counting on real-world variance to shrink it for free.
 */
const TARGET_FRACTION: Record<ImageSource, number> = {
  mymoon: 0.89,
  moon: 0.89,
  earth: 0.87,
  sun: 0.8,
};

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
  const fraction = DISC_FRACTION[source];
  const scale = `scale(${(TARGET_FRACTION[source] / fraction).toFixed(3)})`;
  const transform = rotationDeg ? `rotate(${rotationDeg.toFixed(1)}deg) ${scale}` : scale;
  const clip =
    shape === "circle"
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

// The fixed render order — no longer configurable now that each source is its own
// `gallery.<source>` boolean rather than a position in a list.
export const IMAGE_SOURCES: ImageSource[] = ["mymoon", "moon", "earth", "sun"];

// Full-screen status bar leads with the target body, the probe name follows (e.g.
// "EARTH · DSCOVR · captured ..."). Kept separate from IMAGE_SOURCE_LABELS, which stays
// fuller for the error banner ("SDO HMI Continuum image unavailable").
const IMAGE_STATUS_TARGET: Record<ImageSource, string> = {
  mymoon: "MOON",
  moon: "MOON",
  earth: "EARTH",
  sun: "SUN",
};
// Earth and Sun tiles show photographs; the Moon tiles show renders. "captured … 3h ago" is
// wrong for a render.
const IMAGE_STATUS_VERB: Record<ImageSource, string> = {
  mymoon: "rendered",
  moon: "rendered",
  earth: "captured",
  sun: "captured",
};
const IMAGE_STATUS_INSTRUMENT: Record<ImageSource, string> = {
  mymoon: "NASA SVS",
  moon: "NASA SVS",
  earth: "NASA DSCOVR",
  sun: "NASA SDO HMI",
};

export function buildImageStatusBar(
  mode: ImageSource,
  dateText: string,
  imageDate: Date,
  now: Date,
  loaded: boolean
): TemplateResult {
  const status = loaded
    ? `${IMAGE_STATUS_VERB[mode]} ${dateText} · ${formatRelativeWhen(imageDate, now)}`
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
