import { createRoot } from "react-dom/client";
import { useRef, useMemo } from "react";
import { MoonScene } from "./MoonScene";
import { FisheyeSky } from "./FisheyeSky";
import type { SceneInputs } from "./types";
import type { Site } from "@sightline/contracts";

function DevApp() {
  const inputsRef = useRef<SceneInputs>({
    epoch_et: 0,
    selected_site_id: "shackleton-rim",
    layers: {},
  });

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

  const mockTileSource: import("@sightline/contracts").TileSource = useMemo(() => {
    return {
      getManifest: async () => ({
        schema_version: 1 as const,
        data_version: "mock",
        projection: "polar_stereographic_south" as const,
        moon_radius_m: 1737400 as const,
        bounds_m: { x_min_m: -1000, y_min_m: -1000, x_max_m: 1000, y_max_m: 1000 },
        tile_size_px: 64,
        border_px: 1,
        level_count: 1,
        height_encoding: "uint16_offset" as const,
        height_scale_m: 0.1,
        simulated: true,
        provenance: { 
          source: "mock", 
          simulated: true, 
          data_sources: [], 
          spice_kernels: [], 
          dem_citation: null, 
          pipeline_version: null, 
          data_version: null 
        }
      }),
      getTile: async (coord: any) => {
        const size = 64;
        const heights = new Uint16Array(size * size);
        return {
          coord,
          size_px: size,
          offset_m: 0,
          scale_m: 0.1,
          heights,
          simulated: true,
        };
      }
    };
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <MoonScene 
          sites={sites} 
          tileSource={mockTileSource} 
          inputs={inputsRef} 
        />
      </div>
      <div style={{ flex: 1, borderLeft: "2px solid #333", backgroundColor: "#000" }}>
        {sites[0] && (
          <FisheyeSky 
            inputs={inputsRef}
            location={{ lat_rad: sites[0].lat_deg * Math.PI / 180, lon_rad: sites[0].lon_deg * Math.PI / 180, elev_m: sites[0].elev_m }}
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
