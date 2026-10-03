import type { TileCoord, TileData, TileSource } from "@sightline/contracts";

const MAX_CACHED_TILES = 1000;

// One cache per tile source, so tiles of a mock source never answer for the real one.
const caches = new WeakMap<TileSource, Map<string, Promise<TileData>>>();
// The tiles that have arrived, for synchronous lookups (terrain height under the camera, shadows).
const loaded = new WeakMap<TileSource, Map<string, TileData>>();

export function tileKey(coord: TileCoord): string {
  return `${coord.level}_${coord.x}_${coord.y}`;
}

/** A tile that has already arrived, or undefined; never fetches. */
export function getLoadedTile(source: TileSource, coord: TileCoord): TileData | undefined {
  return loaded.get(source)?.get(tileKey(coord));
}

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
  const key = tileKey(coord);
  const hit = cache.get(key);
  if (hit) return hit;

  const own = cache;
  let arrived = loaded.get(source);
  if (!arrived) {
    arrived = new Map();
    loaded.set(source, arrived);
  }
  const ownLoaded = arrived;
  const promise = source.getTile(coord).then(
    (tile) => {
      if (own.get(key) === promise) ownLoaded.set(key, tile);
      return tile;
    },
    (e: unknown) => {
      own.delete(key);
      throw e;
    },
  );
  cache.set(key, promise);
  if (cache.size > MAX_CACHED_TILES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
      ownLoaded.delete(oldest);
    }
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
