import { z } from "zod";

/** LOLA reference sphere (CLAUDE.md §9). DEM heights are relative to it. */
export const MOON_REFERENCE_RADIUS_M = 1_737_400;

/** Apparent Sun/Earth/DSN state is always in this frame, never MOON_PA or IAU_MOON (D-008). */
export const MOON_BODY_FIXED_FRAME = "MOON_ME";

/** TDB seconds past J2000 (float64). UTC strings exist only at the UI boundary. */
export const EpochEtSchema = z.number().finite();

/** Azimuth is clockwise from local north, in [0, 2π). */
export const AzimuthRadSchema = z
  .number()
  .min(0)
  .lt(2 * Math.PI);

export const ElevationRadSchema = z
  .number()
  .min(-Math.PI / 2)
  .max(Math.PI / 2);

/** Fraction in [0, 1]. Percentages appear only in the UI. */
export const FractionSchema = z.number().min(0).max(1);

/**
 * A point on the Moon in the body-fixed frame. East-positive longitude.
 * Engine calls take radians; the site catalog stores degrees (see `Site`).
 */
export const LocationSchema = z.object({
  lat_rad: ElevationRadSchema,
  lon_rad: z.number().min(-Math.PI).max(Math.PI),
  /**
   * Height of the ground above the 1737.4 km reference sphere, in meters; 0 when omitted. It
   * matters: 2 km of height moves the Earth direction by about 3e-4° through parallax.
   */
  elev_m: z.number().finite().optional(),
});
export type Location = z.infer<typeof LocationSchema>;
