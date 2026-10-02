// Regenerates fixtures/golden/horizons_residuals.json from the engine and the Horizons reference
// (written by `sightline horizons`). The test does the work; this only sets the switch, so it
// works the same on every platform.
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm", ["exec", "vitest", "run", "test/horizons.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, WRITE_HORIZONS_RESIDUALS: "1" },
});
process.exit(run.status ?? 1);
