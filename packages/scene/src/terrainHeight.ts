import type { TileData, TileManifest, TileSource } from "@sightline/contracts";
import { getLoadedTile } from "./tileCache";

export interface TileBounds {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

/** Bounds (m, tile plane) of tile (level, x, y); y grows northward like the map. */
export function tileBounds(
  manifest: TileManifest,
  level: number,
  x: number,
  y: number,
): TileBounds {
  const b = manifest.bounds_m;
  const size_x = (b.x_max_m - b.x_min_m) / 2 ** level;
  const size_y = (b.y_max_m - b.y_min_m) / 2 ** level;
  return {
    x_min: b.x_min_m + x * size_x,
    y_min: b.y_min_m + y * size_y,
    x_max: b.x_min_m + (x + 1) * size_x,
    y_max: b.y_min_m + (y + 1) * size_y,
  };
}

/**
 * Height (m) inside one tile by bilinear interpolation of its samples. Sample j sits at the centre of
 * cell j - 1 of the tile's size_px - 2 interior cells (j = 0 and size_px - 1 are the border samples
 * half a cell outside the edges, tileMesh.ts), so the mesh vertex at a cell corner, the mean of its
 * four samples, is exactly what this returns there.
 */
export function sampleTileHeightM(
  tile: TileData,
  bounds: TileBounds,
  x_m: number,
  y_m: number,
): number {
  const n = tile.size_px;
  const cell_x = (bounds.x_max - bounds.x_min) / (n - 2);
  const cell_y = (bounds.y_max - bounds.y_min) / (n - 2);
  const u = Math.min(Math.max((x_m - bounds.x_min) / cell_x + 0.5, 0), n - 1.000001);
  const v = Math.min(Math.max((y_m - bounds.y_min) / cell_y + 0.5, 0), n - 1.000001);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const h = tile.heights;
  const k = j * n + i;
  const h00 = h[k] ?? 0;
  const h10 = h[k + 1] ?? 0;
  const h01 = h[k + n] ?? 0;
  const h11 = h[k + n + 1] ?? 0;
  const mean = (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  return tile.offset_m + mean * tile.scale_m;
}

/**
 * Terrain height (m) at a point of the tile plane from the finest tile already loaded there, or null
 * when no tile covering it has arrived. Never fetches: for the camera and the drawn shadows only.
 */
export function terrainHeightAtM(
  source: TileSource,
  manifest: TileManifest,
  x_m: number,
  y_m: number,
): number | null {
  const b = manifest.bounds_m;
  if (x_m < b.x_min_m || x_m > b.x_max_m || y_m < b.y_min_m || y_m > b.y_max_m) return null;
  for (let level = manifest.level_count - 1; level >= 0; level--) {
    const n = 2 ** level;
    const x = Math.min(Math.floor(((x_m - b.x_min_m) / (b.x_max_m - b.x_min_m)) * n), n - 1);
    const y = Math.min(Math.floor(((y_m - b.y_min_m) / (b.y_max_m - b.y_min_m)) * n), n - 1);
    const tile = getLoadedTile(source, { level, x, y });
    if (tile) return sampleTileHeightM(tile, tileBounds(manifest, level, x, y), x_m, y_m);
  }
  return null;
}
