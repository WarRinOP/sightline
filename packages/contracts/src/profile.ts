import { z } from "zod";
import { ElevationRadSchema, FractionSchema } from "./common";

/** What the lander needs. Names carry their units (CLAUDE.md §6). */
export const LanderProfileSchema = z.object({
  /** Observer height above the local surface. The mast slider is 0 to 20 m. */
  mast_height_m: z.number().min(0).max(20),
  /** Scales power estimates only; it never changes the lit/dark classification. */
  solar_efficiency: FractionSchema,
  /** Seconds the lander survives without sunlight. A longer night is a constraint violation. */
  battery_capacity_s: z.number().nonnegative(),
  /** The Sun centre must be at least this high above the local horizontal plane to count as lit. */
  min_sun_elev_rad: ElevationRadSchema,
  /** Minimum solar-disk fraction above the terrain horizon to count as lit (0 = any sliver). */
  min_sun_disk_fraction: FractionSchema,
  /** Minimum Earth elevation above the terrain horizon for a direct-to-Earth link. */
  min_earth_elev_rad: ElevationRadSchema,
  /** Elevation mask at the DSN station, a separate limit from the lunar horizon. */
  dsn_min_elev_rad: ElevationRadSchema,
});
export type LanderProfile = z.infer<typeof LanderProfileSchema>;

/** UI starting values (wireframe: 2 m mast, 50 h battery), not science results. */
export const DEFAULT_LANDER_PROFILE: LanderProfile = {
  mast_height_m: 2,
  solar_efficiency: 0.3,
  battery_capacity_s: 50 * 3600,
  min_sun_elev_rad: 0,
  min_sun_disk_fraction: 0,
  min_earth_elev_rad: 0,
  dsn_min_elev_rad: 0,
};
