import { describe, expect, it } from "vitest";
import type { TileData } from "@sightline/contracts";
import { createMockTileSource } from "@sightline/engine";
import * as THREE from "three";
import {
  buildTileGeometry,
  resampleParentNormals,
  tileVertexHeightsM,
  tileVertexNormals,
} from "../src/tileMesh";

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

describe("tileVertexNormals", () => {
  it("gives the analytic normal of a plane h = a x + b y", () => {
    // Sample (r, c) at x = (c - 0.5) cell_x, y = (r - 0.5) cell_y; raw heights in scale_m units.
    const cell_x = 40;
    const cell_y = 25;
    const scale = 0.5;
    const a = 0.3; // dh/dx
    const b = -0.1; // dh/dy
    const heights = new Uint16Array(64 * 64);
    for (let r = 0; r < 64; r++)
      for (let c = 0; c < 64; c++)
        heights[r * 64 + c] = Math.round((2000 + (a * c * cell_x + b * r * cell_y)) / scale);
    const tile: TileData = {
      coord: { level: 0, x: 0, y: 0 },
      size_px: 64,
      offset_m: 0,
      scale_m: scale,
      heights,
      simulated: true,
    };
    const normals = tileVertexNormals(tile, cell_x, cell_y);
    expect(normals).toHaveLength(N * N * 3);
    const len = Math.hypot(a, 1, b);
    for (const k of [0, 31 * N + 17, N * N - 1]) {
      // Rounding the heights to 0.5 m moves the gradient by under 0.0125 / 40 per step.
      expect(normals[3 * k]!).toBeCloseTo(-a / len, 2);
      expect(normals[3 * k + 1]!).toBeCloseTo(1 / len, 2);
      expect(normals[3 * k + 2]!).toBeCloseTo(b / len, 2);
    }
  });

  it("gives neighbouring tiles the same normals along their shared edge, to their rounding", async () => {
    const source = createMockTileSource();
    const manifest = await source.getManifest();
    const size = (manifest.bounds_m.x_max_m - manifest.bounds_m.x_min_m) / 2 ** 3;
    const cell = size / 62;
    const [tileHere, tileEast] = await Promise.all([
      source.getTile({ level: 3, x: 2, y: 4 }),
      source.getTile({ level: 3, x: 3, y: 4 }),
    ]);
    const here = tileVertexNormals(tileHere, cell, cell);
    const east = tileVertexNormals(tileEast, cell, cell);
    let worst = 0;
    for (let row = 0; row < N; row++) {
      const k = 3 * (row * N + (N - 1));
      const j = 3 * (row * N);
      for (let d = 0; d < 3; d++) worst = Math.max(worst, Math.abs(here[k + d]! - east[j + d]!));
    }
    // Each tile stores the shared samples rounded to its own scale (±scale/2 each), so one gradient
    // can move by 4 · (scale/2) / (2 cell) = scale / cell; a normal component moves by no more.
    const bound = (tileHere.scale_m + tileEast.scale_m) / cell;
    expect(worst).toBeLessThan(bound);
    expect(worst).toBeGreaterThan(0); // the tiles really are rounded apart, so the bound is the test
    expect(bound).toBeLessThan(0.01);
  });
});

describe("resampleParentNormals", () => {
  it("reproduces the parent's normals at the vertices the child shares with it", () => {
    const n = 63;
    const parent = new Float32Array(n * n * 3);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const v = [Math.sin(r * 0.1), 1, Math.cos(c * 0.07)];
        const len = Math.hypot(v[0]!, v[1]!, v[2]!);
        parent.set(
          v.map((x) => x / len),
          (r * n + c) * 3,
        );
      }
    // North-east child: its vertex (2r, 2c) is the parent's vertex (31 + r, 31 + c).
    const child = resampleParentNormals(parent, n, { x: 1, y: 1 });
    for (const [r, c] of [
      [0, 0],
      [10, 20],
      [31, 31],
    ] as const) {
      const k = (2 * r * n + 2 * c) * 3;
      const p = ((31 + r) * n + 31 + c) * 3;
      for (let d = 0; d < 3; d++) expect(child[k + d]!).toBeCloseTo(parent[p + d]!, 6);
    }
    // South-west child: its vertex (0, 0) is the parent's (0, 0).
    const sw = resampleParentNormals(parent, n, { x: 0, y: 0 });
    for (let d = 0; d < 3; d++) expect(sw[d]!).toBeCloseTo(parent[d]!, 6);
  });
});

describe("buildTileGeometry", () => {
  it("puts each normal on its own vertex: it agrees with the normals of the mesh's own faces", async () => {
    const source = createMockTileSource();
    const manifest = await source.getManifest();
    const size = (manifest.bounds_m.x_max_m - manifest.bounds_m.x_min_m) / 2 ** 3;
    const tile = await source.getTile({ level: 3, x: 2, y: 4 });
    const geom = buildTileGeometry(tile, size, size);
    const ours = (geom.getAttribute("normal") as THREE.BufferAttribute).clone();
    geom.computeVertexNormals();
    const faces = geom.getAttribute("normal") as THREE.BufferAttribute;
    let sum = 0;
    let count = 0;
    for (let row = 1; row < N - 1; row++)
      for (let col = 1; col < N - 1; col++) {
        const i = row * N + col;
        const dot =
          ours.getX(i) * faces.getX(i) +
          ours.getY(i) * faces.getY(i) +
          ours.getZ(i) * faces.getZ(i);
        sum += Math.acos(Math.min(1, dot));
        count++;
      }
    // Same surface, two estimates of its slope (four samples vs the six faces around a vertex): they
    // differ at sharp kinks of the mock, so the mean is the measure. With the rows in the wrong order
    // the normals belong to the mirrored tile and the mean is many degrees.
    expect(sum / count).toBeLessThan((0.5 * Math.PI) / 180);
  });
});
