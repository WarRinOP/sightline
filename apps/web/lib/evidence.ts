import type { HorizonsResiduals } from "@sightline/contracts";

/** Pure functions that turn the committed validation files into table rows for the Evidence page. */

const ARCSEC_PER_DEG = 3600;

export interface DirectionRow {
  body: "Sun" | "Earth";
  max_deg: number;
  mean_deg: number;
  rms_deg: number;
  /** max separation in milliarcseconds, or arcseconds when it exceeds 1000 mas (see `angle`). */
  max_text: string;
  /** How many times the largest gap fits inside the acceptance limit. */
  margin: number;
}

/** An angle in degrees as the unit a reader can picture: milliarcseconds, arcseconds or degrees. */
export function angleText(deg: number): string {
  const arcsec = deg * ARCSEC_PER_DEG;
  if (arcsec < 1) return `${(arcsec * 1000).toPrecision(3)} milliarcsec`;
  if (deg < 0.01) return `${arcsec.toPrecision(3)} arcsec`;
  return `${deg.toPrecision(3)}°`;
}

export function sciText(value: number): string {
  return value.toExponential(2).replace("e-", "e−").replace("e+", "e");
}

export function directionRows(r: HorizonsResiduals): DirectionRow[] {
  const row = (body: "Sun" | "Earth", s: HorizonsResiduals["summary"]["sun"]): DirectionRow => {
    const sep = s.separation_deg;
    return {
      body,
      max_deg: sep.max_abs,
      mean_deg: sep.mean,
      rms_deg: sep.rms,
      max_text: angleText(sep.max_abs),
      margin: r.tolerance_deg / sep.max_abs,
    };
  };
  return [row("Sun", r.summary.sun), row("Earth", r.summary.earth)];
}

/** The seven Barker et al. (2021) regions, ours against the paper's 1st-percentile and best-pixel values. */
export interface BarkerRow {
  roi: number;
  ours_1m: number;
  paper_a_1m: number;
  paper_c_1m: number;
  ours_5m: number;
  paper_a_5m: number;
  paper_c_5m: number;
}

export interface IlluminationBenchmark {
  barker_table2: {
    start_utc: string;
    end_utc: string;
    rows: Record<string, number>[];
    criteria: {
      A1_floor: boolean;
      A2_ceiling: boolean;
      A3_median_at_1m_pct: number;
      passes: boolean;
    };
  };
  avgvisib: {
    all_tiles: { points: number; spearman_2m: number; spearman_0m: number };
    tiles: Record<string, { points: number; spearman_2m: number }>;
    criteria: { rho_all_at_least: number; rho_each_tile_at_least: number; passes: boolean };
  };
}

const need = (row: Record<string, number>, key: string): number => {
  const v = row[key];
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error(`benchmark row is missing ${key}`);
  return v;
};

export function barkerRows(b: IlluminationBenchmark): BarkerRow[] {
  return b.barker_table2.rows.map((r) => ({
    roi: need(r, "roi"),
    ours_1m: need(r, "ours_dz1_pct"),
    paper_a_1m: need(r, "paper_dz1_A"),
    paper_c_1m: need(r, "paper_dz1_C"),
    ours_5m: need(r, "ours_dz5_pct"),
    paper_a_5m: need(r, "paper_dz5_A"),
    paper_c_5m: need(r, "paper_dz5_C"),
  }));
}
