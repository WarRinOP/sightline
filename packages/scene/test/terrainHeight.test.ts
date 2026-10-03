import { describe, expect, it } from "vitest";
import type { TileCoord, TileData, TileManifest, TileSource } from "@sightline/contracts";
import { MOCK_TILE_MANIFEST } from "@sightline/engine";
import { getCachedTile } from "../src/tileCache";
import { sampleTileHeightM, terrainHeightAtM, tileBounds } from "../src/terrainHeight";
import { tileVertexHeightsM } from "../src/tileMesh";

const manifest: TileManifest = MOCK_TILE_MANIFEST;

function rampTile(coord: TileCoord, offset_m: number): TileData {
  const heights = new Uint16Array(64 * 64);
  for (let r = 0; r < 64; r++) for (let c = 0; c < 64; c++) heights[r * 64 + c] = 7 * r + 3 * c;
  return { coord, size_px: 64, offset_m, scale_m: 0.25, heights, simulated: true };
}

describe("sampleTileHeightM", () => {
  it("returns the mesh's own vertex height at every cell corner", () => {
    const coord = { level: 2, x: 1, y: 3 };
    const tile = rampTile(coord, 500);
    const b = tileBounds(manifest, coord.level, coord.x, coord.y);
    const vertex = tileVertexHeightsM(tile);
    const cell_x = (b.x_max - b.x_min) / 62;
    const cell_y = (b.y_max - b.y_min) / 62;
    for (const [row, col] of [
      [0, 0],
      [0, 62],
      [31, 17],
      [62, 62],
    ] as const) {
      const h = sampleTileHeightM(tile, b, b.x_min + col * cell_x, b.y_min + row * cell_y);
      expect(h).toBeCloseTo(vertex[row * 63 + col]!, 6);
    }
  });

  it("reproduces a plane exactly between samples (bilinear of a linear field)", () => {
    const coord = { level: 0, x: 0, y: 0 };
    const tile = rampTile(coord, 0);
    const b = tileBounds(manifest, 0, 0, 0);
    const cell_x = (b.x_max - b.x_min) / 62;
    const cell_y = (b.y_max - b.y_min) / 62;
    // Sample (r, c) sits at x_min + (c - 0.5) cell_x, y_min + (r - 0.5) cell_y.
    const x = b.x_min + (10.3 - 0.5) * cell_x;
    const y = b.y_min + (20.6 - 0.5) * cell_y;
    expect(sampleTileHeightM(tile, b, x, y)).toBeCloseTo(0.25 * (7 * 20.6 + 3 * 10.3), 6);
  });
});

describe("terrainHeightAtM", () => {
  function sourceOf(tiles: Record<string, TileData>): TileSource {
    return {
      getManifest: () => Promise.resolve(manifest),
      getTile: (c) => {
        const t = tiles[`${c.level}_${c.x}_${c.y}`];
        return t ? Promise.resolve(t) : Promise.reject(new Error("missing"));
      },
    };
  }

  it("is null before any tile has arrived and outside the bounds", () => {
    const source = sourceOf({ "0_0_0": rampTile({ level: 0, x: 0, y: 0 }, 0) });
    expect(terrainHeightAtM(source, manifest, 0, 0)).toBeNull();
    expect(terrainHeightAtM(source, manifest, manifest.bounds_m.x_max_m + 1, 0)).toBeNull();
  });

  it("answers from the finest loaded tile covering the point", async () => {
    const coarse = rampTile({ level: 0, x: 0, y: 0 }, 0);
    const fine = rampTile({ level: 1, x: 1, y: 1 }, 10_000);
    const source = sourceOf({ "0_0_0": coarse, "1_1_1": fine });
    await getCachedTile(source, coarse.coord);
    const b = manifest.bounds_m;
    const ne = { x: (b.x_min_m + 3 * b.x_max_m) / 4, y: (b.y_min_m + 3 * b.y_max_m) / 4 };
    const fromCoarse = terrainHeightAtM(source, manifest, ne.x, ne.y);
    expect(fromCoarse).toBeCloseTo(
      sampleTileHeightM(coarse, tileBounds(manifest, 0, 0, 0), ne.x, ne.y),
      6,
    );
    await getCachedTile(source, fine.coord);
    const fromFine = terrainHeightAtM(source, manifest, ne.x, ne.y);
    expect(fromFine).toBeCloseTo(
      sampleTileHeightM(fine, tileBounds(manifest, 1, 1, 1), ne.x, ne.y),
      6,
    );
    expect(fromFine!).toBeGreaterThan(10_000);
    // The south-west quarter has no fine tile: the coarse one still answers there.
    const sw = { x: (3 * b.x_min_m + b.x_max_m) / 4, y: (3 * b.y_min_m + b.y_max_m) / 4 };
    expect(terrainHeightAtM(source, manifest, sw.x, sw.y)!).toBeLessThan(10_000);
  });
});
