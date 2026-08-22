import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import { getMoonPhase } from "../astronomy/moon-phase.js";
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
// cache/backoff cycle, and a full-screen view. Since the moon tiles became NASA imagery
// too there is no display-only source left, so this is also the whole strip — the separate
// GallerySource union that existed to carry the locally drawn disc is gone.
//
// "moon" and "moon-sky" are the same NASA render at different instants: the object tile
// follows the current hour, the sky tile pins to 22:00 local and is rotated into the
// observer's own orientation.
export type ImageSource = "mymoon" | "moon" | "earth" | "sun";

// Everything that can occupy a slot in the strip. drawnmoon is display-only: computed
// locally, so it has no URL, no cache, no failure mode and no full-screen view.
export type GallerySource = ImageSource | "drawnmoon";

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  mymoon: "NASA SVS Moon",
  moon: "NASA SVS Moon",
  earth: "DSCOVR Earth",
  sun: "SDO HMI Continuum",
};

// Labels for the gallery thumbnail strip — the top line of every tile's caption.
export const GALLERY_SOURCE_LABELS: Record<GallerySource, string> = {
  mymoon: "MY SKY",
  moon: "MOON",
  earth: "DSCOVR/E",
  sun: "SDO/S",
  drawnmoon: "DRAWN",
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
  mymoon: 0.963,
  moon: 0.963,
  earth: 0.822,
  sun: 0.943,
};

/**
 * Every body renders at this same fraction of its tile, whichever source it is. Without a
 * shared target each source's own frame margin bleeds through at a different size — Earth's
 * loose DSCOVR crop noticeably smaller than the Moon's tight SVS one — which reads as
 * inconsistency rather than as the bodies' real relative sizes. A fixed target and a uniform
 * black ring instead put every tile on equal footing.
 */
const TARGET_FRACTION = 0.92;

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
  // The sky tile is the one exception: a rotated square is not a square. The tile clips the
  // corners that swing outside it while the card shows through where the image's own corners
  // swing in, so an unclipped rotated frame renders as an octagon at every angle but 0 and 90.
  // Scaling it down by 1/(|cos|+|sin|) would keep all four corners, at the cost of a tilted
  // diamond up to 29% smaller than its neighbours. A circle is the one shape rotation leaves
  // alone, so the sky tile takes one whatever the setting, at the frame's own edge rather than
  // the shared target — it needs no rescale, since the clip already lands on the tile edge.
  if (shape === "square" && rotationDeg) {
    return `clip-path: circle(50%); transform: rotate(${rotationDeg.toFixed(1)}deg)`;
  }
  const fraction = DISC_FRACTION[source];
  const scale = `scale(${(TARGET_FRACTION / fraction).toFixed(3)})`;
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

// The gallery strip, in render order. Fixed rather than configurable: `gallery.sources` was
// one knob too many for three tiles that each answer a different question, and a user who
// wanted fewer of them wanted the strip closed, not pruned.
// Fetched sources, in the order they render when `gallery.sources` says nothing. The drawn
// disc is deliberately absent: it is a diagram, and it does not belong in a strip of
// photographs unless someone asks for it by name.
export const IMAGE_SOURCES: ImageSource[] = ["mymoon", "moon", "earth", "sun"];

// Every name `gallery.sources` accepts. Order here is only the validation set — the user's
// own list order is what decides layout.
export const GALLERY_SOURCES: GallerySource[] = [...IMAGE_SOURCES, "drawnmoon"];

// Full-screen status bar leads with the target body, the probe name follows (e.g.
// "EARTH · DSCOVR · captured ..."). Kept separate from IMAGE_SOURCE_LABELS, which stays
// fuller for the error banner ("SDO HMI Continuum image unavailable").
const IMAGE_STATUS_TARGET: Record<ImageSource, string> = {
  mymoon: "MOON",
  moon: "MOON",
  earth: "EARTH",
  sun: "SUN",
};
// Earth and Sun tiles show photographs; the Moon tiles show renders, and the sky one is for
// an hour that has usually not happened yet. "captured … 3h ago" is wrong on both counts.
const IMAGE_STATUS_VERB: Record<ImageSource, string> = {
  mymoon: "rendered for",
  moon: "rendered",
  earth: "captured",
  sun: "captured",
};
const IMAGE_STATUS_INSTRUMENT: Record<ImageSource, string> = {
  mymoon: "NASA SVS",
  moon: "NASA SVS",
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
