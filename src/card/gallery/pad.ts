// Shared by the SDO sun and SVS moon resolvers, both of which build archive URLs from
// zero-padded UTC calendar fields (sun's HHMMSS, moon's product-id path segments).
export function padLeft(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

// Shared by slot-search.ts's bisection, the sun resolver's own slot guess, and the moon
// resolver's hourly frame lookup — all three need "which grid line does this instant fall on",
// just with a different grid spacing each.
export function floorToGrid(ms: number, gridMs: number): number {
  return Math.floor(ms / gridMs) * gridMs;
}
