// Shared by the SDO sun and SVS moon resolvers, both of which build archive URLs from
// zero-padded UTC calendar fields (sun's HHMMSS, moon's product-id path segments).
export function padLeft(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}
