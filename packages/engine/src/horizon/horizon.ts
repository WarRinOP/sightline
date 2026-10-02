import {
  HorizonMaskSchema,
  ProvenanceRecordSchema,
  type HorizonMask,
  type Location,
  type ProvenanceRecord,
} from "@sightline/contracts";
import { MOON_REFERENCE_RADIUS_KM } from "../frames";

const TWO_PI = 2 * Math.PI;
// A catalog site is matched by position, not by id, because the engine is asked about locations.
// 2 m is a few hundredths of a DEM pixel's worth of terrain change; the catalog rounds to 3 cm.
const MATCH_DISTANCE_M = 2;
const MATCH_ELEVATION_M = 1;

/** The file written by `sightline horizon`: masks for one site at a grid of mast heights. */
export interface HorizonFile {
  schema_version: 1;
  site_id: string;
  location: { lat_rad: number; lon_rad: number; elev_m: number };
  azimuth_samples: number;
  azimuth_step_rad: number;
  mast_heights_m: number[];
  /** One row per mast height, `azimuth_samples` values each; index i is azimuth i * step. */
  mask_elevation_rad: number[][];
  provenance: ProvenanceRecord;
}

export function parseHorizonFile(raw: unknown): HorizonFile {
  const doc = raw as Partial<HorizonFile> | null;
  if (doc?.schema_version !== 1) throw new TypeError("horizon file: expected schema_version 1");
  const { site_id, location, azimuth_samples, azimuth_step_rad, mast_heights_m } = doc;
  const rows = doc.mask_elevation_rad;
  if (
    typeof site_id !== "string" ||
    !location ||
    typeof azimuth_samples !== "number" ||
    typeof azimuth_step_rad !== "number" ||
    !Array.isArray(mast_heights_m) ||
    !Array.isArray(rows)
  ) {
    throw new TypeError("horizon file: missing fields");
  }
  if (Math.round(TWO_PI / azimuth_step_rad) !== azimuth_samples) {
    throw new RangeError("horizon file: azimuth_step_rad does not divide the circle");
  }
  if (rows.length !== mast_heights_m.length || mast_heights_m.length < 2) {
    throw new RangeError("horizon file: one mask row per mast height, at least two");
  }
  if (
    mast_heights_m[0] !== 0 ||
    mast_heights_m.some((h, i) => i > 0 && h <= (mast_heights_m[i - 1] ?? 0))
  ) {
    throw new RangeError("horizon file: mast heights must start at 0 and increase");
  }
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== azimuth_samples || !row.every(Number.isFinite)) {
      throw new RangeError("horizon file: a mask row has the wrong length or a non-finite value");
    }
  }
  return {
    schema_version: 1,
    site_id,
    location,
    azimuth_samples,
    azimuth_step_rad,
    mast_heights_m: mast_heights_m as number[],
    mask_elevation_rad: rows as number[][],
    provenance: ProvenanceRecordSchema.parse(doc.provenance),
  };
}

/** Wrap an azimuth into [0, 2π) without ever returning 2π itself. */
function wrapAzimuth(az: number): number {
  const w = ((az % TWO_PI) + TWO_PI) % TWO_PI;
  return w >= TWO_PI ? 0 : w;
}

/**
 * The terrain horizon of one site, from `sightline horizon`. Between azimuth bins the mask is
 * linear (wrapping at north); between the stored mast heights it is linear too, which is exact at
 * those heights and approximate between them (error measured in docs/science/METHODS.md §6).
 */
export class HorizonProfile {
  readonly siteId: string;
  readonly provenance: ProvenanceRecord;
  readonly maxMastHeight_m: number;

  constructor(private readonly file: HorizonFile) {
    this.siteId = file.site_id;
    this.provenance = file.provenance;
    this.maxMastHeight_m = file.mast_heights_m[file.mast_heights_m.length - 1] ?? 0;
  }

  get location(): Location {
    const { lat_rad, lon_rad, elev_m } = this.file.location;
    return { lat_rad, lon_rad, elev_m };
  }

  /** True when `location` is this site: within 2 m on the ground and 1 m in height. */
  matches(location: Location): boolean {
    const { lat_rad, lon_rad, elev_m } = this.file.location;
    const dLat = location.lat_rad - lat_rad;
    const dLon = (location.lon_rad - lon_rad) * Math.cos(lat_rad);
    const ground_m = Math.hypot(dLat, dLon) * MOON_REFERENCE_RADIUS_KM * 1000;
    return (
      ground_m <= MATCH_DISTANCE_M && Math.abs((location.elev_m ?? 0) - elev_m) <= MATCH_ELEVATION_M
    );
  }

  /** Terrain elevation angle (radians above the observer's horizontal plane) towards `azimuth_rad`. */
  maskAt(azimuth_rad: number, mast_height_m: number): number {
    if (!Number.isFinite(azimuth_rad)) throw new RangeError("azimuth must be finite");
    const {
      mast_heights_m,
      mask_elevation_rad: rows,
      azimuth_samples: n,
      azimuth_step_rad,
    } = this.file;
    if (!(mast_height_m >= 0) || mast_height_m > this.maxMastHeight_m) {
      throw new RangeError(
        `mast height ${mast_height_m} m is outside 0 to ${this.maxMastHeight_m} m`,
      );
    }
    const x = wrapAzimuth(azimuth_rad) / azimuth_step_rad;
    const i = Math.floor(x) % n;
    const f = x - Math.floor(x);
    const along = (row: number[]): number => {
      const a = row[i] as number;
      const b = row[(i + 1) % n] as number;
      return a + (b - a) * f;
    };

    const k = mast_heights_m.findIndex((h) => h >= mast_height_m);
    if (k <= 0) return along(rows[0] as number[]);
    const lo = mast_heights_m[k - 1] as number;
    const hi = mast_heights_m[k] as number;
    const t = (mast_height_m - lo) / (hi - lo);
    const a = along(rows[k - 1] as number[]);
    const b = along(rows[k] as number[]);
    return a + (b - a) * t;
  }

  /** A contract `HorizonMask` for one mast height. */
  toHorizonMask(mast_height_m: number): HorizonMask {
    const n = this.file.azimuth_samples;
    const mask = Array.from({ length: n }, (_, i) =>
      this.maskAt(i * this.file.azimuth_step_rad, mast_height_m),
    );
    return HorizonMaskSchema.parse({
      location: this.location,
      mast_height_m,
      azimuth_step_rad: this.file.azimuth_step_rad,
      mask_elevation_rad: mask,
      simulated: this.provenance.simulated,
      provenance: this.provenance,
    });
  }
}
