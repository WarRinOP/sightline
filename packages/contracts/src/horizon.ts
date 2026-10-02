import { z } from "zod";
import { ElevationRadSchema, LocationSchema } from "./common";
import { ProvenanceRecordSchema } from "./provenance";

/** 0.25° azimuth step, as in MASTER_PLAN (Float32[1440] per site and mast height). */
export const HORIZON_AZIMUTH_SAMPLES = 1440;

/**
 * Terrain elevation angle per azimuth. Index i is azimuth i * azimuth_step_rad, clockwise from
 * local north, so index 0 is north.
 */
export const HorizonMaskSchema = z
  .object({
    location: LocationSchema,
    mast_height_m: z.number().min(0).max(20),
    azimuth_step_rad: z.number().positive(),
    mask_elevation_rad: z.array(ElevationRadSchema).min(1),
    simulated: z.boolean(),
    provenance: ProvenanceRecordSchema,
  })
  .refine((h) => h.mask_elevation_rad.length === Math.round((2 * Math.PI) / h.azimuth_step_rad), {
    message: "mask_elevation_rad must cover the full circle: length = round(2π / azimuth_step_rad)",
    path: ["mask_elevation_rad"],
  })
  .refine((h) => h.simulated === h.provenance.simulated, {
    message: "simulated must match provenance.simulated",
    path: ["simulated"],
  });
export type HorizonMask = z.infer<typeof HorizonMaskSchema>;
