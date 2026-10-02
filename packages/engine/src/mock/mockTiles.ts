import {
  MOON_REFERENCE_RADIUS_M,
  isTileCoordInRange,
  type TileCoord,
  type TileData,
  type TileManifest,
  type TileSource,
} from "@sightline/contracts";
import { MOCK_PROVENANCE } from "./constants";
import { mockHeightM } from "./mockTerrain";

export const MOCK_TILE_SIZE_PX = 64;
const BORDER_PX = 1;
const HALF_EXTENT_M = 20_000;
const HEIGHT_SCALE_M = 0.1;
const UINT16_MAX = 65_535;

export const MOCK_TILE_MANIFEST: Readonly<TileManifest> = Object.freeze({
  schema_version: 1,
  data_version: "mock-1",
  projection: "polar_stereographic_south",
  moon_radius_m: MOON_REFERENCE_RADIUS_M,
  bounds_m: {
    x_min_m: -HALF_EXTENT_M,
    y_min_m: -HALF_EXTENT_M,
    x_max_m: HALF_EXTENT_M,
    y_max_m: HALF_EXTENT_M,
  },
  tile_size_px: MOCK_TILE_SIZE_PX,
  border_px: BORDER_PX,
  level_count: 4,
  height_encoding: "uint16_offset",
  height_scale_m: HEIGHT_SCALE_M,
  simulated: true,
  provenance: MOCK_PROVENANCE,
} as const);

/**
 * Synthetic 64 × 64 tiles sampled from the analytic terrain. Samples sit at pixel centres, and
 * the 1-sample border reads the neighbour's ground, so adjacent tiles agree exactly.
 */
export class MockTileSource implements TileSource {
  getManifest(): Promise<TileManifest> {
    return Promise.resolve({ ...MOCK_TILE_MANIFEST });
  }

  getTile(coord: TileCoord): Promise<TileData> {
    if (!isTileCoordInRange(MOCK_TILE_MANIFEST, coord)) {
      return Promise.reject(
        new RangeError(`tile ${coord.level}/${coord.x}/${coord.y} is outside the mock pyramid`),
      );
    }
    const { x_min_m, y_min_m, x_max_m } = MOCK_TILE_MANIFEST.bounds_m;
    const tile_extent_m = (x_max_m - x_min_m) / 2 ** coord.level;
    const interior_px = MOCK_TILE_SIZE_PX - 2 * BORDER_PX;
    const spacing_m = tile_extent_m / interior_px;
    const x0_m = x_min_m + coord.x * tile_extent_m;
    const y0_m = y_min_m + coord.y * tile_extent_m;

    const heights_m = new Float64Array(MOCK_TILE_SIZE_PX * MOCK_TILE_SIZE_PX);
    let min_m = Infinity;
    for (let row = 0; row < MOCK_TILE_SIZE_PX; row++) {
      for (let col = 0; col < MOCK_TILE_SIZE_PX; col++) {
        const h = mockHeightM(
          x0_m + (col - BORDER_PX + 0.5) * spacing_m,
          y0_m + (row - BORDER_PX + 0.5) * spacing_m,
        );
        heights_m[row * MOCK_TILE_SIZE_PX + col] = h;
        min_m = Math.min(min_m, h);
      }
    }

    const heights = new Uint16Array(heights_m.length);
    for (let i = 0; i < heights.length; i++) {
      const count = Math.round(((heights_m[i] ?? min_m) - min_m) / HEIGHT_SCALE_M);
      heights[i] = Math.min(UINT16_MAX, count);
    }
    return Promise.resolve({
      coord: { ...coord },
      size_px: MOCK_TILE_SIZE_PX,
      offset_m: min_m,
      scale_m: HEIGHT_SCALE_M,
      heights,
      simulated: true,
    });
  }
}

export function createMockTileSource(): TileSource {
  return new MockTileSource();
}
