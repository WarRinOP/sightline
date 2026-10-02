import type { LanderProfile, StepState, TimelineStatistics } from "@sightline/contracts";

/** Does this step count as sunlit for `profile`? "Any sliver" when the minimum fraction is 0. */
export function isLit(
  profile: LanderProfile,
  sun_elevation_rad: number,
  disk_fraction: number,
): boolean {
  return (
    sun_elevation_rad >= profile.min_sun_elev_rad &&
    disk_fraction > 0 &&
    disk_fraction >= profile.min_sun_disk_fraction
  );
}

export function stepKind(lit: boolean, link: boolean): StepState["kind"] {
  if (lit && link) return "both";
  if (lit) return "sun";
  return link ? "earth" : "dark";
}

/**
 * Statistics over a series of steps spaced `step_s` apart. A night is a maximal run of unlit
 * steps and a day a maximal run of lit steps; each lasts steps × step_s. A run cut off by the
 * end of the range counts as far as the range goes.
 */
export function summarizeSteps(
  steps: readonly StepState[],
  step_s: number,
  battery_capacity_s: number,
): TimelineStatistics {
  let lit = 0;
  let comms = 0;
  let both = 0;
  let longest_night_s = 0;
  let longest_night_start_et: number | null = null;
  let longest_day_s = 0;
  let longest_day_start_et: number | null = null;
  let over_battery = 0;
  // The current run: lit or unlit, how many steps, and where it began.
  let run_is_lit: boolean | null = null;
  let run = 0;
  let run_start_et = 0;

  const closeRun = () => {
    if (run === 0) return;
    const run_s = run * step_s;
    if (run_is_lit) {
      if (run_s > longest_day_s) {
        longest_day_s = run_s;
        longest_day_start_et = run_start_et;
      }
    } else {
      if (run_s > longest_night_s) {
        longest_night_s = run_s;
        longest_night_start_et = run_start_et;
      }
      if (run_s > battery_capacity_s) over_battery += 1;
    }
    run = 0;
  };

  for (const s of steps) {
    if (s.lit) lit += 1;
    if (s.dsn_visible) comms += 1;
    if (s.lit && s.dsn_visible) both += 1;
    if (run > 0 && run_is_lit !== s.lit) closeRun();
    if (run === 0) {
      run_is_lit = s.lit;
      run_start_et = s.epoch_et;
    }
    run += 1;
  }
  closeRun();

  const n = steps.length;
  return {
    step_count: n,
    illuminated_ratio: lit / n,
    comms_ratio: comms / n,
    both_ratio: both / n,
    longest_night_s,
    longest_night_start_et,
    nights_over_battery: over_battery,
    longest_day_s,
    longest_day_start_et,
  };
}
