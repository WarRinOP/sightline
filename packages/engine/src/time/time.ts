import leapSecondJson from "../data/leapseconds.json";

/**
 * UTC to ET (TDB seconds past J2000) the way SPICE's LSK defines it:
 * ET = TAI + 32.184 + K sin(E), with E = M + EB sin(M) and M = M0 + M1 · TT.
 * The table and constants are read from naif0012.tls by `sightline ephem`.
 */
export interface LeapSecondTable {
  delta_t_a: number;
  k: number;
  eb: number;
  m0: number;
  m1: number;
  /** Effective from 00:00:00 UTC on `utc` (YYYY-MM-DD): TAI - UTC = `seconds` from then on. */
  delta_at: readonly { utc: string; seconds: number }[];
}

const DAY_S = 86_400;
const J2000_NOON_S = 43_200;
const J2000_DAY_MS = Date.UTC(2000, 0, 1);

export function parseLeapSecondTable(raw: unknown): LeapSecondTable {
  const t = raw as Partial<LeapSecondTable> | null;
  const nums = [t?.delta_t_a, t?.k, t?.eb, t?.m0, t?.m1];
  if (!t || !nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new TypeError("leap-second table: missing or non-numeric TDB constants");
  }
  if (!Array.isArray(t.delta_at) || t.delta_at.length === 0) {
    throw new TypeError("leap-second table: delta_at is empty");
  }
  let prev = -Infinity;
  for (const e of t.delta_at) {
    const day = civilDay(e.utc);
    if (!(day > prev) || !Number.isInteger(e.seconds)) {
      throw new TypeError(`leap-second table: bad entry ${JSON.stringify(e)}`);
    }
    prev = day;
  }
  return t as LeapSecondTable;
}

export const LEAP_SECOND_TABLE: LeapSecondTable = parseLeapSecondTable(leapSecondJson);

/** Days since 2000-01-01 of a calendar date, as `YYYY-MM-DD`. */
function civilDay(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new TypeError(`not a YYYY-MM-DD date: ${ymd}`);
  return civilDayOf(Number(m[1]), Number(m[2]), Number(m[3]));
}

function civilDayOf(y: number, mo: number, d: number): number {
  return (Date.UTC(y, mo - 1, d) - J2000_DAY_MS) / (DAY_S * 1000);
}

/** TDB minus TT for a given TT, the periodic term of the LSK. */
function tdbMinusTt(table: LeapSecondTable, tt: number): number {
  const mean = table.m0 + table.m1 * tt;
  return table.k * Math.sin(mean + table.eb * Math.sin(mean));
}

/** Effective TAI second (past J2000) at which each table entry starts. */
function entryStartTai(table: LeapSecondTable, i: number): number {
  const e = table.delta_at[i];
  if (!e) throw new RangeError("leap-second table index out of range");
  return civilDay(e.utc) * DAY_S - J2000_NOON_S + e.seconds;
}

/**
 * ET for a UTC time such as `2026-03-20T12:34:56.789` (no zone suffix; always UTC). Seconds may
 * be 60 on the last day before a leap second. Dates before the table starts (1972) throw.
 */
export function utcIsoToEt(iso: string, table: LeapSecondTable = LEAP_SECOND_TABLE): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)Z?$/.exec(iso);
  if (!m) throw new TypeError(`not a UTC time (YYYY-MM-DDTHH:MM:SS[.fff]): ${iso}`);
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const s = Number(m[6]);
  const day = civilDayOf(y, mo, d);
  const first = table.delta_at[0];
  if (!first || day < civilDay(first.utc))
    throw new RangeError(`${iso} is before the leap-second table starts`);

  let seconds = first.seconds;
  let nextEffectiveDay = Infinity;
  for (const e of table.delta_at) {
    if (civilDay(e.utc) <= day) seconds = e.seconds;
    else {
      nextEffectiveDay = civilDay(e.utc);
      break;
    }
  }
  if (s >= 60 && !(h === 23 && mi === 59 && s < 61 && nextEffectiveDay === day + 1)) {
    throw new RangeError(`${iso}: second 60 exists only at the end of a day before a leap second`);
  }
  const civil = day * DAY_S - J2000_NOON_S + h * 3600 + mi * 60 + s;
  const tt = civil + seconds + table.delta_t_a;
  return tt + tdbMinusTt(table, tt);
}

/** UTC time of an ET as `YYYY-MM-DDTHH:MM:SS.mmm`; a leap second shows as second 60. */
export function etToUtcIso(et: number, table: LeapSecondTable = LEAP_SECOND_TABLE): string {
  let tt = et;
  for (let i = 0; i < 3; i++) tt = et - tdbMinusTt(table, tt);
  const tai = tt - table.delta_t_a;

  let idx = -1;
  for (let i = 0; i < table.delta_at.length; i++) if (tai >= entryStartTai(table, i)) idx = i;
  const entry = table.delta_at[idx];
  if (!entry) throw new RangeError(`ET ${et} is before the leap-second table starts`);

  // The last second before a leap second is labelled 23:59:60 of the previous day.
  const nextStart = idx + 1 < table.delta_at.length ? entryStartTai(table, idx + 1) : Infinity;
  if (tai >= nextStart - 1 && tai < nextStart) {
    const next = table.delta_at[idx + 1];
    if (!next) throw new RangeError("leap-second table index out of range");
    const ms = Math.round((tai - (nextStart - 1)) * 1000);
    if (ms < 1000)
      return `${isoDate(civilDay(next.utc) - 1)}T23:59:60.${String(ms).padStart(3, "0")}`;
    return `${isoDate(civilDay(next.utc))}T00:00:00.000`;
  }

  const sinceMidnight = tai - entry.seconds + J2000_NOON_S;
  const day = Math.floor(sinceMidnight / DAY_S);
  const totalMs = Math.round((sinceMidnight - day * DAY_S) * 1000);
  const dayShift = Math.floor(totalMs / (DAY_S * 1000));
  const ms = totalMs - dayShift * DAY_S * 1000;
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  const frac = ms % 1000;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${isoDate(day + dayShift)}T${p2(hh)}:${p2(mm)}:${p2(ss)}.${String(frac).padStart(3, "0")}`;
}

function isoDate(daysSince2000: number): string {
  return new Date(J2000_DAY_MS + daysSince2000 * DAY_S * 1000).toISOString().slice(0, 10);
}
