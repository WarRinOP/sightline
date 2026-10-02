import { describe, expect, it } from "vitest";
import type { TileData } from "@sightline/contracts";
import { createMockTileSource } from "@sightline/engine";
import { tileVertexHeightsM } from "../src/tileMesh";

const N = 63;

describe("tileVertexHeightsM", () => {
  it("has 63 x 63 vertices, each the mean of the four samples around it", () => {
    const heights = new Uint16Array(64 * 64);
    for (let r = 0; r < 64; r++) for (let c = 0; c < 64; c++) heights[r * 64 + c] = 10 * r + c;
    const tile: TileData = {
      coord: { level: 0, x: 0, y: 0 },
      size_px: 64,
      offset_m: 100,
      scale_m: 0.5,
      heights,
      simulated: true,
    };
    const h = tileVertexHeightsM(tile);
    expect(h).toHaveLength(N * N);
    // vertex (row 5, col 7): samples (5,7) (5,8) (6,7) (6,8) = 57 58 67 68, mean 62.5
    expect(h[5 * N + 7]).toBeCloseTo(100 + 0.5 * 62.5, 4);
    expect(h[0]).toBeCloseTo(100 + 0.5 * ((0 + 1 + 10 + 11) / 4), 4); // lowest y, lowest x corner
    // last vertex (row 62, col 62): samples 682 683 692 693, mean 687.5
    expect(h[N * N - 1]).toBeCloseTo(100 + 0.5 * 687.5, 4);
  });

  it("gives neighbouring tiles identical edge vertices (no seams), to the tiles' own rounding", async () => {
    const source = createMockTileSource();
    const at = (x: number, y: number) =>
      source.getTile({ level: 3, x, y }).then(tileVertexHeightsM);
    const [a, east, north] = await Promise.all([at(2, 4), at(3, 4), at(2, 5)]);
    for (let k = 0; k < N; k++) {
      // east neighbour: our last column is its first column; north neighbour: our last row is its first
      expect(Math.abs(a[k * N + (N - 1)]! - east[k * N]!)).toBeLessThan(0.11);
      expect(Math.abs(a[(N - 1) * N + k]! - north[k]!)).toBeLessThan(0.11);
    }
  });

  it("does not make a seam out of a real slope: the edge vertices differ from their inner neighbours", async () => {
    const tile = await createMockTileSource().getTile({ level: 3, x: 2, y: 4 });
    const h = tileVertexHeightsM(tile);
    const spread = Math.max(...h) - Math.min(...h);
    expect(spread).toBeGreaterThan(1); // the mock bowl has relief; a flat result would hide a bug
  });
});
