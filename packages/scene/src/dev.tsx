import { createRoot } from "react-dom/client";
import { useRef, useMemo, useState } from "react";
import { MoonScene } from "./MoonScene";
import { FisheyeSky } from "./FisheyeSky";
import type { SceneInputs } from "./types";
import type { Site, HorizonMask } from "@sightline/contracts";
import { createMockTileSource } from "@sightline/engine";

function DevApp() {
  const inputsRef = useRef<SceneInputs>({
    epoch_et: 0,
    selected_site_id: "shackleton-rim",
    layers: { slope: false },
    sun_earth: null,
  });

  const [slopeEnabled, setSlopeEnabled] = useState(false);
  const [hasData, setHasData] = useState(false);

  const sites: Site[] = [
    {
      id: "shackleton-rim",
      name: "Shackleton Rim",
      lat_deg: -89.780403,
      lon_deg: 203.803049,
      elev_m: 1739.1,
      description: "Mock",
      simulated: true,
      source_url: null,
    },
  ];

  const mockTileSource = useMemo(() => {
    return createMockTileSource();
  }, []);

  const handleDataToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHasData(checked);
    if (checked) {
      inputsRef.current.sun_earth = {
        epoch_et: 0,
        sun_azimuth_rad: 0, // North
        sun_elevation_rad: 5 * (Math.PI / 180),
        sun_disk_fraction: 1,
        earth_azimuth_rad: 90 * (Math.PI / 180), // East
        earth_elevation_rad: 10 * (Math.PI / 180),
        earth_visible: true,
        dsn_visible: true,
        simulated: true,
      };
    } else {
      inputsRef.current.sun_earth = null;
    }
  };

  const handleSlopeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSlopeEnabled(checked);
    inputsRef.current.layers = { ...inputsRef.current.layers, slope: checked };
  };

  const horizon: HorizonMask | null = hasData
    ? {
        location: {
          lat_rad: ((sites[0]?.lat_deg ?? 0) * Math.PI) / 180,
          lon_rad: ((sites[0]?.lon_deg ?? 0) * Math.PI) / 180,
          elev_m: sites[0]?.elev_m,
        },
        mast_height_m: 2,
        azimuth_step_rad: 5 * (Math.PI / 180),
        mask_elevation_rad: Array.from({ length: 360 / 5 }, () => 2 * (Math.PI / 180)),
        simulated: true,
        provenance: {
          source: "mock",
          simulated: true,
          data_sources: [],
          spice_kernels: [],
          dem_citation: null,
          pipeline_version: null,
          data_version: "mock",
        },
      }
    : null;

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", position: "relative" }}>
      {/* Dev UI Panel */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          background: "rgba(0,0,0,0.8)",
          padding: 10,
          borderRadius: 8,
          color: "white",
          fontFamily: "sans-serif",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: "0 0 5px 0", fontSize: "14px" }}>Dev Panel</h3>
        <label style={{ fontSize: "13px" }}>
          <input type="checkbox" checked={hasData} onChange={handleDataToggle} /> Send Sun/Earth
          Data
        </label>
        <label style={{ fontSize: "13px" }}>
          <input type="checkbox" checked={slopeEnabled} onChange={handleSlopeToggle} /> Slope
          Overlay
        </label>
        <div style={{ fontSize: "12px", color: "#aaa", marginTop: "5px" }}>
          * Terrain shadows are visual only
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <MoonScene sites={sites} tileSource={mockTileSource} inputs={inputsRef} horizon={horizon} />
      </div>
      <div style={{ flex: 1, borderLeft: "2px solid #333", backgroundColor: "#000" }}>
        {sites[0] && (
          <FisheyeSky
            inputs={inputsRef}
            tileSource={mockTileSource}
            location={{
              lat_rad: (sites[0].lat_deg * Math.PI) / 180,
              lon_rad: (sites[0].lon_deg * Math.PI) / 180,
              elev_m: sites[0].elev_m,
            }}
            horizon={horizon}
          />
        )}
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<DevApp />);
}
