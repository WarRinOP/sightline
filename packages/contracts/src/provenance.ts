import { z } from "zod";

/**
 * Where a number came from. Every engine response and tile manifest carries one, so the UI can
 * show the SIMULATED badge from data instead of remembering to (CLAUDE.md §7.9).
 */
export const ProvenanceRecordSchema = z
  .object({
    /** "SYNTHETIC_MOCK_ENGINE" for mock output; "SIGHTLINE_PIPELINE" for real data. */
    source: z.string().min(1),
    simulated: z.boolean(),
    /** Dataset ids from `pipeline/sources.yaml` (never URLs). */
    data_sources: z.array(z.string().min(1)),
    /** Exact SPICE kernel file names, for example `de440s.bsp`. */
    spice_kernels: z.array(z.string().min(1)),
    /** Citation string for the DEM product, from docs/science/CITATIONS.md. */
    dem_citation: z.string().min(1).nullable(),
    pipeline_version: z.string().min(1).nullable(),
    data_version: z.string().min(1).nullable(),
  })
  .refine((p) => !p.source.startsWith("SYNTHETIC") || p.simulated, {
    message: "a SYNTHETIC source must set simulated: true",
    path: ["simulated"],
  })
  .refine((p) => p.simulated || (p.data_sources.length > 0 && p.pipeline_version !== null), {
    message: "real (non-simulated) data must cite its data sources and pipeline version",
    path: ["data_sources"],
  });
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;
