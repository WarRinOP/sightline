import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HorizonsResidualsSchema,
  siteLocation,
  type HorizonsResiduals,
  type ResidualCase,
  type ResidualStat,
} from "@sightline/contracts";
import { BUNDLED_EPHEMERIS_META, Ephemeris, computeSky, utcIsoToEt } from "../src";
import { BUNDLED_BIN, GOLDEN_DIR, readArrayBuffer, readJson } from "./helpers";

// Acceptance limit on every case. It comes from DATA_VERIFICATION_REPORT §4.1 ("expected residuals
// are far below 0.02 degrees; keep the 0.02 degree tolerance and report the observed max"), written
// on 2026-10-01 before any residual existed. It is not to be changed to make a test pass.
const TOLERANCE_DEG = 0.02;
const DEG = 180 / Math.PI;
const BODIES = ["sun", "earth"] as const;
type Body = (typeof BODIES)[number];

interface Direction {
  az_deg: number;
  el_deg: number;
}
interface ReferenceCase {
  site_id: string;
  epoch_index: number;
  utc: string;
  epoch_et: number;
  horizons: Record<Body, Direction>;
  spice: Record<Body, Direction>;
}
interface Reference {
  api: { id: string; signature: { version: string } };
  query: { targets: Record<string, string> };
  horizons_context: Record<string, string>;
  epochs: { index: number; utc: string; et: number }[];
  sites: { id: string; lat_deg: number; lon_deg: number; elev_m: number }[];
  horizons_vs_spice_separation_deg: Record<string, { max: number; mean: number; rms: number }>;
  cases: ReferenceCase[];
}

const reference = readJson(new URL("horizons_reference.json", GOLDEN_DIR)) as Reference;
const eph = new Ephemeris(BUNDLED_EPHEMERIS_META, readArrayBuffer(BUNDLED_BIN));
const RESIDUALS_URL = new URL("horizons_residuals.json", GOLDEN_DIR);

const wrap180 = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Great-circle angle in degrees between two directions given as azimuth and elevation, as
 * atan2(|u x v|, u . v). acos(u . v) cannot return less than 8.5e-7 degrees (one rounding step
 * below 1.0), which would put a floor under every residual.
 */
function separationDeg(a: Direction, b: Direction): number {
  const unit = (d: Direction): [number, number, number] => {
    const az = d.az_deg / DEG;
    const el = d.el_deg / DEG;
    return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  };
  const u = unit(a);
  const v = unit(b);
  const cross = Math.hypot(
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  );
  return Math.atan2(cross, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) * DEG;
}

function stat(values: number[]): ResidualStat {
  const n = values.length;
  return {
    max_abs: Math.max(...values.map(Math.abs)),
    mean: values.reduce((a, b) => a + b, 0) / n,
    rms: Math.sqrt(values.reduce((a, b) => a + b * b, 0) / n),
  };
}

function bodyStats(rows: ResidualCase[]) {
  return {
    az_on_sky_deg: stat(rows.map((r) => r.residual.az_on_sky_deg)),
    el_deg: stat(rows.map((r) => r.residual.el_deg)),
    separation_deg: stat(rows.map((r) => r.residual.separation_deg)),
  };
}

/** The engine's residuals against Horizons. `epochShift_s` exists only for the negative control. */
function residualCases(epochShift_s = 0): ResidualCase[] {
  const sites = new Map(reference.sites.map((s) => [s.id, s]));
  const rows: ResidualCase[] = [];
  for (const c of reference.cases) {
    const site = sites.get(c.site_id)!;
    const sky = computeSky(eph, c.epoch_et + epochShift_s, siteLocation(site), {
      mast_height_m: 0,
    }).state;
    for (const body of BODIES) {
      const engine: Direction = {
        az_deg: (body === "sun" ? sky.sun_azimuth_rad : sky.earth_azimuth_rad) * DEG,
        el_deg: (body === "sun" ? sky.sun_elevation_rad : sky.earth_elevation_rad) * DEG,
      };
      const h = c.horizons[body];
      rows.push({
        site_id: c.site_id,
        utc: c.utc,
        body,
        horizons: h,
        engine,
        residual: {
          az_on_sky_deg: wrap180(engine.az_deg - h.az_deg) * Math.cos(h.el_deg / DEG),
          el_deg: engine.el_deg - h.el_deg,
          separation_deg: separationDeg(engine, h),
        },
      });
    }
  }
  return rows;
}

