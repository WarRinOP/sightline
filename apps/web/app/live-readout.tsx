"use client";

import { useEffect, useMemo, useState } from "react";
import type { Site, SunEarthState, TimelineStatistics } from "@sightline/contracts";
import { DEFAULT_LANDER_PROFILE, siteLocation } from "@sightline/contracts";
import { etToUtcIso, utcIsoToEt } from "@sightline/engine";
import { connectEngine, type EngineConnection } from "../workers/engineBridge";

const TICK_MS = 200;
// Two hours per tick: the engine's samples are hourly and interpolated, and a lunar day (29.5
// days) passes in about a minute and a half.
const TICK_STEP_S = 2 * 3600;

// The mast and limits every number on this page assumes: the contract's default lander profile.
const PROFILE = DEFAULT_LANDER_PROFILE;
const HOUR_S = 3600;
const DAY_S = 86_400;

const toDeg = (rad: number) => (rad * 180) / Math.PI;
const signed = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;
const compass = (rad: number) => `${toDeg(rad).toFixed(1)}°`;

interface YearStats {
  profile: TimelineStatistics;
  published: { anyPart: number; meanDisk: number };
}

type Connection =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; engine: EngineConnection };

export function LiveReadout({ sites }: { sites: Site[] }) {
  const [connection, setConnection] = useState<Connection>({ status: "loading" });
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [epoch_et, setEpochEt] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [real, setReal] = useState<SunEarthState | null>(null);
  // Per site: does the engine have a terrain horizon, and is it simulated? Asked, not assumed.
  const [terrain, setTerrain] = useState<Record<string, { simulated: boolean } | null>>({});
  // Per site: the engine's statistics over the whole ephemeris, or "error". `profile` follows the
  // default lander profile; `published` counts any part of the disk above the terrain and averages
  // the visible fraction of the disk, which is how published illumination studies define it.
  const [year, setYear] = useState<Record<string, YearStats | "error">>({});

  // Start the engine worker. StrictMode mounts twice in development; the first one is terminated.
  useEffect(() => {
    let cancelled = false;
    let opened: EngineConnection | undefined;
    connectEngine().then(
      (engine) => {
        if (cancelled) {
          engine.terminate();
          return;
        }
        opened = engine;
        // Open on the current moment when the ephemeris covers it, otherwise on its first sample.
        const now_et = utcIsoToEt(new Date().toISOString().slice(0, 19));
        const { start_et, end_et } = engine.coverage;
        setEpochEt(now_et >= start_et && now_et <= end_et ? now_et : start_et);
        setConnection({ status: "ready", engine });
        // Start paused for people who ask for reduced motion.
        setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      },
      (error: unknown) => {
        if (!cancelled) {
          setConnection({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      cancelled = true;
      opened?.terminate();
    };
  }, []);

  const engine = connection.status === "ready" ? connection.engine : null;

  useEffect(() => {
    if (!playing || !engine) return;
    const { start_et, end_et } = engine.coverage;
    const id = window.setInterval(
      () =>
        setEpochEt((e) => (e === null || e + TICK_STEP_S > end_et ? start_et : e + TICK_STEP_S)),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [playing, engine]);

  const location = useMemo(() => {
    const site = sites.find((s) => s.id === siteId);
    return site ? siteLocation(site) : null;
  }, [sites, siteId]);

  useEffect(() => {
    if (!engine || !location || epoch_et === null) return;
    let cancelled = false;
    void engine.client.getSunEarth(epoch_et, location, PROFILE.mast_height_m).then((state) => {
      if (!cancelled) setReal(state);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, epoch_et, location]);

  useEffect(() => {
    if (!engine || !location || terrain[siteId] !== undefined) return;
    let cancelled = false;
    engine.client.getHorizon(location, PROFILE.mast_height_m).then(
      (mask) => {
        if (!cancelled) setTerrain((t) => ({ ...t, [siteId]: { simulated: mask.simulated } }));
      },
      () => {
        // NotAvailableError: no terrain horizon for this site yet.
        if (!cancelled) setTerrain((t) => ({ ...t, [siteId]: null }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [engine, location, siteId, terrain]);

  const provenance = engine?.client.provenance;
  const siteTerrain = terrain[siteId];
  const siteYear = year[siteId];

  useEffect(() => {
    if (!engine || !location || !siteTerrain || year[siteId] !== undefined) return;
    let cancelled = false;
    const { start_et, end_et } = engine.coverage;
    const request = { location, start_et, end_et, step_s: HOUR_S };
    Promise.all([
      engine.client.getTimeline({ ...request, profile: PROFILE }),
      // No minimum Sun elevation: any part of the disk above the terrain counts.
      engine.client.getTimeline({
        ...request,
        profile: { ...PROFILE, min_sun_elev_rad: -Math.PI / 2 },
      }),
    ]).then(
      ([lander, published]) => {
        const meanDisk =
          published.steps.reduce((sum, step) => sum + step.sun_disk_fraction, 0) /
          published.steps.length;
        if (!cancelled) {
          setYear((y) => ({
            ...y,
            [siteId]: {
              profile: lander.statistics,
              published: { anyPart: published.statistics.illuminated_ratio, meanDisk },
            },
          }));
        }
      },
      () => {
        if (!cancelled) setYear((y) => ({ ...y, [siteId]: "error" }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [engine, location, siteId, siteTerrain, year]);
  // The tag comes from the data, never from a constant: a simulated ephemeris shows the purple one.
  const realTag = provenance?.simulated ? "Simulated" : "Real · NAIF SPICE";

  return (
    <section aria-labelledby="readout-title" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="readout-title" className="font-condensed text-xl font-semibold tracking-wide">
          Live readout
        </h2>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={!engine}
          className="rounded-lg border border-hairline px-3 py-1 font-condensed text-xs font-semibold uppercase tracking-widest text-text-2 hover:text-text-1 disabled:opacity-50"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-2">
          Site
        </legend>
        {sites.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-baseline gap-3 rounded-lg border border-hairline bg-surface-glass px-3 py-2 has-[:checked]:border-earth"
          >
            <input
              type="radio"
              name="site"
              value={s.id}
              checked={s.id === siteId}
              onChange={() => setSiteId(s.id)}
            />
            <span className="font-medium">{s.name}</span>
            <span className="font-mono text-xs tabular-nums text-text-2">
              {s.lat_deg.toFixed(2)}° lat, {s.lon_deg.toFixed(2)}° lon
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-3" role="group" aria-labelledby="real-title">
        <div className="flex flex-wrap items-center gap-3">
          <h3
            id="real-title"
            className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-2"
          >
            Sun and Earth directions
          </h3>
          <Tag simulated={provenance?.simulated ?? false} text={realTag} hidden={!provenance} />
        </div>

        {connection.status === "error" ? (
          <p role="alert" className="text-sm text-alert">
            The engine could not start: {connection.message}
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Readout
              label="Sun elevation"
              value={real ? signed(toDeg(real.sun_elevation_rad)) : "…"}
            />
            <Readout label="Sun azimuth" value={real ? compass(real.sun_azimuth_rad) : "…"} />
            <Readout
              label="Earth elevation"
              value={real ? signed(toDeg(real.earth_elevation_rad)) : "…"}
            />
            <Readout label="Earth azimuth" value={real ? compass(real.earth_azimuth_rad) : "…"} />
          </dl>
        )}

        <p className="font-mono text-xs tabular-nums text-text-3">
          {epoch_et === null ? "…" : `${etToUtcIso(epoch_et).slice(0, 19).replace("T", " ")} UTC`}
          {provenance
            ? ` · ${provenance.spice_kernels.length} SPICE kernels · ${provenance.data_version}`
            : ""}
        </p>
        <p className="text-xs text-text-3">
          Elevation is measured from a flat horizon at the site&apos;s height; azimuth is clockwise
          from local north (grid north at the pole). Terrain is not in these numbers.
        </p>
      </div>

      <div className="space-y-3" role="group" aria-labelledby="terrain-title">
        <div className="flex flex-wrap items-center gap-3">
          <h3
            id="terrain-title"
            className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-2"
          >
            Light and link at this site
          </h3>
          {siteTerrain === undefined ? null : siteTerrain ? (
            <Tag
              simulated={siteTerrain.simulated}
              text={siteTerrain.simulated ? "Simulated" : "Real terrain · not yet validated"}
            />
          ) : (
            <Tag simulated={false} text="Not computed yet" />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Readout
            label="Sun disk visible"
            value={
              siteTerrain && real
                ? `${(real.sun_disk_fraction * 100).toFixed(0)} %`
                : siteTerrain === undefined
                  ? "…"
                  : "—"
            }
          />
          <Readout
            label="Link to Earth"
            value={
              siteTerrain && real
                ? real.dsn_visible
                  ? "yes"
                  : "no"
                : siteTerrain === undefined
                  ? "…"
                  : "—"
            }
          />
        </dl>
        {siteTerrain ? (
          <>
            {siteYear === "error" ? (
              <p role="alert" className="text-sm text-alert">
                The timeline could not be computed.
              </p>
            ) : (
              <>
                <h4 className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-2">
                  Illumination over the ephemeris, hourly, as published studies define it
                </h4>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Readout
                    label="Average disk visible"
                    value={siteYear ? percent(siteYear.published.meanDisk) : "…"}
                  />
                  <Readout
                    label="Any part of Sun visible"
                    value={siteYear ? percent(siteYear.published.anyPart) : "…"}
                  />
                  <Readout
                    label="Link to Earth"
                    value={siteYear ? percent(siteYear.profile.comms_ratio) : "…"}
                  />
                </dl>
                <h4 className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-2">
                  For a lander: default profile, Sun&apos;s centre above the horizontal
                </h4>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Readout
                    label="Lit"
                    value={siteYear ? percent(siteYear.profile.illuminated_ratio) : "…"}
                  />
                  <Readout
                    label="Lit and link"
                    value={siteYear ? percent(siteYear.profile.both_ratio) : "…"}
                  />
                  <Readout
                    label="Longest night"
                    value={siteYear ? days(siteYear.profile.longest_night_s) : "…"}
                  />
                  <Readout
                    label="Longest day"
                    value={siteYear ? days(siteYear.profile.longest_day_s) : "…"}
                  />
                </dl>
              </>
            )}
          </>
        ) : null}
        <p className="text-xs text-text-3">
          {siteTerrain
            ? `Judged against the terrain horizon built from NASA LOLA elevation data (5 m site tile, 80 m map to 300 km), for a ${PROFILE.mast_height_m} m mast. Average disk visible is the mean visible fraction of the Sun's disk, the quantity Barker et al. (2021) call average illumination; for the lander, Lit also needs the Sun's centre above the local horizontal, so it is lower. Link means Earth clears the terrain and at least one DSN complex sees it. The method gives results consistent with Barker et al.'s published ranges at their Site 1 regions and with the pattern of NASA's AVGVISIB map (docs/science/METHODS.md §7); the values at these three sites are not themselves published.`
            : "These need a terrain horizon, which exists only for the three catalog sites, so no number is shown rather than one that ignores the terrain."}
        </p>
      </div>
    </section>
  );
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(1)} %`;
const days = (seconds: number) => `${(seconds / DAY_S).toFixed(1)} d`;

function Tag({
  simulated,
  text,
  hidden = false,
}: {
  simulated: boolean;
  text: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  // The words carry the meaning; colour only reinforces it. Purple is reserved for SIMULATED.
  const style = simulated ? "bg-sim text-void" : "border border-hairline text-text-1";
  return (
    <span
      role="status"
      className={`rounded-md px-2 py-0.5 font-condensed text-xs font-semibold uppercase tracking-widest ${style}`}
    >
      {text}
    </span>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-glass px-3 py-2">
      <dt className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-2">
        {label}
      </dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}
