import * as THREE from "three";
import type { TileCoord, TileManifest, TileSource } from "@sightline/contracts";
import { getCachedTile } from "./tileCache";
import { levelCellM, terrainHeightAtM } from "./terrainHeight";

/**
 * Heights for the drawn shadows: three square textures centred on the site, each at the sample
 * spacing of one pyramid level, so the shader can march the Sun's ray from metres to the edge of the
 * map at a resolution that matches the step (near: level 9, about 19 m; mid: level 6, about 150 m;
 * far: level 3, about 1.2 km, the whole ±304 km). Visual only: the engine's horizon decides the
 * numbers.
 */
export const CLIP_TEXELS = 512;
export const CLIP_LEVELS = [9, 6, 3] as const;
/** Height written where no tile has arrived: far below any terrain, so it casts no shadow. */
export const NO_HEIGHT_M = -1e5;

export interface ClipRect {
  level: number;
  x_min: number;
  y_min: number;
  texel_m: number;
}

/**
 * The clip at `level` around (cx, cy): texel = the level's sample spacing, origin snapped to the
 * texel grid so the field does not swim when the centre moves a little.
 */
export function clipRect(
  manifest: TileManifest,
  level: number,
  cx_m: number,
  cy_m: number,
): ClipRect {
  const lvl = Math.min(level, manifest.level_count - 1);
  const texel_m = levelCellM(manifest, lvl);
  const half_m = (CLIP_TEXELS / 2) * texel_m;
  return {
    level: lvl,
    x_min: Math.round((cx_m - half_m) / texel_m) * texel_m,
    y_min: Math.round((cy_m - half_m) / texel_m) * texel_m,
    texel_m,
  };
}

/** The tiles at the clip's level that it overlaps (inside the pyramid). */
export function clipTileCoords(manifest: TileManifest, rect: ClipRect): TileCoord[] {
  const b = manifest.bounds_m;
  const n = 2 ** rect.level;
  const size_x = (b.x_max_m - b.x_min_m) / n;
  const size_y = (b.y_max_m - b.y_min_m) / n;
  const extent = CLIP_TEXELS * rect.texel_m;
  const clampIndex = (v: number) => Math.min(Math.max(v, 0), n - 1);
  const x0 = clampIndex(Math.floor((rect.x_min - b.x_min_m) / size_x));
  const x1 = clampIndex(Math.floor((rect.x_min + extent - b.x_min_m) / size_x));
  const y0 = clampIndex(Math.floor((rect.y_min - b.y_min_m) / size_y));
  const y1 = clampIndex(Math.floor((rect.y_min + extent - b.y_min_m) / size_y));
  const out: TileCoord[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) out.push({ level: rect.level, x, y });
  return out;
}

/**
 * Fills `out` (CLIP_TEXELS², row 0 at y_min) with the terrain height at each texel centre from the
 * finest loaded tile no finer than the clip's level; NO_HEIGHT_M where nothing has arrived. Returns
 * the highest height written.
 */
export function rasterizeClip(
  source: TileSource,
  manifest: TileManifest,
  rect: ClipRect,
  out: Float32Array,
): number {
  let max = NO_HEIGHT_M;
  for (let row = 0; row < CLIP_TEXELS; row++) {
    const y = rect.y_min + (row + 0.5) * rect.texel_m;
    for (let col = 0; col < CLIP_TEXELS; col++) {
      const x = rect.x_min + (col + 0.5) * rect.texel_m;
      const h = terrainHeightAtM(source, manifest, x, y, rect.level) ?? NO_HEIGHT_M;
      out[row * CLIP_TEXELS + col] = h;
      if (h > max) max = h;
    }
  }
  return max;
}

/**
 * Loads `coords`; for each that the pyramid lacks (it is sparse at the fine levels) asks for its
 * parent instead, down to `min_level`, so the clip gets the finest heights that exist.
 */
export async function loadWithFallback(
  source: TileSource,
  coords: TileCoord[],
  min_level: number,
): Promise<void> {
  let pending = coords;
  while (pending.length > 0) {
    const results = await Promise.allSettled(pending.map((c) => getCachedTile(source, c)));
    const parents = new Map<string, TileCoord>();
    results.forEach((r, i) => {
      const c = pending[i]!;
      if (r.status === "rejected" && c.level > min_level) {
        const p = { level: c.level - 1, x: Math.floor(c.x / 2), y: Math.floor(c.y / 2) };
        parents.set(`${p.level}_${p.x}_${p.y}`, p);
      }
    });
    pending = [...parents.values()];
  }
}

export interface ShadowClip {
  rect: ClipRect;
  heights: Float32Array;
  texture: THREE.DataTexture;
  max_m: number;
}

/**
 * The three clips for one centre. `update` asks for the tiles they need and rasterizes again when
 * they arrive; the textures are shared with every terrain tile's material.
 */
export class ShadowField {
  readonly clips: ShadowClip[];
  private center: { x: number; y: number } | null = null;
  private generation = 0;

  constructor(
    private readonly source: TileSource,
    private readonly manifest: TileManifest,
  ) {
    this.clips = CLIP_LEVELS.map((level) => {
      const heights = new Float32Array(CLIP_TEXELS * CLIP_TEXELS).fill(NO_HEIGHT_M);
      const texture = new THREE.DataTexture(
        heights,
        CLIP_TEXELS,
        CLIP_TEXELS,
        THREE.RedFormat,
        THREE.FloatType,
      );
      texture.needsUpdate = true;
      return { rect: clipRect(manifest, level, 0, 0), heights, texture, max_m: NO_HEIGHT_M };
    });
  }

  /** Highest terrain in any clip (m), for the shader's early exit. */
  get maxHeightM(): number {
    return Math.max(...this.clips.map((c) => c.max_m));
  }

  /** Re-centre on (x, y) (tile plane, m) if it moved more than 1 m; tiles load in the background. */
  setCenter(x_m: number, y_m: number, onChange: () => void): void {
    if (this.center && Math.hypot(this.center.x - x_m, this.center.y - y_m) < 1) return;
    this.center = { x: x_m, y: y_m };
    const generation = ++this.generation;
    // Coarse first: the far clip covers everything, so the shadows are right in outline at once.
    for (const clip of [...this.clips].reverse()) {
      clip.rect = clipRect(this.manifest, clip.rect.level, x_m, y_m);
      this.rasterize(clip);
      onChange();
      const wanted = clipTileCoords(this.manifest, clip.rect);
      const min_level = Math.max(0, clip.rect.level - 3);
      void loadWithFallback(this.source, wanted, min_level).then(() => {
        if (generation !== this.generation) return;
        this.rasterize(clip);
        onChange();
      });
    }
  }

  private rasterize(clip: ShadowClip): void {
    clip.max_m = rasterizeClip(this.source, this.manifest, clip.rect, clip.heights);
    clip.texture.needsUpdate = true;
  }

  dispose(): void {
    this.generation++;
    for (const clip of this.clips) clip.texture.dispose();
  }
}
