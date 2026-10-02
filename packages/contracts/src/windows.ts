import { z } from "zod";
import { EpochEtSchema, FractionSchema, LocationSchema } from "./common";
import { LanderProfileSchema } from "./profile";
import { ProvenanceRecordSchema } from "./provenance";
import { MAX_TIMELINE_STEPS } from "./timeline";

export const WindowRequestSchema = z
  .object({
    location: LocationSchema,
    profile: LanderProfileSchema,
    start_et: EpochEtSchema,
    end_et: EpochEtSchema,
    step_s: z.number().positive(),
    /** Shortest window worth reporting. */
    min_duration_s: z.number().nonnegative(),
    max_results: z.number().int().positive().max(1000),
  })
  .refine(
    (r) => r.end_et > r.start_et && (r.end_et - r.start_et) / r.step_s <= MAX_TIMELINE_STEPS,
    {
      message: `end_et must be after start_et, with at most ${MAX_TIMELINE_STEPS} steps`,
      path: ["end_et"],
    },
  );
export type WindowRequest = z.infer<typeof WindowRequestSchema>;

/** A ranked landing window. `score` is only comparable within one response. */
export const WindowResultSchema = z
  .object({
    start_et: EpochEtSchema,
    end_et: EpochEtSchema,
    duration_s: z.number().nonnegative(),
    score: z.number().finite(),
    illuminated_ratio: FractionSchema,
    comms_ratio: FractionSchema,
  })
  .refine((w) => w.end_et > w.start_et, {
    message: "end_et must be after start_et",
    path: ["end_et"],
  });
export type WindowResult = z.infer<typeof WindowResultSchema>;

export const WindowSearchResponseSchema = z
  .object({
    request: WindowRequestSchema,
    windows: z.array(WindowResultSchema),
    simulated: z.boolean(),
    provenance: ProvenanceRecordSchema,
  })
  .refine((r) => r.simulated === r.provenance.simulated, {
    message: "simulated must match provenance.simulated",
    path: ["simulated"],
  });
export type WindowSearchResponse = z.infer<typeof WindowSearchResponseSchema>;
