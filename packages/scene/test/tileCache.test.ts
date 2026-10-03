import { describe, expect, it, vi } from "vitest";
import type { TileCoord, TileData, TileManifest, TileSource } from "@sightline/contracts";
import { childCoords, getCachedTile, loadChildTiles } from "../src/tileCache";

const tile = (coord: TileCoord): TileData => ({
  coord,
  size_px: 4,
  offset_m: 0,
  scale_m: 0.1,
  heights: new Uint16Array(16),
  simulated: true,
});

/** A tile source that answers every tile except those `missing` returns true for. */
function fakeSource(missing: (c: TileCoord) => boolean = () => false) {
  const getTile = vi.fn((c: TileCoord) =>
    missing(c)
      ? Promise.reject(new Error(`no tile ${c.level}/${c.x}/${c.y}`))
      : Promise.resolve(tile(c)),
  );
  const source: TileSource = {
    getManifest: () => Promise.reject(new Error("not used")) as Promise<TileManifest>,
    getTile,
  };
  return { source, getTile };
}

describe("getCachedTile", () => {
  it("fetches a tile once per source and coordinate", async () => {
    const { source, getTile } = fakeSource();
    const c = { level: 3, x: 1, y: 2 };
    const [a, b] = await Promise.all([getCachedTile(source, c), getCachedTile(source, c)]);
    await getCachedTile(source, c);
    expect(a).toBe(b);
    expect(getTile).toHaveBeenCalledTimes(1);
  });

  it("keeps sources apart: the same coordinate from another source is fetched again", async () => {
    const one = fakeSource();
    const two = fakeSource();
    const c = { level: 0, x: 0, y: 0 };
    await getCachedTile(one.source, c);
    await getCachedTile(two.source, c);
    expect(one.getTile).toHaveBeenCalledTimes(1);
    expect(two.getTile).toHaveBeenCalledTimes(1);
  });

  it("does not remember a failure: the next request asks again", async () => {
    let fail = true;
    const { source, getTile } = fakeSource(() => fail);
    const c = { level: 5, x: 4, y: 4 };
    await expect(getCachedTile(source, c)).rejects.toThrow(/no tile/);
    fail = false;
    await expect(getCachedTile(source, c)).resolves.toMatchObject({ coord: c });
    expect(getTile).toHaveBeenCalledTimes(2);
  });

  it("drops the oldest entry when more than 1000 tiles are held", async () => {
    const { source, getTile } = fakeSource();
    for (let x = 0; x < 1001; x++) await getCachedTile(source, { level: 11, x, y: 0 });
    getTile.mockClear();
    await getCachedTile(source, { level: 11, x: 1000, y: 0 }); // newest: still cached
    expect(getTile).not.toHaveBeenCalled();
    await getCachedTile(source, { level: 11, x: 0, y: 0 }); // oldest: gone
    expect(getTile).toHaveBeenCalledTimes(1);
  });
});

describe("children of a tile", () => {
  it("are the four tiles one level down, northern two first", () => {
    expect(childCoords({ level: 2, x: 1, y: 3 })).toEqual([
      { level: 3, x: 2, y: 7 },
      { level: 3, x: 3, y: 7 },
      { level: 3, x: 2, y: 6 },
      { level: 3, x: 3, y: 6 },
    ]);
  });

  it("load only when all four exist, so a parent keeps drawing itself over a sparse pyramid", async () => {
    const all = fakeSource();
    expect(await loadChildTiles(all.source, { level: 7, x: 10, y: 10 })).toBe(true);
    const oneMissing = fakeSource((c) => c.x === 21 && c.y === 20);
    expect(await loadChildTiles(oneMissing.source, { level: 7, x: 10, y: 10 })).toBe(false);
    const noneThere = fakeSource(() => true);
    expect(await loadChildTiles(noneThere.source, { level: 11, x: 0, y: 0 })).toBe(false);
  });
});
