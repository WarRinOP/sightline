import { describe, expect, it } from "vitest";
import {
  TileDataSchema,
  TileManifestSchema,
  type TileData,
  type TileManifest,
  type TileSource,
} from "@sightline/contracts";
import { MOCK_TILE_MANIFEST, MOCK_TILE_SIZE_PX, createMockTileSource } from "../src";
import { mockHeightM } from "../src/mock/mockTerrain";

const source: TileSource = createMockTileSource();

const decode = (t: TileData, row: number, col: number) =>
  t.offset_m + t.scale_m * t.heights[row * t.size_px + col]!;

describe("mock tile manifest", () => {
  it("satisfies the contract and is flagged simulated", async () => {
    const m = await source.getManifest();
    expect(TileManifestSchema.safeParse(m).success).toBe(true);
    expect(m.simulated).toBe(true);
    expect(m.provenance.simulated).toBe(true);
    expect(m.tile_size_px).toBe(64);
    expect(m).toEqual(MOCK_TILE_MANIFEST);
  });

  it("returns a copy, so callers cannot change the manifest", async () => {
    const m: TileManifest = await source.getManifest();
    m.data_version = "changed";
    expect((await source.getManifest()).data_version).toBe("mock-1");
  });
});

describe("mock tiles", () => {
  it("returns 64 × 64 elevation arrays that satisfy the contract", async () => {
    const t = await source.getTile({ level: 0, x: 0, y: 0 });
    expect(TileDataSchema.safeParse(t).success).toBe(true);
    expect(t.size_px).toBe(MOCK_TILE_SIZE_PX);
    expect(t.heights).toHaveLength(64 * 64);
    expect(t.simulated).toBe(true);
  });

  it("encodes the analytic terrain to within half a count", async () => {
    const t = await source.getTile({ level: 0, x: 0, y: 0 });
    const { x_min_m, y_min_m, x_max_m } = MOCK_TILE_MANIFEST.bounds_m;
    const spacing_m = (x_max_m - x_min_m) / (64 - 2);
    for (const [row, col] of [
      [1, 1],
      [32, 32],
      [40, 20],
      [62, 62],
    ] as const) {
      const x_m = x_min_m + (col - 1 + 0.5) * spacing_m;
      const y_m = y_min_m + (row - 1 + 0.5) * spacing_m;
      expect(Math.abs(decode(t, row, col) - mockHeightM(x_m, y_m))).toBeLessThanOrEqual(
        0.05 + 1e-9,
      );
    }
  });

  it("has a deep floor near the pole and a raised rim", async () => {
    const t = await source.getTile({ level: 0, x: 0, y: 0 });
    const centre = decode(t, 32, 32);
    expect(centre).toBeLessThan(-1900);
    expect(Math.max(...Array.from(t.heights)) * t.scale_m + t.offset_m).toBeGreaterThan(150);
  });

  it("makes neighbouring tiles agree across the shared edge (border samples)", async () => {
    const left = await source.getTile({ level: 1, x: 0, y: 0 });
    const right = await source.getTile({ level: 1, x: 1, y: 0 });
    for (let row = 0; row < 64; row++) {
      // Left tile's right border = right tile's first interior column, and vice versa.
      expect(Math.abs(decode(left, row, 63) - decode(right, row, 1))).toBeLessThanOrEqual(
        0.1 + 1e-9,
      );
      expect(Math.abs(decode(left, row, 62) - decode(right, row, 0))).toBeLessThanOrEqual(
        0.1 + 1e-9,
      );
    }
  });

  it("is deterministic", async () => {
    const a = await source.getTile({ level: 2, x: 1, y: 2 });
    const b = await createMockTileSource().getTile({ level: 2, x: 1, y: 2 });
    expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
    expect(b.offset_m).toBe(a.offset_m);
  });

  it("rejects tiles outside the pyramid", async () => {
    await expect(source.getTile({ level: 4, x: 0, y: 0 })).rejects.toThrow(RangeError);
    await expect(source.getTile({ level: 1, x: 2, y: 0 })).rejects.toThrow(RangeError);
  });
});
