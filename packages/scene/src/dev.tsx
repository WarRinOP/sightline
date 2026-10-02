import { createRoot } from "react-dom/client";
import { useRef, useMemo } from "react";
import { MoonScene } from "./MoonScene";
import { FisheyeSky } from "./FisheyeSky";
import type { SceneInputs } from "./types";
import type { Site } from "@sightline/contracts";
import { createMockTileSource } from "@sightline/engine";

function DevApp() {
  const inputsRef = useRef<SceneInputs>({
    epoch_et: 0,
    selected_site_id: "shackleton-rim",
    layers: {},
    sun: null,
    earth: null,
    horizon_mask: null,
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

  // Load the real mock tile source from the engine package
  const mockTileSource = useMemo(() => {
    return createMockTileSource();
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <MoonScene sites={sites} tileSource={mockTileSource} inputs={inputsRef} />
      </div>
      <div style={{ flex: 1, borderLeft: "2px solid #333", backgroundColor: "#000" }}>
        {sites[0] && (
          <FisheyeSky
            inputs={inputsRef}
            location={{
              lat_rad: (sites[0].lat_deg * Math.PI) / 180,
              lon_rad: (sites[0].lon_deg * Math.PI) / 180,
              elev_m: sites[0].elev_m,
            }}
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
