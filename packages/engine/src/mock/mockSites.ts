import { siteLocation, type Site } from "@sightline/contracts";
import { mockHeightM, projectSouthPolar } from "./mockTerrain";

const PLACEHOLDER =
  "SIMULATED placeholder named after a real feature. Coordinates are nominal, not surveyed, and " +
  "the terrain is synthetic. The verified catalog arrives with `sightline sites` (M1-06).";

function placeholderSite(
  id: string,
  name: string,
  lat_deg: number,
  lon_deg: number,
  detail: string,
): Site {
  const { x_m, y_m } = projectSouthPolar(siteLocation({ lat_deg, lon_deg }));
  return {
    id,
    name,
    lat_deg,
    lon_deg,
    // Height of the synthetic terrain at this point, to 0.1 m.
    elev_m: Math.round(mockHeightM(x_m, y_m) * 10) / 10,
    description: `${detail} ${PLACEHOLDER}`,
    simulated: true,
    source_url: null,
  };
}

export const MOCK_SITES: readonly Site[] = Object.freeze([
  placeholderSite("shackleton-rim", "Shackleton Rim", -89.8, 0, "Rim of the large synthetic bowl."),
  placeholderSite(
    "connecting-ridge",
    "Connecting Ridge",
    -89.7,
    90,
    "Open ground away from the bowls, with a long clear horizon.",
  ),
  placeholderSite(
    "de-gerlache-rim-2",
    "de Gerlache Rim 2",
    -89.8,
    -160,
    "Rim of the large bowl, close to the smaller one.",
  ),
]);
