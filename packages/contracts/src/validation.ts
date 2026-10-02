import { z } from "zod";
import { ProvenanceRecordSchema } from "./provenance";

/** Size of the engine-minus-reference gap over many cases. All values in degrees. */
export const ResidualStatSchema = z.object({
  max_abs: z.number().nonnegative(),
  /** Signed mean, engine minus reference, so a bias shows. For separations it is the plain mean. */
  mean: z.number(),
  rms: z.number().nonnegative(),
});
export type ResidualStat = z.infer<typeof ResidualStatSchema>;

export const BodyResidualsSchema = z.object({
  /** Azimuth gap times cos(elevation): the angle on the sky, not on the azimuth circle. */
  az_on_sky_deg: ResidualStatSchema,
  el_deg: ResidualStatSchema,
  /** Great-circle angle between the engine's direction and the reference direction. */
  separation_deg: ResidualStatSchema,
});
export type BodyResiduals = z.infer<typeof BodyResidualsSchema>;

export const ValidationBodySchema = z.enum(["sun", "earth"]);

const DirectionSchema = z.object({ az_deg: z.number(), el_deg: z.number() });

export const ResidualCaseSchema = z.object({
  site_id: z.string().min(1),
  utc: z.string().min(1),
  body: ValidationBodySchema,
  horizons: DirectionSchema,
  engine: DirectionSchema,
  residual: z.object({
    az_on_sky_deg: z.number(),
    el_deg: z.number(),
    separation_deg: z.number().nonnegative(),
  }),
});
export type ResidualCase = z.infer<typeof ResidualCaseSchema>;

/**
 * `fixtures/golden/horizons_residuals.json`: the engine's Sun and Earth directions against JPL
 * Horizons at three sites and 50 epochs, for the Evidence page's validation table.
 */
export const HorizonsResidualsSchema = z
  .object({
    schema_version: z.literal(1),
    generated_by: z.string().min(1),
    reference: z.object({
      file: z.string().min(1),
      api_version: z.string().min(1),
      targets: z.record(z.string(), z.string()),
      epoch_count: z.number().int().positive(),
      site_ids: z.array(z.string().min(1)).min(1),
      /** What Horizons and the engine were each asked, so a reader can judge the comparison. */
      notes: z.array(z.string()),
    }),
    engine: z.object({ provenance: ProvenanceRecordSchema, mast_height_m: z.number() }),
    /** Acceptance limit on every case, fixed before the first residual was seen. */
    tolerance_deg: z.number().positive(),
    passes: z.boolean(),
    summary: z.object({
      sun: BodyResidualsSchema,
      earth: BodyResidualsSchema,
      overall_separation_deg: ResidualStatSchema,
    }),
    by_site: z.record(
      z.string(),
      z.object({ sun: BodyResidualsSchema, earth: BodyResidualsSchema }),
    ),
    /** Horizons against SPICE (the pipeline's route), from the same cases. */
    horizons_vs_spice_separation_deg: z.record(
      z.string(),
      z.object({ max: z.number().nonnegative(), mean: z.number(), rms: z.number().nonnegative() }),
    ),
    cases: z.array(ResidualCaseSchema).min(1),
  })
  .refine((r) => r.passes === r.cases.every((c) => c.residual.separation_deg <= r.tolerance_deg), {
    message: "passes must agree with the cases and the tolerance",
    path: ["passes"],
  });
export type HorizonsResiduals = z.infer<typeof HorizonsResidualsSchema>;
