import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TileManifestSchema } from "@sightline/contracts";
import {
  createLolaTileSource,
  fetchTileCoverage,
  parseCoverage,
  parseTileBytes,
} from "@sightline/engine";
import { GET as getTile, generateStaticParams } from "../app/api/tiles/[level]/[x]/[y]/route";
import { GET as getCoverage } from "../app/api/tiles/coverage.json/route";
import { GET as getManifest } from "../app/api/tiles/manifest.json/route";
import { TILE_DIRS, readTileFile, tileRelPath } from "../app/api/tiles/tileFiles";

const FIXTURES = TILE_DIRS[1]!;
const call = (level: string, x: string, y: string) =>
  getTile(new Request("http://test.invalid/"), { params: Promise.resolve({ level, x, y }) });

describe("tile path parsing", () => {
  it("accepts plain decimal coordinates and nothing that could leave the tile directory", () => {
    expect(tileRelPath("7", "61", "61.bin")).toBe("7/61/61.bin");
    expect(tileRelPath("07", "061", "0061.bin")).toBe("7/61/61.bin");
    for (const bad of [
      ["..", "0", "0.bin"],
      ["0", "..", "0.bin"],
      ["0", "0", "..%2f..%2fpackage.bin"],
      ["0", "0", "0"],
      ["0", "0", "0.bin/../x"],
      ["0", "0", "0.json"],
      ["0", "0", "-1.bin"],
      ["123", "0", "0.bin"],
      ["0", "99999999", "0.bin"],
      ["0", "", "0.bin"],
    ] as const) {
      expect(tileRelPath(bad[0], bad[1], bad[2]), bad.join("/")).toBeNull();
    }
  });

  it("reads the first directory that has the file, then the next, else null", async () => {
    const a = await mkdtemp(path.join(tmpdir(), "tiles-a-"));
    const b = await mkdtemp(path.join(tmpdir(), "tiles-b-"));
    await mkdir(path.join(a, "5", "1"), { recursive: true });
    await mkdir(path.join(b, "5", "1"), { recursive: true });
    await writeFile(path.join(a, "5", "1", "2.bin"), "from-a");
    await writeFile(path.join(b, "5", "1", "2.bin"), "from-b");
    await writeFile(path.join(b, "5", "1", "3.bin"), "only-b");
    expect((await readTileFile("5/1/2.bin", [a, b]))?.toString()).toBe("from-a");
    expect((await readTileFile("5/1/3.bin", [a, b]))?.toString()).toBe("only-b");
    expect(await readTileFile("5/1/4.bin", [a, b])).toBeNull();
    expect(await readTileFile("5/1/4.bin", [path.join(a, "nowhere")])).toBeNull();
  });
});

describe("/api/tiles routes", () => {
  it("builds the committed tiles in, one static path per tile", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(100);
    expect(params).toContainEqual({ level: "0", x: "0", y: "0.bin" });
    expect(params.every((p) => /^\d+\.bin$/.test(p.y))).toBe(true);
  });

  it("serves the bytes of a committed tile unchanged", async () => {
    const res = await call("3", "2", "4.bin");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(new Uint8Array(await readFile(path.join(FIXTURES, "3/2/4.bin"))));
    expect(body.byteLength).toBe(8224);
  });

  it("answers 404 for a tile that is not there and for a bad path", async () => {
    expect((await call("11", "0", "0.bin")).status).toBe(404);
    expect((await call("..", "0", "0.bin")).status).toBe(404);
    expect((await call("0", "0", "0")).status).toBe(404);
  });

  it("serves manifest.json and coverage.json", async () => {
    const manifest = await getManifest();
    expect(manifest.headers.get("Content-Type")).toBe("application/json");
    expect(TileManifestSchema.safeParse(await manifest.json()).success).toBe(true);
    // the full pyramid's coverage when it is built here, else the committed subset's: both list 0/0/0
    const coverage = parseCoverage(await (await getCoverage()).json());
    expect(coverage.rects).toContainEqual(
      expect.objectContaining({ level: 0, x_min: 0, x_max: 0, y_min: 0, y_max: 0 }),
    );
  });
});

describe("the engine's tile source over these routes", () => {
  it("gets a tile through the route exactly as through the file", async () => {
    const source = createLolaTileSource({
      readTile: async (p) => {
        const [level, x, yFile] = p.split("/") as [string, string, string];
        return new Uint8Array(await (await call(level, x, yFile)).arrayBuffer());
      },
    });
    const tile = await source.getTile({ level: 7, x: 61, y: 61 });
    const manifest = await source.getManifest();
    const direct = parseTileBytes(
      new Uint8Array(await readFile(path.join(FIXTURES, "7/61/61.bin"))),
      { level: 7, x: 61, y: 61 },
      manifest,
    );
    expect(tile.heights).toEqual(direct.heights);
    expect(tile.simulated).toBe(false);
  });

  it("with no options, asks /api/tiles, and reads the coverage from there", async () => {
    const fetchMock = vi.fn((url: string) => {
      const [level, x, y] = url.replace("/api/tiles/", "").split("/") as [string, string, string];
      return call(level, x, y);
    });
    vi.stubGlobal("fetch", (url: string) =>
      url.endsWith("coverage.json") ? getCoverage() : fetchMock(url),
    );
    try {
      const tile = await createLolaTileSource().getTile({ level: 0, x: 0, y: 0 });
      expect(fetchMock).toHaveBeenCalledWith("/api/tiles/0/0/0.bin");
      expect(tile.size_px).toBe(64);
      const coverage = await fetchTileCoverage();
      expect(coverage.rects.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("route structure", () => {
  // `next build` accepts `[level]` next to `[name]` but `next start` then fails every request, the
  // home page included. This test stands in for a server check in CI.
  it("has at most one dynamic segment name among any directory's children", async () => {
    const appDir = fileURLToPath(new URL("../app/", import.meta.url));
    const clashes: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      const dynamic = dirs.filter((e) => /^\[.+\]$/.test(e.name));
      if (dynamic.length > 1) clashes.push(`${dir}: ${dynamic.map((e) => e.name).join(", ")}`);
      for (const e of dirs) await walk(path.join(dir, e.name));
    };
    await walk(appDir);
    expect(clashes).toEqual([]);
  });
});
