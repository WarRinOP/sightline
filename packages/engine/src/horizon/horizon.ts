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

/**
 * The file written by `sightline horizon`. For azimuth bin i the terrain elevation seen from a mast
 * of height h is `atan(max over k in [offsets[i], offsets[i+1]) of a[k] - b[k] * h)`: for each
 * ground point the tangent of its elevation is linear in h, and the lines kept are the ones that
 * are highest somewhere on [0, max_mast_height_m]. So the mast dependence is exact, not
 * interpolated.
 */
export interface HorizonFile {
  schema_version: 2;
  site_id: string;
  location: { lat_rad: number; lon_rad: number; elev_m: number };
  azimuth_samples: number;
  azimuth_step_rad: number;
  max_mast_height_m: number;
  hull_offsets: number[];
  hull_a: number[];
  hull_b: number[];
  provenance: ProvenanceRecord;
}

export function parseHorizonFile(raw: unknown): HorizonFile {
  const doc = raw as Partial<HorizonFile> | null;
  if (doc?.schema_version !== 2) throw new TypeError("horizon file: expected schema_version 2");
  const { site_id, location, azimuth_samples, azimuth_step_rad, max_mast_height_m } = doc;
  const { hull_offsets, hull_a, hull_b } = doc;
  if (
    typeof site_id !== "string" ||
    !location ||
    typeof azimuth_samples !== "number" ||
    typeof azimuth_step_rad !== "number" ||
    typeof max_mast_height_m !== "number" ||
    !Array.isArray(hull_offsets) ||
    !Array.isArray(hull_a) ||
    !Array.isArray(hull_b)
  ) {
    throw new TypeError("horizon file: missing fields");
  }
  if (Math.round(TWO_PI / azimuth_step_rad) !== azimuth_samples) {
    throw new RangeError("horizon file: azimuth_step_rad does not divide the circle");
  }
  if (!(max_mast_height_m > 0)) throw new RangeError("horizon file: max_mast_height_m must be > 0");
  const lines = hull_a.length;
  if (hull_b.length !== lines || hull_offsets.length !== azimuth_samples + 1) {
    throw new RangeError("horizon file: one offset per azimuth plus one, and as many b as a");
  }
  if (hull_offsets[0] !== 0 || hull_offsets[azimuth_samples] !== lines) {
    throw new RangeError("horizon file: offsets must run from 0 to the number of lines");
  }
  for (let i = 0; i < azimuth_samples; i++) {
    if (!((hull_offsets[i + 1] as number) > (hull_offsets[i] as number))) {
      throw new RangeError(`horizon file: azimuth bin ${i} has no lines`);
    }
  }
  if (!hull_a.every(Number.isFinite) || !hull_b.every((v) => Number.isFinite(v) && v > 0)) {
    throw new RangeError("horizon file: a must be finite and b positive");
  }
  return {
    schema_version: 2,
    site_id,
    location,
    azimuth_samples,
    azimuth_step_rad,
    max_mast_height_m,
    hull_offsets: hull_offsets as number[],
    hull_a: hull_a as number[],
    hull_b: hull_b as number[],
    provenance: ProvenanceRecordSchema.parse(doc.provenance),
  };
}

/** Wrap an azimuth into [0, 2π) without ever returning 2π itself. */
function wrapAzimuth(az: number): number {
  const w = ((az % TWO_PI) + TWO_PI) % TWO_PI;
  return w >= TWO_PI ? 0 : w;
}

/**
 * The terrain horizon of one site, from `sightline horizon`. Exact in mast height (see
 * `HorizonFile`); between azimuth bins the mask is linear, wrapping at north.
 */
export class HorizonProfile {
  readonly siteId: string;
  readonly provenance: ProvenanceRecord;
  readonly maxMastHeight_m: number;

  constructor(private readonly file: HorizonFile) {
    this.siteId = file.site_id;
    this.provenance = file.provenance;
    this.maxMastHeight_m = file.max_mast_height_m;
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

  /** The mask of azimuth bin `i` for a mast of height `h`, in radians. */
  private bin(i: number, h: number): number {
    const { hull_offsets: offsets, hull_a: a, hull_b: b } = this.file;
    let best = -Infinity;
    for (let k = offsets[i] as number; k < (offsets[i + 1] as number); k++) {
      const v = (a[k] as number) - (b[k] as number) * h;
      if (v > best) best = v;
    }
    return Math.atan(best);
  }

  /** Terrain elevation angle (radians above the observer's horizontal plane) towards `azimuth_rad`. */
  maskAt(azimuth_rad: number, mast_height_m: number): number {
    if (!Number.isFinite(azimuth_rad)) throw new RangeError("azimuth must be finite");
    if (!(mast_height_m >= 0) || mast_height_m > this.maxMastHeight_m) {
      throw new RangeError(
        `mast height ${mast_height_m} m is outside 0 to ${this.maxMastHeight_m} m`,
      );
    }
    const n = this.file.azimuth_samples;
    const x = wrapAzimuth(azimuth_rad) / this.file.azimuth_step_rad;
    const i = Math.floor(x) % n;
    const f = x - Math.floor(x);
    const a = this.bin(i, mast_height_m);
    return a + (this.bin((i + 1) % n, mast_height_m) - a) * f;
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
