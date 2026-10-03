"use client";

import { useEffect, useRef, useState } from "react";
import type {
  HorizonMask,
  Site,
  SunEarthState,
  TileManifest,
  TileSource,
} from "@sightline/contracts";
import { siteLocation } from "@sightline/contracts";
import { createLolaTileSource, fetchTileCoverage } from "@sightline/engine";
import { FisheyeSky, MoonScene, type CameraHandle, type SceneInputs } from "@sightline/scene";
import { Tag } from "./ui";

interface ScenePanelProps {
  sites: Site[];
  siteId: string;
  epoch_et: number | null;
  /** The engine's answer for the selected site at `epoch_et`, or null while there is none. */
  sunEarth: SunEarthState | null;
  /** The terrain horizon at the selected site, or null where the engine has none. */
  horizon: HorizonMask | null;
}

/**
 * The 3D view (packages/scene). It draws what it is given: real LOLA tiles from `/api/tiles`, the
 * engine's Sun and Earth directions and the engine's horizon; with none of those it says "no data".
 * Per-frame values go through one ref, never through React state (D-030).
 */
export function ScenePanel({ sites, siteId, epoch_et, sunEarth, horizon }: ScenePanelProps) {
  const [tileSource, setTileSource] = useState<TileSource | null>(null);
  const [manifest, setManifest] = useState<TileManifest | null>(null);
  const [slope, setSlope] = useState(false);
  const camera = useRef<CameraHandle>(null);
  const inputs = useRef<SceneInputs>({
    epoch_et: 0,
    selected_site_id: siteId,
    layers: {},
    sun_earth: null,
  });

  // The served coverage says which tiles exist (the full pyramid locally, the committed subset on a
  // deployment); without it the loader assumes the subset.
  useEffect(() => {
    let cancelled = false;
    fetchTileCoverage()
      .then(
        (coverage) => createLolaTileSource({ coverage }),
        () => createLolaTileSource(),
      )
      .then(async (source) => {
        const m = await source.getManifest();
        if (!cancelled) {
          setTileSource(source);
          setManifest(m);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputs.current.selected_site_id = siteId;
    inputs.current.epoch_et = epoch_et ?? 0;
    inputs.current.sun_earth = sunEarth;
    inputs.current.layers = { slope };
  }, [siteId, epoch_et, sunEarth, slope]);

  const site = sites.find((s) => s.id === siteId);
  useEffect(() => {
    if (!site || !tileSource) return;
    camera.current?.flyTo(siteLocation(site));
  }, [site, tileSource]);

  const button =
    "rounded-lg border border-hairline px-3 py-1 font-condensed text-xs font-semibold uppercase tracking-widest text-text-2 hover:text-text-1 disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-2">
          Terrain, Sun and Earth
        </h3>
        {manifest ? (
          <Tag
            simulated={manifest.simulated}
            text={manifest.simulated ? "Simulated terrain" : "Real terrain · NASA LOLA"}
          />
        ) : null}
      </div>
      <div
        role="img"
        aria-label={`3D view of the lunar south pole terrain near ${site?.name ?? "the selected site"}. Drag to rotate, scroll to zoom.`}
        className="relative h-[28rem] overflow-hidden rounded-lg border border-hairline bg-void"
      >
        {tileSource ? (
          <MoonScene
            ref={camera}
            sites={sites}
            tileSource={tileSource}
            inputs={inputs}
            horizon={horizon}
          />
        ) : (
          <p className="p-4 text-sm text-text-2">Loading terrain tiles…</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={!tileSource}
          onClick={() => site && camera.current?.flyTo(siteLocation(site))}
        >
          Fly to site
        </button>
        <button
          type="button"
          className={button}
          disabled={!tileSource || !sunEarth}
          onClick={() => camera.current?.viewToward("sun")}
        >
          Look toward the Sun
        </button>
        <button
          type="button"
          className={button}
          disabled={!tileSource || !sunEarth}
          onClick={() => camera.current?.viewToward("earth")}
        >
          Look toward Earth
        </button>
        <button
          type="button"
          className={button}
          disabled={!tileSource}
          onClick={() => camera.current?.playHeroSequence()}
        >
          Hero flight (20 s)
        </button>
        <label className="flex items-center gap-2 text-xs text-text-2">
          <input type="checkbox" checked={slope} onChange={(e) => setSlope(e.target.checked)} />
          Slope overlay
        </label>
      </div>
      {tileSource && site ? (
        <div className="space-y-2">
          <h3 className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-2">
            Lander&apos;s eye: the sky from {site.name}
          </h3>
          <div
            role="img"
            aria-label={`Sky chart from ${site.name}: the terrain horizon, the Sun and the Earth. North is up, east is to the right, the centre is straight up.`}
            className="mx-auto h-72 w-72 max-w-full overflow-hidden rounded-lg border border-hairline bg-void"
          >
            <FisheyeSky
              inputs={inputs}
              tileSource={tileSource}
              location={siteLocation(site)}
              horizon={horizon}
            />
          </div>
          <p className="text-xs text-text-3">
            Seen from above, as a map of the sky: north up, east right, the centre straight up, the
            rim the horizon. The curve is the terrain horizon; the Sun is shown even below it.
          </p>
        </div>
      ) : null}
      <p className="text-xs text-text-3">
        Heights are NASA LOLA tiles (80 m map; 5 m near the three sites). The Sun and Earth are the
        engine&apos;s directions for the selected site. The light and shadows in this view are
        visual only: the numbers on this page come from the engine, not from this picture.
      </p>
    </div>
  );
}
