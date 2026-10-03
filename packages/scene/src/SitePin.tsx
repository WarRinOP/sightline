import { useMemo, type CSSProperties } from "react";
import { Html, Line } from "@react-three/drei";
import { Palette } from "./palette";
import { getLocalDirectionInScene, horizonRingPoints } from "./math";

interface SitePinProps {
  label: string;
  horizonMask?: import("@sightline/contracts").HorizonMask | null;
}

/** Ring radius (m): the engine's horizon drawn around the site at its real elevation angles. */
const RING_RADIUS_M = 400;
const COMPASS: readonly [string, number][] = [
  ["N", 0],
  ["E", Math.PI / 2],
  ["S", Math.PI],
  ["W", (3 * Math.PI) / 2],
];

// DOM labels: always upright and facing the screen (a 3D text was mirrored from behind).
const labelStyle: CSSProperties = {
  color: Palette.pinText,
  background: Palette.labelBackground,
  border: `1px solid ${Palette.labelBorder}`,
  borderRadius: 4,
  padding: "2px 8px",
  font: "600 12px/1.4 system-ui, sans-serif",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

const compassStyle: CSSProperties = {
  color: Palette.pinRing,
  font: "700 11px/1 system-ui, sans-serif",
  textShadow: `0 0 3px ${Palette.pinTextOutline}`,
  pointerEvents: "none",
  userSelect: "none",
};

export function SitePin({ label, horizonMask }: SitePinProps) {
  const ring = useMemo(() => {
    if (!horizonMask || horizonMask.mask_elevation_rad.length === 0) return null;
    const { lat_rad, lon_rad } = horizonMask.location;
    const points = horizonRingPoints(
      horizonMask.mask_elevation_rad,
      horizonMask.azimuth_step_rad,
      lat_rad,
      lon_rad,
      RING_RADIUS_M,
    );
    const compass = COMPASS.map(([name, az]) => ({
      name,
      position: getLocalDirectionInScene(lat_rad, lon_rad, az, 0)
        .multiplyScalar(RING_RADIUS_M * 1.12)
        .toArray(),
    }));
    return { points, compass };
  }, [horizonMask]);

  return (
    <group>
      {/* A mast and pad to mark the spot (not to scale: the profile's mast is 2 m). */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[2, 2, 20]} />
        <meshStandardMaterial color={Palette.pinMast} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[10, 10, 1]} />
        <meshStandardMaterial color={Palette.pinBase} />
      </mesh>

      {/* The engine's terrain horizon, 2 px wide at any distance. */}
      {ring && (
        <>
          <Line points={ring.points} color={Palette.pinRing} lineWidth={2} />
          {ring.compass.map((c) => (
            <Html key={c.name} position={c.position} center zIndexRange={[10, 0]}>
              <span style={compassStyle}>{c.name}</span>
            </Html>
          ))}
        </>
      )}

      <Html position={[0, 34, 0]} center zIndexRange={[11, 0]}>
        <div style={labelStyle}>{label}</div>
      </Html>
    </group>
  );
}
