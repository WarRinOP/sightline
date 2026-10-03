import { HorizonsResidualsSchema } from "@sightline/contracts";
import benchmarkJson from "../../../fixtures/golden/illumination_benchmark.json";
import residualsJson from "../../../fixtures/golden/horizons_residuals.json";
import type { IlluminationBenchmark } from "./evidence";

/** The committed validation files, read at build time (they are written by commands, never by hand). */
export const HORIZONS_RESIDUALS = HorizonsResidualsSchema.parse(residualsJson);
export const ILLUMINATION_BENCHMARK = benchmarkJson as unknown as IlluminationBenchmark;
