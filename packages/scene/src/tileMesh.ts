import * as THREE from "three";
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

/**
 * Unit normals (scene frame: x east on the plane, y up, z = -map y) of the mesh vertices, from the
 * gradient of the bilinear surface through the four samples around each vertex. Neighbouring tiles
 * share those samples, so their edge normals agree and the shading has no seams, unlike per-tile
 * `computeVertexNormals`, which sees only one side of an edge.
 *
 * `cell_x_m`, `cell_y_m`: sample spacing (tile width / (size_px - 2)). Index as tileVertexHeightsM, × 3.
 */
export function tileVertexNormals(
  tile: TileData,
  cell_x_m: number,
  cell_y_m: number,
): Float32Array {
  const { size_px, scale_m, heights } = tile;
  const n = size_px - 1;
  const out = new Float32Array(n * n * 3);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * size_px + col;
      const h00 = heights[i] ?? 0;
      const h10 = heights[i + 1] ?? 0;
      const h01 = heights[i + size_px] ?? 0;
      const h11 = heights[i + size_px + 1] ?? 0;
      const dh_dx = ((h10 + h11 - h00 - h01) * scale_m) / (2 * cell_x_m);
      const dh_dy = ((h01 + h11 - h00 - h10) * scale_m) / (2 * cell_y_m);
      // Surface y = h(x, -z): normal (-dh/dx, 1, dh/dy).
      const len = Math.hypot(dh_dx, 1, dh_dy);
      const k = (row * n + col) * 3;
      out[k] = -dh_dx / len;
      out[k + 1] = 1 / len;
      out[k + 2] = dh_dy / len;
    }
  }
  return out;
}

/**
 * Normals of the parent tile resampled at this tile's vertices (bilinear over the parent's vertex
 * grid). A tile blends toward these with distance, so where the quadtree changes level the shading
 * matches the coarser neighbour instead of jumping at the tile edge (finer meshes catch far more
 * grazing light). `quadrant`: which quarter of the parent this tile is (x, y each 0 or 1).
 */
export function resampleParentNormals(
  parentNormals: Float32Array,
  n: number,
  quadrant: { x: number; y: number },
): Float32Array {
  const out = new Float32Array(n * n * 3);
  const last = n - 1;
  for (let row = 0; row < n; row++) {
    // This tile's vertex row in the parent's vertex grid: half the spacing, offset by the quadrant.
    const pr = (quadrant.y * last + row) / 2;
    const r0 = Math.min(Math.floor(pr), last - 1);
    const fr = pr - r0;
    for (let col = 0; col < n; col++) {
      const pc = (quadrant.x * last + col) / 2;
      const c0 = Math.min(Math.floor(pc), last - 1);
      const fc = pc - c0;
      const k00 = (r0 * n + c0) * 3;
      const k10 = k00 + 3;
      const k01 = k00 + n * 3;
      const k11 = k01 + 3;
      const w00 = (1 - fc) * (1 - fr);
      const w10 = fc * (1 - fr);
      const w01 = (1 - fc) * fr;
      const w11 = fc * fr;
      const x =
        w00 * parentNormals[k00]! +
        w10 * parentNormals[k10]! +
        w01 * parentNormals[k01]! +
        w11 * parentNormals[k11]!;
      const y =
        w00 * parentNormals[k00 + 1]! +
        w10 * parentNormals[k10 + 1]! +
        w01 * parentNormals[k01 + 1]! +
        w11 * parentNormals[k11 + 1]!;
      const z =
        w00 * parentNormals[k00 + 2]! +
        w10 * parentNormals[k10 + 2]! +
        w01 * parentNormals[k01 + 2]! +
        w11 * parentNormals[k11 + 2]!;
      const len = Math.hypot(x, y, z) || 1;
      const k = (row * n + col) * 3;
      out[k] = x / len;
      out[k + 1] = y / len;
      out[k + 2] = z / len;
    }
  }
  return out;
}

/**
 * A per-vertex field (`components` values per vertex, rows from the tile's lowest y, as above) in
 * the vertex order of the rotated PlaneGeometry, whose first row is the tile's highest y.
 */
export function toPlaneVertexOrder(
  field: Float32Array,
  n: number,
  components: number,
): Float32Array {
  const out = new Float32Array(field.length);
  for (let row = 0; row < n; row++) {
    const src = (n - 1 - row) * n * components;
    out.set(field.subarray(src, src + n * components), row * n * components);
  }
  return out;
}

/**
 * The mesh of one tile: a plane of (size_px - 1)² vertices over `size_x` × `size_y` m centred on the
 * origin (the caller places it), heights from tileVertexHeightsM, normals from the samples and the
 * parent's normals (`normalCoarse`, for the shader's level-of-detail blend), all in plane order.
 */
export function buildTileGeometry(
  tile: TileData,
  size_x_m: number,
  size_y_m: number,
  parent?: { tile: TileData; quadrant: { x: number; y: number } },
): THREE.BufferGeometry {
  const n = tile.size_px - 1;
  const geom = new THREE.PlaneGeometry(size_x_m, size_y_m, n - 1, n - 1);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const heights = toPlaneVertexOrder(tileVertexHeightsM(tile), n, 1);
  for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i] ?? 0);
  pos.needsUpdate = true;
  const cell_x = size_x_m / (tile.size_px - 2);
  const cell_y = size_y_m / (tile.size_px - 2);
  const own = tileVertexNormals(tile, cell_x, cell_y);
  const coarse = parent
    ? resampleParentNormals(
        tileVertexNormals(parent.tile, 2 * cell_x, 2 * cell_y),
        n,
        parent.quadrant,
      )
    : own;
  geom.setAttribute("normal", new THREE.BufferAttribute(toPlaneVertexOrder(own, n, 3), 3));
  geom.setAttribute("normalCoarse", new THREE.BufferAttribute(toPlaneVertexOrder(coarse, n, 3), 3));
  return geom;
}
