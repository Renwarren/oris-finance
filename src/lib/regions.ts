/**
 * Cameroon administrative region per agency city — public geographic fact, not editorial
 * content, so it's safe to hardcode here rather than add a `region` field to the WP4 agencies
 * schema (which only models what the source pages actually state). Used by the /agences/
 * filter (BUILD-PLAN.md §8, WP5).
 */
export const CITY_REGIONS: Record<string, string> = {
  Douala: "Littoral",
  Yaoundé: "Centre",
  Bafoussam: "Ouest",
  Balessing: "Ouest",
};

export function getRegion(city: string): string {
  return CITY_REGIONS[city] ?? city;
}