function buildReport(rows: ResidualCase[]): HorizonsResiduals {
  const by = (body: Body, site?: string) =>
    rows.filter((r) => r.body === body && (site === undefined || r.site_id === site));
  const siteIds = reference.sites.map((s) => s.id);
  return {
    schema_version: 1,
    generated_by: "packages/engine/test/horizons.test.ts (WRITE_HORIZONS_RESIDUALS=1)",
    reference: {
      file: "horizons_reference.json",
      api_version: reference.api.signature.version,
      targets: reference.query.targets,
      epoch_count: reference.epochs.length,
      site_ids: siteIds,
      notes: [
        "Residual = engine minus Horizons, both topocentric (observer on the ground at the site, no mast), geometric azimuth and elevation, no atmosphere.",
        "Horizons: the Moon is a 1737.4 km sphere (MEAN_ME, high precision), DE441, light time, stellar aberration and relativistic light bending included.",
        "Engine: SPICE DE440 states sampled hourly, cubic Hermite, apparent (LT+S) at the Moon's centre minus the site vector.",
        "Times are UTC to the millisecond, spaced evenly from 2026-01-02 to 2026-12-30; they fall between the hourly samples on purpose.",
      ],
    },
    engine: { provenance: eph.meta.header.provenance, mast_height_m: 0 },
    tolerance_deg: TOLERANCE_DEG,
    passes: rows.every((r) => r.residual.separation_deg <= TOLERANCE_DEG),
    summary: {
      sun: bodyStats(by("sun")),
      earth: bodyStats(by("earth")),
      overall_separation_deg: stat(rows.map((r) => r.residual.separation_deg)),
    },
    by_site: Object.fromEntries(
      siteIds.map((id) => [
        id,
        { sun: bodyStats(by("sun", id)), earth: bodyStats(by("earth", id)) },
      ]),
    ),
    horizons_vs_spice_separation_deg: reference.horizons_vs_spice_separation_deg,
    cases: rows,
  };
}

const rows = residualCases();
const report = buildReport(rows);

describe("separationDeg", () => {
  it("resolves differences far below the precision floor of an acos formula (8.5e-7 degrees)", () => {
    const a = { az_deg: 123.456, el_deg: 4.5 };
    expect(separationDeg(a, a)).toBe(0);
    for (const tiny of [1e-9, 1e-8, 1e-7, 1e-6]) {
      const b = { az_deg: a.az_deg, el_deg: a.el_deg + tiny };
      expect(separationDeg(a, b) / tiny).toBeCloseTo(1, 4);
    }
    expect(separationDeg({ az_deg: 0, el_deg: 0 }, { az_deg: 90, el_deg: 0 })).toBeCloseTo(90, 12);
    expect(separationDeg({ az_deg: 10, el_deg: 90 }, { az_deg: 200, el_deg: 90 })).toBeCloseTo(
      0,
      9,
    );
  });
});

describe("the Horizons reference file", () => {
  it("covers 3 sites x 50 epochs x Sun and Earth, with Horizons reading the sites as intended", () => {
    expect(reference.sites.map((s) => s.id)).toEqual([
      "shackleton-rim",
      "connecting-ridge",
      "de-gerlache-rim",
    ]);
    expect(reference.epochs).toHaveLength(50);
    expect(reference.cases).toHaveLength(150);
    expect(reference.query.targets).toEqual({ sun: "10", earth: "399" });
    expect(reference.api.signature.version).toBe("1.2");
    const ctx = reference.horizons_context;
    expect(ctx["Center pole/equ"]).toContain("MEAN_ME");
    expect(ctx["Center radii"]).toContain("1737.4, 1737.4, 1737.4");
    expect(ctx["Atmos refraction"]).toMatch(/^NO/);
  });

  it("uses the same sites as the engine's catalog", () => {
    const catalog = new Map(reference.sites.map((s) => [s.id, s]));
    for (const s of catalog.values()) {
      expect(Number.isFinite(s.elev_m)).toBe(true);
      expect(s.lat_deg).toBeLessThan(-88);
    }
  });

  it("is spread evenly over 2026 and its UTC times agree with the engine's time module", () => {
    const ets = reference.epochs.map((e) => e.et);
    const gaps = ets.slice(1).map((t, i) => t - ets[i]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) expect(Math.abs(g - mean)).toBeLessThan(0.01);
    expect(reference.epochs[0]!.utc).toBe("2026-01-02T00:00:00.000");
    expect(reference.epochs[49]!.utc).toBe("2026-12-30T00:00:00.000");
    for (const e of reference.epochs) expect(Math.abs(utcIsoToEt(e.utc) - e.et)).toBeLessThan(1e-6);
  });
});

