import type { ImageSource } from "../card-template.js";
import { SourceResolver } from "./source-resolver.js";
import type { SourcedImage, UrlCache } from "./url-cache.js";

// NASA's Scientific Visualization Studio publishes "Moon Phase and Libration, <year>": 8,760
// frames, one per hour, rendered from LOLA topography and the LROC WAC colour mosaic with
// positions from JPL DE421. Geocentric — the view from the centre of the Earth, celestial
// north up, apparent diameter to true scale.
//
// These are renders, not observations, and the whole year ships at once the previous
// November or December. So unlike DSCOVR and SDO there is no publish latency to buffer
// against and no "latest available" to discover: the frame for any hour of the mapped year
// already exists, including hours still in the future.
//
// The URL is computed rather than looked up. SVS does expose a JSON API that would hand over
// the URL directly, but it answers with `access-control-allow-origin: https://tempo.multiverse.music`
// — one hardcoded third-party origin, unchanged whatever Origin is sent — so fetch() is
// blocked from any Home Assistant origin. Plain <img src> is unaffected by CORS, which is why
// the image itself still loads. Same shape as the SDO sun resolver for the same reason.
export const SVS_BASE_URL = "https://svs.gsfc.nasa.gov/vis/a000000";
export const MOON_THUMB_SIZE = "216x216_1x1_30p";
export const MOON_FULL_SIZE = "730x730_1x1_30p";
export const MOON_FRAME_MS = 3600000;

// The one thing about this source that cannot be derived. SVS assigns each annual product a
// new id with no pattern to it (+93, +139, +228, +172 across these five), and the id is in
// the path. It has to ship as a constant and gain a row each December, when the following
// year's product is released — historically between 9 Nov and 11 Dec.
export const MOON_PRODUCT_IDS: Record<number, number> = {
  2022: 4955,
  2023: 5048,
  2024: 5187,
  2025: 5415,
  2026: 5587,
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * The frame for one instant, at one of the published resolutions.
 *
 * Throws rather than degrading for an unmapped year, and that is deliberate. SVS answers an
 * out-of-range date with the *last frame of the current product* under a 200, not a 404 — ask
 * it for March 2027 today and it returns a Moon at 38% when the truth is 9%. A source that
 * failed quietly here would show a confidently wrong Moon instead of no Moon.
 */
export function moonFrameUrl(at: Date, size: string): string {
  const year = at.getUTCFullYear();
  const product = MOON_PRODUCT_IDS[year];
  if (product == null) {
    throw new Error(`No NASA SVS moon product is published for ${year}`);
  }
  // Products are filed in hundreds: 5587 lives under a005500/a005587.
  const group = Math.floor(product / 100) * 100;
  const frame = Math.floor((at.getTime() - Date.UTC(year, 0, 1)) / MOON_FRAME_MS) + 1;
  return `${SVS_BASE_URL}/a${pad(group, 6)}/a${pad(product, 6)}/frames/${size}/moon.${pad(frame, 4)}.jpg`;
}

/**
 * The frame covering `at`, dated by the frame's own hour rather than the query instant — so
 * two cards asking at different minutes of the same hour agree on both the URL and the date
 * shown beneath it.
 */
export function getMoonFrameImage(at: Date, size: string = MOON_THUMB_SIZE): SourcedImage {
  const hour = new Date(Math.floor(at.getTime() / MOON_FRAME_MS) * MOON_FRAME_MS);
  return { url: moonFrameUrl(hour, size), date: hour };
}

/**
 * The full-screen counterpart of a thumbnail URL.
 *
 * Both sizes are the same frame at two resolutions, so swapping the size segment is exact —
 * no second lookup, no second cache entry, and the panel cannot drift onto a different hour
 * than the tile the user clicked. Anything that is not a moon URL passes through untouched.
 */
export function fullSizeMoonUrl(url: string): string {
  return url.replace(`/${MOON_THUMB_SIZE}/`, `/${MOON_FULL_SIZE}/`);
}

/**
 * One class, instantiated once per Moon tile.
 *
 * The two tiles show the same body from the same renders but at different instants — the
 * object tile follows the current hour, the sky tile pins to 22:00 local — so the reference
 * time is a strategy rather than a hardcoded `Date.now()`, and each instance owns its own
 * cache key. When both strategies happen to land on the same hour they resolve the same URL,
 * and the shared decode gate means the bytes are fetched once.
 */
export class SvsMoonResolver extends SourceResolver {
  readonly source: ImageSource;

  constructor(
    source: ImageSource,
    private readonly _referenceTime: () => Date,
    cache?: UrlCache
  ) {
    super(cache);
    this.source = source;
  }

  // Freshness is URL identity, not elapsed time. A wall-clock TTL would have to be anchored
  // to something (see the sun resolver's freshCachedSlot for how fiddly that gets), and here
  // there is nothing to anchor: the reference time already determines exactly one frame, so
  // "is the cached image the frame we want" is the whole question.
  protected getCached(): SourcedImage | null {
    const entry = this.cache.getEntry(this.source);
    if (!entry) return null;
    return entry.image.url === getMoonFrameImage(this._referenceTime()).url ? entry.image : null;
  }

  protected fetchCandidateUrl(): Promise<SourcedImage> {
    const image = getMoonFrameImage(this._referenceTime());
    this.cache.set(this.source, image);
    return Promise.resolve(image);
  }

  // No recover() override on purpose. Sun overrides it because SDO's publish pipeline lags and
  // the previous slot is a good guess. Here every frame of the year is already on disk, so a
  // failure means the product id is wrong or the network is down — neither of which an earlier
  // frame fixes. Fall through to the shared cooldown like any other source.
}
