import { z } from "zod";
import type { Location } from "./common";

export const SiteIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase slug");
export type SiteId = z.infer<typeof SiteIdSchema>;

/**
 * A catalog site. Degrees and meters here are catalog data; the engine takes radians.
 * Mission facts need a `source_url` (CLAUDE.md §7.10): only simulated sites may omit it.
 */
export const SiteSchema = z
  .object({
    id: SiteIdSchema,
    name: z.string().min(1),
    lat_deg: z.number().min(-90).max(90),
    /** East-positive, [-180, 180]. */
    lon_deg: z.number().min(-180).max(180),
    /** Height above the 1737.4 km reference sphere. */
    elev_m: z.number().finite(),
    description: z.string().min(1),
    simulated: z.boolean(),
    source_url: z.url().nullable(),
  })
  .refine((s) => s.simulated || s.source_url !== null, {
    message: "a non-simulated site needs a source_url",
    path: ["source_url"],
  });
export type Site = z.infer<typeof SiteSchema>;

/** Catalog degrees to the radians the engine takes; the height rides along when given. */
export function siteLocation(
  site: Pick<Site, "lat_deg" | "lon_deg"> & { elev_m?: number },
): Location {
  return {
    lat_rad: (site.lat_deg * Math.PI) / 180,
    lon_rad: (site.lon_deg * Math.PI) / 180,
    ...(site.elev_m === undefined ? {} : { elev_m: site.elev_m }),
  };
}
