import { EphemerisHeaderSchema, type EphemerisHeader } from "@sightline/contracts";
import type { Vec3 } from "../frames";

/** The header plus the constants `sightline ephem` read from the kernels. */
export interface EphemerisMeta {
  header: EphemerisHeader;
  sun_radius_km: number;
  moon_radius_km: number;
}

const VALUES_PER_BODY = 6;

const isLittleEndianHost = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function parseEphemerisMeta(raw: unknown): EphemerisMeta {
  const header = EphemerisHeaderSchema.parse(raw);
  const r = raw as {
    layout?: Record<string, unknown>;
    sun_radius_km?: unknown;
    moon_radius_km?: unknown;
  };
  const layout = r.layout;
  if (
    layout?.dtype !== "float64" ||
    layout.endianness !== "little" ||
    layout.values_per_body !== VALUES_PER_BODY
  ) {
    throw new TypeError("ephemeris layout must be little-endian float64 with 6 values per body");
  }
  if (header.bodies[0] !== "SUN" || header.bodies[1] !== "EARTH") {
    throw new TypeError("ephemeris bodies must start with SUN and EARTH");
  }
  const { sun_radius_km, moon_radius_km } = r;
  if (typeof sun_radius_km !== "number" || typeof moon_radius_km !== "number") {
    throw new TypeError("ephemeris header needs sun_radius_km and moon_radius_km");
  }
  return { header, sun_radius_km, moon_radius_km };
}

export interface BodyPositions {
  sun: Vec3;
  earth: Vec3;
  /** Station minus Earth centre, in the order of `meta.header.bodies` after EARTH. */
  stations: Vec3[];
}

/**
 * Sun, Earth and DSN positions in MOON_ME (km, LT+S) from the file written by `sightline ephem`,
 * interpolated with cubic Hermite from the stored positions and velocities.
 */
export class Ephemeris {
  readonly meta: EphemerisMeta;
  private readonly data: Float64Array;
  private readonly bodyCount: number;

  constructor(meta: EphemerisMeta, bytes: ArrayBuffer) {
    if (!isLittleEndianHost) throw new Error("big-endian hosts are not supported");
    this.meta = meta;
    this.bodyCount = meta.header.bodies.length;
    const expected = meta.header.record_count * this.bodyCount * VALUES_PER_BODY * 8;
    if (bytes.byteLength !== expected) {
      throw new RangeError(`ephemeris file is ${bytes.byteLength} B, expected ${expected} B`);
    }
    this.data = new Float64Array(bytes);
  }

  get start_et(): number {
    return this.meta.header.start_et;
  }

  get end_et(): number {
    return this.meta.header.end_et;
  }

  covers(et: number): boolean {
    return et >= this.start_et && et <= this.end_et;
  }

  /** Position of body `bodyIndex` (index in `header.bodies`) at `et`, in km. */
  position(bodyIndex: number, et: number): Vec3 {
    const { step_s, record_count } = this.meta.header;
    if (!this.covers(et)) {
      throw new RangeError(
        `ET ${et} is outside the ephemeris (${this.start_et} to ${this.end_et})`,
      );
    }
    const x = (et - this.start_et) / step_s;
    const i = Math.min(Math.floor(x), record_count - 2);
    const s = x - i;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const stride = this.bodyCount * VALUES_PER_BODY;
    const a = i * stride + bodyIndex * VALUES_PER_BODY;
    const b = a + stride;
    const d = this.data;
    const c = (k: number): number =>
      h00 * d[a + k]! +
      h10 * step_s * d[a + 3 + k]! +
      h01 * d[b + k]! +
      h11 * step_s * d[b + 3 + k]!;
    return [c(0), c(1), c(2)];
  }

  at(et: number): BodyPositions {
    const stations: Vec3[] = [];
    for (let j = 2; j < this.bodyCount; j++) stations.push(this.position(j, et));
    return { sun: this.position(0, et), earth: this.position(1, et), stations };
  }
}
