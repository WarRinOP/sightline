import { z } from "zod";
import { EpochEtSchema, FractionSchema, LocationSchema } from "./common";
import { LanderProfileSchema } from "./profile";
import { ProvenanceRecordSchema } from "./provenance";

/** Guard against a request that would allocate millions of steps in a worker. */
export const MAX_TIMELINE_STEPS = 1_000_000;

export const StepStateKindSchema = z.enum(["both", "sun", "earth", "dark"]);
export type StepStateKind = z.infer<typeof StepStateKindSchema>;

/**
 * One time step. `lit` follows the profile (Sun elevation and disk-fraction limits); a link
 * exists when `dsn_visible`. `kind` is derived: both, sun only, earth only, or neither.
 */
export const StepStateSchema = z.object({
  epoch_et: EpochEtSchema,
  sun_disk_fraction: FractionSchema,
  lit: z.boolean(),
  earth_visible: z.boolean(),
  dsn_visible: z.boolean(),
  kind: StepStateKindSchema,
});
export type StepState = z.infer<typeof StepStateSchema>;

const stepRangeCheck = (r: { start_et: number; end_et: number; step_s: number }) =>
  r.end_et > r.start_et && (r.end_et - r.start_et) / r.step_s <= MAX_TIMELINE_STEPS;

export const TimelineRequestSchema = z
  .object({
    location: LocationSchema,
    profile: LanderProfileSchema,
    start_et: EpochEtSchema,
    end_et: EpochEtSchema,
    step_s: z.number().positive(),
  })
  .refine(stepRangeCheck, {
    message: `end_et must be after start_et, with at most ${MAX_TIMELINE_STEPS} steps`,
    path: ["end_et"],
  });
export type TimelineRequest = z.infer<typeof TimelineRequestSchema>;

export const TimelineStatisticsSchema = z.object({
  step_count: z.number().int().positive(),
  illuminated_ratio: FractionSchema,
  comms_ratio: FractionSchema,
  /** Fraction of steps with sunlight and a link at once (the "golden" steps). */
  both_ratio: FractionSchema,
  /** Longest run of unlit steps, in seconds (steps × step_s). */
  longest_night_s: z.number().nonnegative(),
  longest_night_start_et: EpochEtSchema.nullable(),
  /** Unlit runs longer than `profile.battery_capacity_s`. */
  nights_over_battery: z.number().int().nonnegative(),
});
export type TimelineStatistics = z.infer<typeof TimelineStatisticsSchema>;

export const TimelineResponseSchema = z
  .object({
    request: TimelineRequestSchema,
    steps: z.array(StepStateSchema).min(1),
    statistics: TimelineStatisticsSchema,
    simulated: z.boolean(),
    provenance: ProvenanceRecordSchema,
  })
  .refine((t) => t.statistics.step_count === t.steps.length, {
    message: "statistics.step_count must equal steps.length",
    path: ["statistics", "step_count"],
  })
  .refine((t) => t.simulated === t.provenance.simulated, {
    message: "simulated must match provenance.simulated",
    path: ["simulated"],
  });
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;

export const ProbeLitResultSchema = z.object({
  epoch_et: EpochEtSchema,
  lit: z.boolean(),
  sun_disk_fraction: FractionSchema,
  simulated: z.boolean(),
});
export type ProbeLitResult = z.infer<typeof ProbeLitResultSchema>;