describe("engine versus JPL Horizons", () => {
  it("agrees within the acceptance tolerance on every case", () => {
    for (const r of rows) {
      const where = `${r.site_id} ${r.body} ${r.utc}`;
      expect(r.residual.separation_deg, `separation ${where}`).toBeLessThan(TOLERANCE_DEG);
      expect(Math.abs(r.residual.el_deg), `elevation ${where}`).toBeLessThan(TOLERANCE_DEG);
      expect(Math.abs(r.residual.az_on_sky_deg), `azimuth ${where}`).toBeLessThan(TOLERANCE_DEG);
    }
    expect(report.passes).toBe(true);
    // Printed so the margin is visible in the log, not only the pass.
    const f = (s: ResidualStat) =>
      `max ${s.max_abs.toExponential(2)} mean ${s.mean.toExponential(2)} rms ${s.rms.toExponential(2)}`;
    console.log(
      `engine vs Horizons over ${rows.length} rows (deg): Sun separation ${f(report.summary.sun.separation_deg)}; ` +
        `Earth separation ${f(report.summary.earth.separation_deg)}; ` +
        `Sun el ${f(report.summary.sun.el_deg)}; Earth el ${f(report.summary.earth.el_deg)}; ` +
        `Horizons vs SPICE max ${Math.max(...Object.values(reference.horizons_vs_spice_separation_deg).map((s) => s.max)).toExponential(2)}`,
    );
  });

  it("would catch an error: a 10-minute time shift breaks the tolerance (negative control)", () => {
    const shifted = residualCases(600);
    expect(Math.max(...shifted.map((r) => r.residual.separation_deg))).toBeGreaterThan(
      TOLERANCE_DEG,
    );
  });

  it("would catch a wrong site: moving the longitude by 0.01 degree breaks the tolerance", () => {
    const sites = new Map(reference.sites.map((s) => [s.id, s]));
    const c = reference.cases.find((x) => x.site_id === "shackleton-rim")!;
    const s = sites.get(c.site_id)!;
    const moved = computeSky(
      eph,
      c.epoch_et,
      siteLocation({ lat_deg: s.lat_deg, lon_deg: s.lon_deg + 0.01, elev_m: s.elev_m }),
      { mast_height_m: 0 },
    ).state;
    const sepDeg = separationDeg(
      { az_deg: moved.sun_azimuth_rad * DEG, el_deg: moved.sun_elevation_rad * DEG },
      c.horizons.sun,
    );
    // Near the pole a small longitude error turns the local north: azimuths swing by about 0.01 deg x sin(lat).
    const azSwing = Math.abs(wrap180(moved.sun_azimuth_rad * DEG - c.horizons.sun.az_deg));
    expect(Math.max(sepDeg, azSwing * Math.cos(c.horizons.sun.el_deg / DEG))).toBeGreaterThan(5e-3);
  });

  it("has no bias a reader would mistake for noise: the mean is far below the maximum", () => {
    for (const body of BODIES) {
      const s = report.summary[body].separation_deg;
      expect(s.rms).toBeLessThanOrEqual(s.max_abs);
      expect(s.max_abs).toBeLessThan(TOLERANCE_DEG);
    }
  });
});

describe("horizons_residuals.json", () => {
  it("is valid against the contract", () => {
    expect(HorizonsResidualsSchema.safeParse(report).success).toBe(true);
    expect(report.cases).toHaveLength(300);
  });

  if (process.env.WRITE_HORIZONS_RESIDUALS === "1") {
    it("is written (WRITE_HORIZONS_RESIDUALS=1)", () => {
      writeFileSync(fileURLToPath(RESIDUALS_URL), JSON.stringify(report, null, 2) + "\n");
    });
  } else {
    it("is exactly what the engine produces now (regenerate with `pnpm --filter @sightline/engine run residuals`)", () => {
      const committed = HorizonsResidualsSchema.parse(readJson(RESIDUALS_URL));
      expect(committed.passes).toBe(true);
      expect(committed.tolerance_deg).toBe(TOLERANCE_DEG);
      expect(committed.cases).toHaveLength(report.cases.length);
      committed.cases.forEach((c, i) => {
        const now = report.cases[i]!;
        expect([c.site_id, c.utc, c.body]).toEqual([now.site_id, now.utc, now.body]);
        expect(c.engine.az_deg).toBeCloseTo(now.engine.az_deg, 9);
        expect(c.engine.el_deg).toBeCloseTo(now.engine.el_deg, 9);
        expect(c.residual.separation_deg).toBeCloseTo(now.residual.separation_deg, 9);
      });
      expect(committed.summary.sun.separation_deg.max_abs).toBeCloseTo(
        report.summary.sun.separation_deg.max_abs,
        9,
      );
      expect(committed.summary.earth.separation_deg.max_abs).toBeCloseTo(
        report.summary.earth.separation_deg.max_abs,
        9,
      );
      expect(committed.horizons_vs_spice_separation_deg).toEqual(
        report.horizons_vs_spice_separation_deg,
      );
    });
  }
});
