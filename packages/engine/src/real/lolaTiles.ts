import {
  TileManifestSchema,
  isTileCoordInRange,
  type TileCoord,
  type TileData,
  type TileManifest,
  type TileSource,
} from "@sightline/contracts";
import bundledCoverage from "../data/tiles/coverage.json";
import bundledManifest from "../data/tiles/manifest.json";

/**
 * Real LOLA terrain tiles (M1-04), written by `sightline tiles` (pipeline/sightline_pipeline/
 * tiles.py documents the file layout and the sparse pyramid: levels 0-7 from the 80 m map
 * everywhere, levels 8-11 from the three 5 m site DEMs only under them).
 *
 * The engine has no file access: the host supplies `readTile`, which returns the bytes of
 * `<level>/<x>/<y>.bin`. The default reads `<baseUrl>/<level>/<x>/<y>.bin` with `fetch`.
 */

const DEFAULT_TILE_BASE_URL = "/api/tiles";
const MAGIC = [0x53, 0x4c, 0x54, 0x31]; // "SLT1"
const HEADER_BYTES = 32;

/** One inclusive rectangle of tiles at one level that exist. */
export interface TileRect {
  level: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface TileCoverage {
  data_version: string;
  rects: TileRect[];
}

/** The tile exists in the pyramid's bounds but not in this data set (a 5 m level away from a site,
 * or a tile that is not in the bundled subset). `RangeError` means outside the pyramid. */
export class TileNotAvailableError extends Error {
  constructor(coord: TileCoord) {
    super(`tile ${coord.level}/${coord.x}/${coord.y} is not in this tile set`);
    this.name = "TileNotAvailableError";
  }
}

export function parseCoverage(doc: unknown): TileCoverage {
  const fail = (why: string): never => {
    throw new Error(`tile coverage: ${why}`);
  };
  if (typeof doc !== "object" || doc === null) return fail("not an object");
  const d = doc as { schema_version?: unknown; data_version?: unknown; rects?: unknown };
  if (d.schema_version !== 1) fail("schema_version must be 1");
  if (typeof d.data_version !== "string") fail("data_version must be a string");
  if (!Array.isArray(d.rects)) return fail("rects must be an array");
  const rects = d.rects.map((r: unknown): TileRect => {
    const q = r as Record<string, unknown>;
    for (const k of ["level", "x_min", "x_max", "y_min", "y_max"]) {
      if (!Number.isInteger(q[k]) || (q[k] as number) < 0)
        fail(`rect.${k} must be an integer >= 0`);
    }
    const rect = q as unknown as TileRect;
    if (rect.x_max < rect.x_min || rect.y_max < rect.y_min) fail("a rect is empty");
    return {
      level: rect.level,
      x_min: rect.x_min,
      x_max: rect.x_max,
      y_min: rect.y_min,
      y_max: rect.y_max,
    };
  });
  return { data_version: d.data_version as string, rects };
}

/**
 * Decode one tile file. The header must agree with the coordinate asked for and with the manifest,
 * so a file served under the wrong name, a truncated download or an HTML error page fails loudly.
 */
export function parseTileBytes(
  bytes: Uint8Array,
  coord: TileCoord,
  manifest: TileManifest,
): TileData {
  const n = manifest.tile_size_px;
  const where = `tile ${coord.level}/${coord.x}/${coord.y}`;
  if (bytes.byteLength !== HEADER_BYTES + 2 * n * n) {
    throw new Error(`${where}: ${bytes.byteLength} bytes, expected ${HEADER_BYTES + 2 * n * n}`);
  }
  if (MAGIC.some((m, i) => bytes[i] !== m)) throw new Error(`${where}: not a SLT1 tile file`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = {
    level: view.getUint16(4, true),
    size_px: view.getUint16(6, true),
    x: view.getUint32(8, true),
    y: view.getUint32(12, true),
  };
  if (
    header.level !== coord.level ||
    header.x !== coord.x ||
    header.y !== coord.y ||
    header.size_px !== n
  ) {
    throw new Error(
      `${where}: the file says ${header.level}/${header.x}/${header.y} at ${header.size_px} px`,
    );
  }
  const offset_m = view.getFloat64(16, true);
  const scale_m = view.getFloat64(24, true);
  if (!Number.isFinite(offset_m) || !(scale_m > 0) || !Number.isFinite(scale_m)) {
    throw new Error(`${where}: bad offset or scale in the header`);
  }
  // Read through DataView: the file is little-endian and `Uint8Array.byteOffset` may be odd.
  const heights = new Uint16Array(n * n);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = view.getUint16(HEADER_BYTES + 2 * i, true);
  }
  return {
    coord: { level: coord.level, x: coord.x, y: coord.y },
    size_px: n,
    offset_m,
    scale_m,
    heights,
    simulated: manifest.simulated,
  };
}

/** Lowest and highest decoded height of a tile (the contract's `TileData` carries no range). */
export function tileHeightRange(tile: TileData): { min_m: number; max_m: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of tile.heights) {
    if (c < lo) lo = c;
    if (c > hi) hi = c;
  }
  return { min_m: tile.offset_m + tile.scale_m * lo, max_m: tile.offset_m + tile.scale_m * hi };
}

