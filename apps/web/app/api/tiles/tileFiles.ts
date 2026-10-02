import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where the tile files are. `next dev`, `next build` and `next start` all run with the working
 * directory at `apps/web`. The full pyramid (`sightline tiles`, gitignored) wins when it exists;
 * otherwise the subset committed with the engine is served (D-028).
 */
const REPO_ROOT = path.resolve(process.cwd(), "../..");
export const TILE_DIRS: readonly string[] = [
  // Not traced into the build: it is a local dev convenience of 262 MB, absent where it is deployed.
  path.join(/* turbopackIgnore: true */ REPO_ROOT, "data", "processed", "tiles"),
  path.join(REPO_ROOT, "packages", "engine", "src", "data", "tiles"),
];

export type TileMetaFile = "manifest.json" | "coverage.json";

/** `<level>/<x>/<y>.bin` for plain decimal numbers only, else null: the value goes into a path. */
export function tileRelPath(level: string, x: string, yFile: string): string | null {
  const y = /^(\d{1,7})\.bin$/.exec(yFile)?.[1];
  if (!/^\d{1,2}$/.test(level) || !/^\d{1,7}$/.test(x) || y === undefined) return null;
  return `${Number(level)}/${Number(x)}/${Number(y)}.bin`;
}

/** The file's bytes from the first directory that has it, or null. */
export async function readTileFile(
  relPath: string,
  dirs: readonly string[] = TILE_DIRS,
): Promise<Buffer | null> {
  for (const dir of dirs) {
    try {
      return await readFile(path.join(dir, relPath));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return null;
}

/** `manifest.json` or `coverage.json` of the tile set being served: the full pyramid's when it is
 * present, so a client can tell which tiles exist. Each has its own static route, because Next
 * does not allow `[level]` and another dynamic segment side by side. */
export async function tileMetaResponse(name: TileMetaFile): Promise<Response> {
  const bytes = await readTileFile(name);
  if (bytes === null) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
