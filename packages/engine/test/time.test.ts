import { describe, expect, it } from "vitest";
import { LEAP_SECOND_TABLE, etToUtcIso, parseLeapSecondTable, utcIsoToEt } from "../src";

describe("utcIsoToEt", () => {
  it("is within the TDB periodic term of TAI + 32.184 at J2000 (TAI - UTC = 32 s)", () => {
    const et = utcIsoToEt("2000-01-01T12:00:00");
    expect(Math.abs(et - (32 + 32.184))).toBeLessThan(2e-3);
  });

  it("counts a leap second as a real second", () => {
    const before = utcIsoToEt("2016-12-31T23:59:59");
    const leap = utcIsoToEt("2016-12-31T23:59:60");
    const after = utcIsoToEt("2017-01-01T00:00:00");
    expect(leap - before).toBeCloseTo(1, 5);
    expect(after - leap).toBeCloseTo(1, 5);
  });

  it("has no extra second on an ordinary day", () => {
    const a = utcIsoToEt("2026-03-20T23:59:59");
    const b = utcIsoToEt("2026-03-21T00:00:00");
    expect(b - a).toBeCloseTo(1, 5);
  });

  it("accepts a trailing Z and a space instead of T", () => {
    expect(utcIsoToEt("2026-03-20 12:00:00Z")).toBe(utcIsoToEt("2026-03-20T12:00:00"));
  });

  it("rejects second 60 on a day without a leap second, dates before 1972 and bad strings", () => {
    expect(() => utcIsoToEt("2026-03-20T23:59:60")).toThrow(RangeError);
    expect(() => utcIsoToEt("2016-12-31T12:00:60")).toThrow(RangeError);
    expect(() => utcIsoToEt("1971-12-31T00:00:00")).toThrow(RangeError);
    expect(() => utcIsoToEt("20 March 2026")).toThrow(TypeError);
  });
});

describe("etToUtcIso", () => {
  it("round-trips UTC through ET to the millisecond", () => {
    const cases = [
      "1972-01-01T00:00:00.000",
      "1999-12-31T23:59:59.999",
      "2000-01-01T12:00:00.000",
      "2026-03-20T12:34:56.789",
      "2026-12-31T23:59:59.500",
      "2040-07-04T01:02:03.004",
    ];
    for (const utc of cases) expect(etToUtcIso(utcIsoToEt(utc))).toBe(utc);
  });

  it("shows the leap second as second 60 and rolls over after it", () => {
    const leap = utcIsoToEt("2016-12-31T23:59:60");
    expect(etToUtcIso(leap)).toBe("2016-12-31T23:59:60.000");
    expect(etToUtcIso(leap + 0.5)).toBe("2016-12-31T23:59:60.500");
    expect(etToUtcIso(leap + 1)).toBe("2017-01-01T00:00:00.000");
    expect(etToUtcIso(leap - 1)).toBe("2016-12-31T23:59:59.000");
  });

  it("rejects an ET before the table starts", () => {
    expect(() => etToUtcIso(-2e9)).toThrow(RangeError);
  });
});

describe("leap-second table", () => {
  it("is the one in naif0012.tls: 28 entries from 10 s in 1972 to 37 s in 2017", () => {
    const t = LEAP_SECOND_TABLE.delta_at;
    expect(t).toHaveLength(28);
    expect(t[0]).toEqual({ utc: "1972-01-01", seconds: 10 });
    expect(t[t.length - 1]).toEqual({ utc: "2017-01-01", seconds: 37 });
    expect(LEAP_SECOND_TABLE.delta_t_a).toBe(32.184);
  });

  it("rejects a malformed table", () => {
    expect(() => parseLeapSecondTable(null)).toThrow(TypeError);
    expect(() => parseLeapSecondTable({ ...LEAP_SECOND_TABLE, delta_at: [] })).toThrow(TypeError);
    const unordered = [
      { utc: "2017-01-01", seconds: 37 },
      { utc: "1972-01-01", seconds: 10 },
    ];
    expect(() => parseLeapSecondTable({ ...LEAP_SECOND_TABLE, delta_at: unordered })).toThrow(
      TypeError,
    );
  });
});
