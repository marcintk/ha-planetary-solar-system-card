import type { CardConfig, Colors, ZoomLevel } from "../types.js";
import type { GallerySource } from "./card-template.js";
import { GALLERY_SOURCES } from "./card-template.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM } from "./card-view-state.js";
import type { GalleryMode } from "./gallery/gallery-controller.js";
import {
  DEFAULT_GALLERY_INTERVAL_MS,
  DEFAULT_GALLERY_SOURCES,
  GALLERY_MODES,
} from "./gallery/gallery-controller.js";

export interface ParsedCardConfig {
  zoomLevel: ZoomLevel;
  refreshMs: number;
  periodicZoomChange: boolean;
  periodicZoomMax: number;
  zoomAnimate: boolean;
  colors: Colors;
  theme: "auto" | "dark" | "light";
  eclipticView: boolean;
  locationOverride: { lat: number; lon: number; timezone: string } | null;
  locationNameOverride: string | null;
  heightStyle: string;
  galleryMode: GalleryMode;
  gallerySources: GallerySource[];
  galleryIntervalMs: number;
}

// Resolves config.height into an inline style for #solar-view/.image-view. A px value caps
// the height and lets the square SVG/image letterbox-shrink to fit (preserveAspectRatio
// "meet" — nothing crops). A percent reshapes the aspect-ratio itself (e.g. "50%" = half as
// tall as wide) since CSS max-height can't resolve against an auto-height parent.
function resolveHeightStyle(height: CardConfig["height"]): string {
  if (typeof height === "number") {
    return height > 0 ? `max-height: ${height}px` : "";
  }
  if (typeof height === "string") {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(height);
    if (px) return `max-height: ${px[1]}px`;
    const pct = /^(\d+(?:\.\d+)?)%$/.exec(height);
    if (pct) {
      const n = Number(pct[1]);
      return n > 0 ? `aspect-ratio: ${100 / n}` : "";
    }
  }
  return "";
}

// An overridden location must not keep reading clocks in HA's timezone, but no IANA timezone
// database ships in the bundle. Etc/GMT±N zones are built into every browser's Intl data, so a
// fixed UTC offset from longitude (15° per hour) needs zero deps. No DST, and wrong near zone
// borders — acceptable: the card shows sky state, not appointment times.
// The sign is POSIX-inverted: Etc/GMT+6 means UTC-6.
function offsetZoneFromLongitude(lon: number): string {
  const offset = Math.round(lon / 15);
  return `Etc/GMT${offset <= 0 ? "+" : "-"}${Math.abs(offset)}`;
}

// An explicit IANA zone beats the longitude estimate outright — it carries DST and the full
// historical rule set, which matters because the card navigates by month and year. No zone
// database is needed to check one: Intl already ships the whole thing and throws RangeError on
// anything it doesn't know, so a typo degrades to the estimate instead of breaking the card.
function resolveOverrideTimezone(timezone: string | undefined, lon: number): string {
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return timezone;
    } catch {
      // Unknown zone — fall through to the longitude estimate.
    }
  }
  return offsetZoneFromLongitude(lon);
}

// Pure validate/default pass over CardConfig — the single place each field's fallback and
// range-check rule lives. card.ts's setConfig hands the result straight to _zoom.configure()/
// _gallery.configure() and its own remaining fields, instead of parsing inline.
// Pre-#140 `gallery.mode` was a single string conflating presentation ("is the strip open")
// with source selection ("which thumbnails"), which needed one union member per combination.
// Each legacy value maps to the equivalent {mode, sources} pair so existing dashboards keep
// showing exactly what they showed before — without this they'd fail the GALLERY_MODES check
// and silently drop to the default, which now also means gaining a moon thumbnail they never
// asked for.
const LEGACY_GALLERY_MODES: Record<string, { mode: GalleryMode; sources: GallerySource[] }> = {
  none: { mode: "closed", sources: ["moon"] },
  earth: { mode: "open", sources: ["earth"] },
  sun: { mode: "open", sources: ["sun"] },
  both: { mode: "open", sources: ["earth", "sun"] },
  slide: { mode: "slide", sources: ["earth", "sun"] },
};

// Unknown names are dropped rather than rejecting the whole list, and duplicates collapse to
// their first position — a typo costs the user that one thumbnail, not their entire gallery.
// Order is preserved because it *is* the layout: sources[0] renders leftmost.
function resolveSources(raw: unknown): GallerySource[] | null {
  if (!Array.isArray(raw)) return null;
  const kept = [...new Set(raw)].filter((s): s is GallerySource =>
    GALLERY_SOURCES.includes(s as GallerySource)
  );
  return kept.length ? kept : null;
}

function resolveGallery(gallery: CardConfig["gallery"]): {
  mode: GalleryMode;
  sources: GallerySource[];
} {
  const legacy = LEGACY_GALLERY_MODES[gallery?.mode as string];
  const mode = GALLERY_MODES.includes(gallery?.mode as GalleryMode)
    ? (gallery?.mode as GalleryMode)
    : (legacy?.mode ?? "closed");
  // An explicit list always wins: a user who wrote `sources` means it, even alongside a
  // legacy mode string they haven't migrated yet.
  const sources = resolveSources(gallery?.sources) ?? legacy?.sources ?? DEFAULT_GALLERY_SOURCES;
  return { mode, sources };
}

export function parseCardConfig(config: CardConfig): ParsedCardConfig {
  const zoomLevel =
    config.default_zoom == null || config.default_zoom < MIN_ZOOM || config.default_zoom > MAX_ZOOM
      ? DEFAULT_ZOOM_LEVEL
      : (config.default_zoom as ZoomLevel);

  const rawRefresh = Number(config.refresh_mins);
  const refreshMs = Number.isFinite(rawRefresh) && rawRefresh >= 0.1 ? rawRefresh * 60000 : 60000;

  const periodicZoomChange = config.periodic_zoom_change === true;
  const rawMax = Number(config.periodic_zoom_max);
  const periodicZoomMax =
    Number.isInteger(rawMax) && rawMax >= 2 && rawMax <= MAX_ZOOM ? rawMax : MAX_ZOOM;
  const zoomAnimate = config.zoom_animate !== false;

  const theme = config.theme === "dark" || config.theme === "light" ? config.theme : "auto";
  const eclipticView = config.ecliptic_view === "south";

  const overrideLat = config.location?.latitude;
  const overrideLon = config.location?.longitude;
  const hasOverride =
    typeof overrideLat === "number" &&
    typeof overrideLon === "number" &&
    overrideLat >= -90 &&
    overrideLat <= 90 &&
    overrideLon >= -180 &&
    overrideLon <= 180;
  const locationOverride = hasOverride
    ? {
        lat: overrideLat,
        lon: overrideLon,
        timezone: resolveOverrideTimezone(config.location?.timezone, overrideLon),
      }
    : null;
  const locationNameOverride = config.location?.name || null;

  const heightStyle = resolveHeightStyle(config.height);

  const { mode: galleryMode, sources: gallerySources } = resolveGallery(config.gallery);
  const rawInterval = Number(config.gallery?.slide_interval_secs);
  const galleryIntervalMs =
    Number.isFinite(rawInterval) && rawInterval >= 0.1
      ? rawInterval * 1000
      : DEFAULT_GALLERY_INTERVAL_MS;

  return {
    zoomLevel,
    refreshMs,
    periodicZoomChange,
    periodicZoomMax,
    zoomAnimate,
    colors: config.colors ?? {},
    theme,
    eclipticView,
    locationOverride,
    locationNameOverride,
    heightStyle,
    galleryMode,
    gallerySources,
    galleryIntervalMs,
  };
}
