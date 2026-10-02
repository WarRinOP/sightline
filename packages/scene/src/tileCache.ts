import type { TileCoord, TileData, TileSource } from "@sightline/contracts";

const MAX_CACHED_TILES = 1000;

// One cache per tile source, so tiles of a mock source never answer for the real one.
const caches = new WeakMap<TileSource, Map<string, Promise<TileData>>>();

/**
 * A tile by coordinate, fetched once per source. A failed fetch leaves the cache, so a later request
 * asks again; when the cache is full the oldest entry goes (insertion order, not true LRU).
 */
export function getCachedTile(source: TileSource, coord: TileCoord): Promise<TileData> {
  let cache = caches.get(source);
  if (!cache) {
    cache = new Map();
    caches.set(source, cache);
  }
  const key = `${coord.level}_${coord.x}_${coord.y}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const own = cache;
  const promise = source.getTile(coord).catch((e: unknown) => {
    own.delete(key);
    throw e;
  });
  cache.set(key, promise);
  if (cache.size > MAX_CACHED_TILES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return promise;
}

/** The four children of a quadtree tile (y up: the first two are the northern ones). */
export function childCoords(coord: TileCoord): TileCoord[] {
  const level = coord.level + 1;
  return [
    { level, x: coord.x * 2, y: coord.y * 2 + 1 },
    { level, x: coord.x * 2 + 1, y: coord.y * 2 + 1 },
    { level, x: coord.x * 2, y: coord.y * 2 },
    { level, x: coord.x * 2 + 1, y: coord.y * 2 },
  ];
}

/**
 * Whether all four children load. The pyramid is sparse (a deployed site has only a few tiles at the
 * fine levels), so a parent must keep drawing itself unless every child is there.
 */
export async function loadChildTiles(source: TileSource, coord: TileCoord): Promise<boolean> {
  const results = await Promise.allSettled(childCoords(coord).map((c) => getCachedTile(source, c)));
  return results.every((r) => r.status === "fulfilled");
}
