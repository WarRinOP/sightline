import type { StepState } from "@sightline/contracts";

/** Per pixel column: the share of the steps under it that are lit, have a link, or have both. */
export interface BarcodeColumns {
  sun: Float32Array;
  link: Float32Array;
  both: Float32Array;
}

/**
 * Reduces a timeline to `width` columns for the mission barcode. Column c covers steps
 * [floor(c n / width), floor((c + 1) n / width)), at least one step, so no step is skipped and a
 * timeline shorter than the width repeats its steps. "Lit" is the lander profile's (the timeline's
 * `lit`), "link" is `dsn_visible`, "both" is both at once.
 */
export function barcodeColumns(steps: readonly StepState[], width: number): BarcodeColumns {
  const n = steps.length;
  const sun = new Float32Array(width);
  const link = new Float32Array(width);
  const both = new Float32Array(width);
  if (n === 0 || width <= 0) return { sun, link, both };
  for (let c = 0; c < width; c++) {
    const from = Math.min(n - 1, Math.floor((c * n) / width));
    const to = Math.max(from + 1, Math.floor(((c + 1) * n) / width));
    let lit = 0;
    let dsn = 0;
    let both_n = 0;
    for (let i = from; i < to; i++) {
      const s = steps[i];
      if (!s) continue;
      if (s.lit) lit++;
      if (s.dsn_visible) dsn++;
      if (s.lit && s.dsn_visible) both_n++;
    }
    const count = to - from;
    sun[c] = lit / count;
    link[c] = dsn / count;
    both[c] = both_n / count;
  }
  return { sun, link, both };
}

/** The step epoch nearest a horizontal position `ratio` (0 to 1) along the timeline. */
export function epochAtRatio(
  start_et: number,
  end_et: number,
  step_s: number,
  ratio: number,
): number {
  const r = Math.min(1, Math.max(0, ratio));
  const raw = start_et + r * (end_et - start_et);
  return start_et + Math.round((raw - start_et) / step_s) * step_s;
}
