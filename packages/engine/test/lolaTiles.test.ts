import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  TileDataSchema,
  TileManifestSchema,
  type TileCoord,
  type TileSource,
} from "@sightline/contracts";
import {
  BUNDLED_TILE_COVERAGE,
  BUNDLED_TILE_MANIFEST,
  LolaTileSource,
  TileNotAvailableError,
  createLolaTileSource,
  parseCoverage,
  parseTileBytes,
  tileHeightRange,
} from "../src";
import { GOLDEN_DIR, readJson } from "./helpers";

const TILE_DIR = new URL("../src/data/tiles/", import.meta.url);
const readCommitted = (path: string): Promise<Uint8Array> =>
  Promise.resolve(new Uint8Array(readFileSync(new URL(path, TILE_DIR))));

const source = createLolaTileSource({ readTile: readCommitted });
const tileSource: TileSource = source;

interface Probe {
  level: number;
  x: number;
  y: number;
  row: number;
  col: number;
  ref_height_m: number;
  source: string;
}
const probeDoc = readJson(new URL("tiles_probe.json", GOLDEN_DIR)) as { probes: Probe[] };

const committedCoords: TileCoord[] = BUNDLED_TILE_COVERAGE.rects.flatMap((r) => {
  const out: TileCoord[] = [];
  for (let x = r.x_min; x <= r.x_max; x++)
    for (let y = r.y_min; y <= r.y_max; y++) out.push({ level: r.level, x, y });
  return out;
});

describe("real tile manifest", () => {
  it("satisfies the contract, is not simulated, and cites the PGDA datasets", async () => {
    const m = await tileSource.getManifest();
    expect(TileManifestSchema.safeParse(m).success).toBe(true);
    expect(m.simulated).toBe(false);
    expect(m.provenance.simulated).toBe(false);
    expect(m.provenance.source).toBe("SIGHTLINE_PIPELINE");
    expect(m.provenance.data_sources).toEqual([
      "pgda90-ldem-80s-80m",
      "pgda78-site04-surf",
      "pgda78-site01-surf",
      "pgda78-site11-surf",
    ]);
    expect(m.provenance.dem_citation).toContain("Barker");
    expect(m).toMatchObject({
      level_count: 12,
      tile_size_px: 64,
      border_px: 1,
      height_scale_m: 0.1,
      height_encoding: "uint16_offset",
      bounds_m: { x_min_m: -304000, y_min_m: -304000, x_max_m: 304000, y_max_m: 304000 },
    });
  });

  it("returns a copy, so callers cannot change the manifest", async () => {
    const m = await tileSource.getManifest();
    m.data_version = "changed";
    m.bounds_m.x_min_m = 0;
    const again = await tileSource.getManifest();
    expect(again.data_version).toBe(BUNDLED_TILE_MANIFEST.data_version);
    expect(again.bounds_m.x_min_m).toBe(-304000);
  });
});

describe("committed tiles", () => {
  it("are the 85 tiles of levels 0-3 plus one under each site at levels 7-11", () => {
    expect(committedCoords).toHaveLength(100);
    const perLevel = (l: number) => committedCoords.filter((c) => c.level === l).length;
    expect([0, 1, 2, 3].map(perLevel)).toEqual([1, 4, 16, 64]);
    expect([7, 8, 9, 10, 11].map(perLevel)).toEqual([3, 3, 3, 3, 3]);
  });

  it("all decode to contract-valid 64 x 64 tiles, flagged real", async () => {
    for (const coord of committedCoords) {
      const t = await tileSource.getTile(coord);
      expect(TileDataSchema.safeParse(t).success, JSON.stringify(coord)).toBe(true);
      expect(t.size_px).toBe(64);
      expect(t.simulated).toBe(false);
      expect(t.coord).toEqual(coord);
    }
  });

  it("have the tile's lowest sample as the offset, and a scale of 0.1 m except where relief needs more", async () => {
    let coarse = 0;
    for (const coord of committedCoords) {
      const t = await tileSource.getTile(coord);
      const { min_m, max_m } = tileHeightRange(t);
      expect(min_m).toBe(t.offset_m);
      expect(max_m).toBeGreaterThanOrEqual(min_m);
      expect(t.scale_m).toBeGreaterThanOrEqual(0.1);
      if (t.scale_m > 0.1) {
        coarse++;
        expect(coord.level).toBeLessThanOrEqual(5); // only the 10 km-wide means need it
        expect(max_m - min_m).toBeGreaterThan(6553.5);
      } else {
        expect(max_m - min_m).toBeLessThanOrEqual(6553.5 + 1e-9);
      }
    }
    expect(coarse).toBeGreaterThan(0);
  });

  it("level 0 spans the south polar relief: more than 10 km between its lowest and highest mean", async () => {
    const { min_m, max_m } = tileHeightRange(await tileSource.getTile({ level: 0, x: 0, y: 0 }));
    expect(max_m - min_m).toBeGreaterThan(10_000);
    expect(min_m).toBeGreaterThan(-8_000);
    expect(max_m).toBeLessThan(8_000);
  });
});

