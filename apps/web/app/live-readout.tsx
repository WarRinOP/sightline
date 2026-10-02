"use client";

import { useEffect, useMemo, useState } from "react";
import type { Site, SunEarthState } from "@sightline/contracts";
import { siteLocation } from "@sightline/contracts";
import { MOCK_EPOCH_ET, createMockEngineClient } from "@sightline/engine";

const TICK_MS = 200;
// Two mock hours per tick, so a mock lunar day passes in about a minute.
const TICK_STEP_S = 2 * 3600;
const DAY_S = 86_400;

const toDeg = (rad: number) => (rad * 180) / Math.PI;
const signed = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;

export function LiveReadout({ sites }: { sites: Site[] }) {
  const engine = useMemo(() => createMockEngineClient(), []);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [epoch_et, setEpochEt] = useState(MOCK_EPOCH_ET);
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState<SunEarthState | null>(null);

  // Start paused for people who ask for reduced motion.
  useEffect(() => {
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setEpochEt((e) => e + TICK_STEP_S), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const location = useMemo(() => {
    const site = sites.find((s) => s.id === siteId);
    return site ? siteLocation(site) : null;
  }, [sites, siteId]);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    void engine.getSunEarth(epoch_et, location, 0).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, epoch_et, location]);

  return (
    <section aria-labelledby="readout-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="readout-title" className="font-condensed text-xl font-semibold tracking-wide">
          Live readout
        </h2>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg border border-hairline px-3 py-1 font-condensed text-xs font-semibold uppercase tracking-widest text-text-2 hover:text-text-1"
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

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Readout
          label="Sun elevation"
          value={state ? signed(toDeg(state.sun_elevation_rad)) : "…"}
        />
        <Readout
          label="Earth elevation"
          value={state ? signed(toDeg(state.earth_elevation_rad)) : "…"}
        />
        <Readout
          label="Sun disk visible"
          value={state ? `${(state.sun_disk_fraction * 100).toFixed(0)} %` : "…"}
        />
        <Readout label="Link to Earth" value={state ? (state.dsn_visible ? "yes" : "no") : "…"} />
      </dl>

      <p className="font-mono text-xs tabular-nums text-text-3">
        mock epoch + {((epoch_et - MOCK_EPOCH_ET) / DAY_S).toFixed(1)} days
      </p>
    </section>
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
