import type { TileData } from "@sightline/contracts";

/**
 * Heights (m) of the mesh vertices of one tile. A tile has 64 samples a side: 62 interior plus one
 * border sample each side, and sample `j` sits half a cell outside the tile edge for j = 0. The mesh
 * has 63 vertices a side, one on each cell corner of the 62 x 62 interior, and every vertex height is
 * the mean of the four samples around it. Neighbouring tiles share those samples, so their edge
 * vertices get identical heights and the surface has no seams.
 *
 * Index = row * (size_px - 1) + col, with row 0 at the tile's lowest y and col 0 at its lowest x.
 */
export function tileVertexHeightsM(tile: TileData): Float32Array {
  const { size_px, offset_m, scale_m, heights } = tile;
  const n = size_px - 1;
  const out = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * size_px + col;
      const sum =
        (heights[i] ?? 0) +
        (heights[i + 1] ?? 0) +
        (heights[i + size_px] ?? 0) +
        (heights[i + size_px + 1] ?? 0);
      out[row * n + col] = offset_m + (sum / 4) * scale_m;
    }
  }
  return out;
}
