import { z } from "zod";
import {
  AzimuthRadSchema,
  ElevationRadSchema,
  EpochEtSchema,
  FractionSchema,
  MOON_BODY_FIXED_FRAME,
} from "./common";
import { ProvenanceRecordSchema } from "./provenance";

export const EphemerisBodySchema = z.enum([
  "SUN",
  "EARTH",
  "DSN_GOLDSTONE",
  "DSN_CANBERRA",
  "DSN_MADRID",
]);
export type EphemerisBody = z.infer<typeof EphemerisBodySchema>;

/** Header of the binary ephemeris file produced by `sightline ephem` (M1-05). */
export const EphemerisHeaderSchema = z
  .object({
    schema_version: z.literal(1),
    frame: z.literal(MOON_BODY_FIXED_FRAME),
    /** Apparent positions use light-time plus stellar aberration (CLAUDE.md §6). */
    aberration_correction: z.literal("LT+S"),
    start_et: EpochEtSchema,
    end_et: EpochEtSchema,
    step_s: z.number().positive(),
    record_count: z.number().int().positive(),
    bodies: z.array(EphemerisBodySchema).min(1),
    spice_kernels: z.array(z.string().min(1)),
    simulated: z.boolean(),
    provenance: ProvenanceRecordSchema,
  })
  .refine((h) => h.end_et > h.start_et, {
    message: "end_et must be after start_et",
    path: ["end_et"],
  })
  .refine((h) => h.record_count === Math.floor((h.end_et - h.start_et) / h.step_s) + 1, {
    message: "record_count must equal floor((end_et - start_et) / step_s) + 1",
    path: ["record_count"],
  })
  .refine((h) => h.simulated === h.provenance.simulated, {
    message: "simulated must match provenance.simulated",
    path: ["simulated"],
  });
export type EphemerisHeader = z.infer<typeof EphemerisHeaderSchema>;

/** Sun and Earth as seen from one site at one instant, against that site's terrain horizon. */
export const SunEarthStateSchema = z
  .object({
    epoch_et: EpochEtSchema,
    sun_azimuth_rad: AzimuthRadSchema,
    sun_elevation_rad: ElevationRadSchema,
    /** Fraction of the solar disk above the terrain horizon, in [0, 1]. */
    sun_disk_fraction: FractionSchema,
    earth_azimuth_rad: AzimuthRadSchema,
    earth_elevation_rad: ElevationRadSchema,
    /** Earth centre above the terrain horizon. */
    earth_visible: z.boolean(),
    /** At least one DSN complex sees Earth (implies `earth_visible`). */
    dsn_visible: z.boolean(),
    simulated: z.boolean(),
  })
  .refine((s) => !s.dsn_visible || s.earth_visible, {
    message: "dsn_visible requires earth_visible",
    path: ["dsn_visible"],
  });
export type SunEarthState = z.infer<typeof SunEarthStateSchema>;