export interface LolaTileSourceOptions {
  /** Bytes of `<level>/<x>/<y>.bin`. Default: `fetch` from `baseUrl`. */
  readTile?: (path: string) => Promise<Uint8Array>;
  /** Used by the default `readTile`; no trailing slash needed. Default "/api/tiles", the route the
   * web app serves them from (apps/web/app/api/tiles). */
  baseUrl?: string;
  /** Which tiles exist. Default: the subset committed with the engine (levels 0-3 and the tile
   * under each catalog site at levels 7-11). Pass the full pyramid's `coverage.json` when the host
   * serves the full pyramid. */
  coverage?: TileCoverage;
  manifest?: TileManifest;
}

/** The `coverage.json` served next to the tiles: which tiles exist there (the full pyramid's when
 * the host has it). The bundled default lists only the committed subset. */
export async function fetchTileCoverage(
  baseUrl: string = DEFAULT_TILE_BASE_URL,
): Promise<TileCoverage> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/coverage.json`);
  if (!res.ok) throw new Error(`tile coverage: HTTP ${res.status}`);
  return parseCoverage(await res.json());
}

function fetchReader(baseUrl: string): (path: string) => Promise<Uint8Array> {
  const base = baseUrl.replace(/\/+$/, "");
  return async (path) => {
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) throw new Error(`tile ${path}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}

export class LolaTileSource implements TileSource {
  private readonly manifest: TileManifest;
  private readonly rectsByLevel: Map<number, TileRect[]> = new Map();
  private readonly readTile: (path: string) => Promise<Uint8Array>;

  constructor(options: LolaTileSourceOptions = {}) {
    this.manifest = TileManifestSchema.parse(options.manifest ?? bundledManifest);
    if (this.manifest.simulated)
      throw new Error("LolaTileSource needs a real (non-simulated) manifest");
    const coverage = options.coverage ?? parseCoverage(bundledCoverage);
    for (const r of coverage.rects) {
      const list = this.rectsByLevel.get(r.level) ?? [];
      list.push(r);
      this.rectsByLevel.set(r.level, list);
    }
    this.readTile = options.readTile ?? fetchReader(options.baseUrl ?? DEFAULT_TILE_BASE_URL);
  }

  getManifest(): Promise<TileManifest> {
    return Promise.resolve(structuredClone(this.manifest));
  }

  /** Whether the tile is in this data set. Not part of `TileSource`: the pyramid is sparse. */
  hasTile(coord: TileCoord): boolean {
    if (!isTileCoordInRange(this.manifest, coord)) return false;
    return (this.rectsByLevel.get(coord.level) ?? []).some(
      (r) => coord.x >= r.x_min && coord.x <= r.x_max && coord.y >= r.y_min && coord.y <= r.y_max,
    );
  }

  async getTile(coord: TileCoord): Promise<TileData> {
    if (!isTileCoordInRange(this.manifest, coord)) {
      throw new RangeError(`tile ${coord.level}/${coord.x}/${coord.y} is outside the pyramid`);
    }
    if (!this.hasTile(coord)) throw new TileNotAvailableError(coord);
    const bytes = await this.readTile(`${coord.level}/${coord.x}/${coord.y}.bin`);
    return parseTileBytes(bytes, coord, this.manifest);
  }
}

export function createLolaTileSource(options?: LolaTileSourceOptions): LolaTileSource {
  return new LolaTileSource(options);
}

export const BUNDLED_TILE_MANIFEST: Readonly<TileManifest> = Object.freeze(
  TileManifestSchema.parse(bundledManifest),
);
export const BUNDLED_TILE_COVERAGE: Readonly<TileCoverage> = Object.freeze(
  parseCoverage(bundledCoverage),
);
