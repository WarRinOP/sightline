"use client";

import { useEffect, useMemo, useState } from "react";
import type { Site, SunEarthState } from "@sightline/contracts";
import { siteLocation } from "@sightline/contracts";
import { etToUtcIso, utcIsoToEt } from "@sightline/engine";
import { connectEngine, type EngineConnection } from "../workers/engineBridge";

const TICK_MS = 200;
// Two hours per tick: the engine's samples are hourly and interpolated, and a lunar day (29.5
// days) passes in about a minute and a half.
const TICK_STEP_S = 2 * 3600;

const toDeg = (rad: number) => (rad * 180) / Math.PI;
const signed = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;
const compass = (rad: number) => `${toDeg(rad).toFixed(1)}°`;

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
    void engine.client.getSunEarth(epoch_et, location, 0).then((state) => {
      if (!cancelled) setReal(state);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, epoch_et, location]);

  useEffect(() => {
    if (!engine || !location || terrain[siteId] !== undefined) return;
    let cancelled = false;
    engine.client.getHorizon(location, 0).then(
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
        <p className="text-xs text-text-3">
          {siteTerrain
            ? "Judged against the terrain horizon from NASA LOLA elevation data (5 m tile, 80 m map to 300 km), mast 0 m, as seen from the tile centre. This tile centre is on a steep crater wall, not on the rim crest. Not yet checked against published illumination maps. Link means Earth is above the terrain and at least one DSN complex sees it."
            : "These need a terrain horizon, which exists only for Shackleton Rim so far (task S1-05), so no number is shown rather than one that ignores the terrain."}
        </p>
      </div>
    </section>
  );
}

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
