import { z } from "zod";
import { MOON_REFERENCE_RADIUS_M } from "./common";
import { ProvenanceRecordSchema } from "./provenance";

/**
 * Quadtree level 0 is one tile covering `bounds_m`; level L has 2^L by 2^L tiles.
 * Tile x grows with projected x (east in the polar-stereographic plane) and y grows with
 * projected y (north), not in image-row order.
 */
export const TileCoordSchema = z.object({
  level: z.number().int().nonnegative(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type TileCoord = z.infer<typeof TileCoordSchema>;

export const TileManifestSchema = z
  .object({
    schema_version: z.literal(1),
    data_version: z.string().min(1),
    projection: z.literal("polar_stereographic_south"),
    moon_radius_m: z.literal(MOON_REFERENCE_RADIUS_M),
    /** Extent of level 0 in projected meters, pole at the origin. */
    bounds_m: z.object({
      x_min_m: z.number(),
      y_min_m: z.number(),
      x_max_m: z.number(),
      y_max_m: z.number(),
    }),
    /** Samples per tile side, including the border. */
    tile_size_px: z.number().int().min(4).max(4096),
    /** Overlap samples on each side so neighbours interpolate without seams. */
    border_px: z.number().int().nonnegative(),
    /** Levels are 0 .. level_count - 1. */
    level_count: z.number().int().positive(),
    height_encoding: z.literal("uint16_offset"),
    /** Meters per count: height_m = offset_m + scale_m * count (M1-04 uses 0.1 m). */
    height_scale_m: z.number().positive(),
    simulated: z.boolean(),
    provenance: ProvenanceRecordSchema,
  })
  .refine(
    (m) => m.bounds_m.x_max_m > m.bounds_m.x_min_m && m.bounds_m.y_max_m > m.bounds_m.y_min_m,
    {
      message: "bounds_m must have positive extent",
      path: ["bounds_m"],
    },
  )
  .refine((m) => m.tile_size_px > 2 * m.border_px, {
    message: "tile_size_px must leave interior samples after the border",
    path: ["border_px"],
  })
  .refine((m) => m.simulated === m.provenance.simulated, {
    message: "simulated must match provenance.simulated",
    path: ["simulated"],
  });
export type TileManifest = z.infer<typeof TileManifestSchema>;

/** One decoded tile: `heights[row * size_px + col]`, row 0 at the tile's y_min edge. */
export const TileDataSchema = z
  .object({
    coord: TileCoordSchema,
    size_px: z.number().int().positive(),
    offset_m: z.number().finite(),
    scale_m: z.number().positive(),
    heights: z.instanceof(Uint16Array),
    simulated: z.boolean(),
  })
  .refine((t) => t.heights.length === t.size_px * t.size_px, {
    message: "heights must hold size_px * size_px samples",
    path: ["heights"],
  });
export type TileData = z.infer<typeof TileDataSchema>;

export function isTileCoordInRange(manifest: TileManifest, coord: TileCoord): boolean {
  const tilesPerSide = 2 ** coord.level;
  return coord.level < manifest.level_count && coord.x < tilesPerSide && coord.y < tilesPerSide;
}

/** Ground sample distance (m per sample) of the interior samples at `level`. */
export function tileGsdM(manifest: TileManifest, level: number): number {
  const extent_m = manifest.bounds_m.x_max_m - manifest.bounds_m.x_min_m;
  const interior_px = manifest.tile_size_px - 2 * manifest.border_px;
  return extent_m / 2 ** level / interior_px;
}