describe("heights against the raw GeoTIFF rasters", () => {
  // The probes are written by `sightline tiles`: the raw raster's bilinear height (averaged over the
  // sample's cell for coarse levels), computed with no code shared with the tile builder.
  it("has probes at every committed level, from all four rasters", () => {
    const levels = new Set(probeDoc.probes.map((p) => p.level));
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 7, 8, 9, 10, 11]);
    expect(new Set(probeDoc.probes.map((p) => p.source)).size).toBe(4);
    expect(probeDoc.probes.length).toBeGreaterThanOrEqual(400);
  });

  it("agree to half a scale step (at most 0.05 m wherever the scale is 0.1 m)", async () => {
    let worst_fine_m = 0;
    let worst_coarse_m = 0;
    let n_fine = 0;
    for (const p of probeDoc.probes) {
      const t = await tileSource.getTile({ level: p.level, x: p.x, y: p.y });
      const h = t.offset_m + t.scale_m * t.heights[p.row * t.size_px + p.col]!;
      const err = Math.abs(h - p.ref_height_m);
      // 0.002 m: the fixture's own rounding (4 decimals) and float32 mosaic arithmetic
      expect(err, JSON.stringify(p)).toBeLessThanOrEqual(t.scale_m / 2 + 0.002);
      if (t.scale_m === 0.1) {
        worst_fine_m = Math.max(worst_fine_m, err);
        n_fine++;
        expect(err, JSON.stringify(p)).toBeLessThanOrEqual(0.1);
      } else worst_coarse_m = Math.max(worst_coarse_m, err);
    }
    expect(n_fine).toBeGreaterThan(300);
    expect(worst_fine_m).toBeLessThan(0.052);
    expect(worst_coarse_m).toBeLessThan(0.11);
  });
});

describe("tile edges", () => {
  it("a tile's border samples are its neighbour's first interior samples (levels 0-3)", async () => {
    const half = (a: number, b: number) => (a + b) / 2 + 1e-6; // each side is rounded to its scale
    for (const level of [2, 3]) {
      const n = 2 ** level;
      for (const [x, y] of [
        [0, 0],
        [n - 2, 1],
        [1, n - 2],
      ] as const) {
        const a = await source.getTile({ level, x, y });
        const e = await source.getTile({ level, x: x + 1, y });
        const u = await source.getTile({ level, x, y: y + 1 });
        const at = (t: typeof a, r: number, c: number) =>
          t.offset_m + t.scale_m * t.heights[r * 64 + c]!;
        for (let k = 0; k < 64; k++) {
          // east neighbour: our columns 62 and 63 are its columns 0 and 1
          expect(Math.abs(at(a, k, 63) - at(e, k, 1))).toBeLessThanOrEqual(
            half(a.scale_m, e.scale_m),
          );
          expect(Math.abs(at(a, k, 62) - at(e, k, 0))).toBeLessThanOrEqual(
            half(a.scale_m, e.scale_m),
          );
          // tile y grows with row, so the next tile north holds rows 0 and 1 where we have 62 and 63
          expect(Math.abs(at(a, 63, k) - at(u, 1, k))).toBeLessThanOrEqual(
            half(a.scale_m, u.scale_m),
          );
          expect(Math.abs(at(a, 62, k) - at(u, 0, k))).toBeLessThanOrEqual(
            half(a.scale_m, u.scale_m),
          );
        }
      }
    }
  });
});

