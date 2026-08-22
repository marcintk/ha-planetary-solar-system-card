// Every source in the gallery: a fetched NASA image with a URL, a capture date, a
// cache/backoff cycle, and a full-screen view.
//
// "moon" and "mymoon" are the same NASA render at the same instant: the object tile shows it
// geocentric, celestial-north-up; the sky tile rotates it into the observer's own orientation.
export type ImageSource = "mymoon" | "moon" | "earth" | "sun";

// The fixed render order — no longer configurable now that each source is its own
// `gallery.<source>` boolean rather than a position in a list.
export const IMAGE_SOURCES: ImageSource[] = ["mymoon", "moon", "earth", "sun"];

// Earth's own resolve() makes two independent network calls (the EPIC JSON lookup for the
// latest URL, then the image-byte preload/decode) that used to share one set of counters,
// making it impossible to tell which one a spike came from. Split into two debug rows; sun
// has no separate URL-discovery network call (its candidate URL is pure math), so it stays a
// single row — ImageResolver passes the same accumulator as both url and img debug for sun.
//
// mymoon and moon collapse into one "moon" row for the same reason sun is one row rather than
// two: they share a cache key (SvsMoonResolver's cacheKey, see source-resolver-svs-moon.ts) and
// resolve to the same frame, so separate rows would show one real fetch as two — mymoon's own
// row always at 0 fetches (permanent cache hit), reading as broken rather than shared. Both
// still bump `refreshes` independently into the shared row, since each tile really does ask
// once a tick; only the network-facing counters (fetches, cacheHits, ...) tell the merged story.
export type DebugRowId = "moon" | "sun" | "earth-url" | "earth-img";

/**
 * Everything the rest of the card needs to know about one source, in one place.
 *
 * These facts used to live in eight tables across five modules (labels and disc geometry in
 * card-template.ts, the enabled-by-default set in card-config.ts, the debug rows in debug.ts),
 * each keyed by ImageSource and each edited by hand. Adding a source meant finding all eight;
 * nothing linked them, so missing one type-checked fine. One row per source instead, so the
 * compiler names every field a new source still owes.
 */
export interface SourceSpec {
  /** Full name, for the error banner: "SDO HMI Continuum image unavailable". */
  label: string;
  /** The strip tile's own caption — the top line of every thumbnail. */
  tile: string;
  /**
   * The body itself, leading the full-screen status bar ("EARTH · DSCOVR · captured …").
   * Distinct from `label`, which stays fuller for the error banner, and from `tile`, which
   * names the tile rather than the body — the two Moon tiles differ there and agree here.
   */
  body: string;
  /** Earth and Sun tiles show photographs; the Moon tiles show renders. */
  verb: "captured" | "rendered";
  /** The instrument credited in the full-screen status bar. */
  instrument: string;
  /**
   * The fraction of its own frame this source's disc spans **at its largest**.
   *
   * Every source ships a disc centred on black, but each leaves a different margin, and the
   * margin is not constant: apparent size changes as the geometry does. Measured from the
   * imagery — Moon 96.3% at perigee (from SVS's own `diameter` arcsec, anchored on a measured
   * full-moon frame), Sun 94.3% at perihelion, Earth 74.4-82.2% across DSCOVR's Lissajous orbit
   * around L1, which is much the widest swing of the three.
   *
   * Earth is pinned to exactly its largest sampled measurement rather than padded above it:
   * this value is also what every source gets rescaled against to reach a shared on-screen size
   * (see `target`), so slack here no longer just leaves a thin black ring — it stays visible as
   * Earth reading smaller than Sun and Moon on every day but its widest. Four sampled dates are
   * not the whole orbit, so a day beyond all of them could still slice the limb — accepted
   * deliberately, since DSCOVR's orbit repeats roughly every six months and is unlikely to
   * clear the sampled ceiling by much.
   */
  disc: number;
  /**
   * Every body renders at this same fraction of its tile, whichever source it is — and
   * whichever shape: square and circle share this number, so the object is the same on-screen
   * size in both, only the crop around it (inset square vs round) changes. Without a shared
   * target each source's own frame margin bleeds through at a different size — Earth's loose
   * DSCOVR crop noticeably smaller than the Moon's tight SVS one — which reads as inconsistency
   * rather than as the bodies' real relative sizes. A fixed target and a uniform margin instead
   * put every tile on equal footing, and staying under 1.0 everywhere leaves a safety margin
   * against `disc` being a sampled ceiling rather than a proven one (see its own comment).
   *
   * Sun gets its own, smaller target rather than sharing the rest's 0.90: Moon and Earth are
   * pinned to their largest measurement (see `disc`), so most days show them well under that —
   * genuinely smaller, not just cropped differently, since their distance really varies. The
   * Sun's distance barely does (~3% over a year, against the Moon's ~14%), so it renders at its
   * full target on nearly every frame, and matching Moon/Earth's on-screen size means giving it
   * a lower one of its own instead of counting on real-world variance to shrink it for free.
   */
  target: number;
  /**
   * Whether this source ships enabled when `gallery.<source>` says nothing. mymoon is the one
   * tile that costs nothing extra to answer (no observer-independent equivalent already on
   * screen the way moon/earth/sun's NASA photographs are optional extras), so it alone ships on.
   */
  onByDefault: boolean;
  /** Which debug row(s) this source's resolve() call reports into — see DebugRowId. */
  debugRow: { url: DebugRowId; img: DebugRowId };
  /**
   * Whether the tile shows the body in the observer's own sky rather than geocentric. The sky
   * tile rotates its frame by the parallactic angle, tints it by the local day/night, hides the
   * image entirely below the horizon, and always circle-crops (a rotated square crop would show
   * the source JPEG's own black canvas at every angle but the right ones).
   */
  skyFrame: boolean;
}

export const SOURCES: Record<ImageSource, SourceSpec> = {
  mymoon: {
    label: "NASA SVS Moon",
    tile: "MYMOON",
    body: "MOON",
    verb: "rendered",
    instrument: "NASA SVS",
    disc: 0.95,
    target: 0.89,
    onByDefault: true,
    debugRow: { url: "moon", img: "moon" },
    skyFrame: true,
  },
  moon: {
    label: "NASA SVS Moon",
    tile: "MOON",
    body: "MOON",
    verb: "rendered",
    instrument: "NASA SVS",
    disc: 0.95,
    target: 0.89,
    onByDefault: false,
    debugRow: { url: "moon", img: "moon" },
    skyFrame: false,
  },
  earth: {
    label: "DSCOVR Earth",
    tile: "EARTH",
    body: "EARTH",
    verb: "captured",
    instrument: "NASA DSCOVR",
    disc: 0.82,
    target: 0.87,
    onByDefault: false,
    debugRow: { url: "earth-url", img: "earth-img" },
    skyFrame: false,
  },
  sun: {
    label: "SDO HMI Continuum",
    tile: "SUN",
    body: "SUN",
    verb: "captured",
    instrument: "NASA SDO HMI",
    disc: 0.945,
    target: 0.8,
    onByDefault: false,
    debugRow: { url: "sun", img: "sun" },
    skyFrame: false,
  },
};
