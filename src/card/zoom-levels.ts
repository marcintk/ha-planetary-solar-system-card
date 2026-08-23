import type { ZoomLevel } from "../types.js";

/**
 * The discrete zoom ladder, and the viewBox width each rung shows.
 *
 * A leaf module on purpose: card-config.ts range-checks `default_zoom` against these before
 * ZoomController ever exists, and ZoomController animates between them. Neither should have to
 * import the other to agree on what a zoom level is.
 */
export const DEFAULT_ZOOM_LEVEL: ZoomLevel = 1;
export const MIN_ZOOM: ZoomLevel = 1;
export const MAX_ZOOM: ZoomLevel = 4;

export const ZOOM_LEVELS: Record<ZoomLevel, number> = { 1: 800, 2: 640, 3: 480, 4: 320 };