describe("sparse pyramid and bad input", () => {
  it("reports which tiles exist", () => {
    expect(source.hasTile({ level: 0, x: 0, y: 0 })).toBe(true);
    expect(source.hasTile({ level: 3, x: 7, y: 7 })).toBe(true);
    expect(source.hasTile({ level: 4, x: 0, y: 0 })).toBe(false); // in the pyramid, not committed
    expect(source.hasTile({ level: 12, x: 0, y: 0 })).toBe(false); // outside the pyramid
  });

  it("refuses tiles outside the pyramid with a RangeError and missing ones with TileNotAvailableError", async () => {
    await expect(source.getTile({ level: 12, x: 0, y: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(source.getTile({ level: 2, x: 4, y: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(source.getTile({ level: 11, x: 0, y: 0 })).rejects.toBeInstanceOf(
      TileNotAvailableError,
    );
  });

  it("rejects a file served under the wrong name, a truncated file and a non-tile file", async () => {
    const manifest = BUNDLED_TILE_MANIFEST;
    const good = new Uint8Array(readFileSync(new URL("3/2/4.bin", TILE_DIR)));
    const coord = { level: 3, x: 2, y: 4 };
    expect(parseTileBytes(good, coord, manifest).coord).toEqual(coord);
    expect(() => parseTileBytes(good, { level: 3, x: 3, y: 4 }, manifest)).toThrow(/file says/);
    expect(() => parseTileBytes(good.slice(0, good.length - 2), coord, manifest)).toThrow(/bytes/);
    const html = good.slice();
    html.set(new TextEncoder().encode("<!DO"), 0);
    expect(() => parseTileBytes(html, coord, manifest)).toThrow(/not a SLT1/);
    // a Uint8Array view at an odd offset still decodes (the host may hand over a pooled buffer)
    const pooled = new Uint8Array(good.length + 3);
    pooled.set(good, 3);
    const same = parseTileBytes(pooled.subarray(3), coord, manifest);
    expect(same.heights).toEqual(parseTileBytes(good, coord, manifest).heights);
  });

  it("rejects bad coverage documents and a simulated manifest", () => {
    expect(() => parseCoverage({ schema_version: 2, data_version: "x", rects: [] })).toThrow();
    expect(() =>
      parseCoverage({
        schema_version: 1,
        data_version: "x",
        rects: [{ level: 0, x_min: 1, x_max: 0, y_min: 0, y_max: 0 }],
      }),
    ).toThrow(/empty/);
    const simulated = {
      ...BUNDLED_TILE_MANIFEST,
      simulated: true,
      provenance: { ...BUNDLED_TILE_MANIFEST.provenance, source: "SYNTHETIC_X", simulated: true },
    };
    expect(() => new LolaTileSource({ manifest: simulated })).toThrow(/non-simulated/);
  });

  it("the default reader fetches <baseUrl>/<level>/<x>/<y>.bin", async () => {
    const bytes = new Uint8Array(readFileSync(new URL("0/0/0.bin", TILE_DIR)));
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(bytes.buffer) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const t = await createLolaTileSource({ baseUrl: "/data/tiles/" }).getTile({
        level: 0,
        x: 0,
        y: 0,
      });
      expect(fetchMock).toHaveBeenCalledWith("/data/tiles/0/0/0.bin");
      expect(t.heights).toHaveLength(64 * 64);
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 404 } as never));
      await expect(
        createLolaTileSource({ baseUrl: "/data/tiles" }).getTile({ level: 0, x: 0, y: 0 }),
      ).rejects.toThrow(/HTTP 404/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
