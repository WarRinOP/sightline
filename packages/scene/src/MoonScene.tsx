import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { MoonSceneProps, CameraHandle } from "./types";
import { locationToScenePosition, getLocalDirectionInScene } from "./math";
import { TerrainQuadtree } from "./TerrainQuadtree";
import { DeepSpaceSky } from "./DeepSpaceSky";
import { SitePin } from "./SitePin";
import { Palette } from "./palette";
import { useSimulated } from "./simulated";

function SceneContent({
  sites,
  tileSource,
  inputs,
  cameraRef,
  horizon,
}: Omit<MoonSceneProps, "ref" | "onReady" | "onPickLocation"> & {
  cameraRef?: React.Ref<CameraHandle>;
  horizon: import("@sightline/contracts").HorizonMask | null;
}) {
  const [sunDirection, setSunDirection] = useState<THREE.Vector3 | null>(null);
  const [earthDirection, setEarthDirection] = useState<THREE.Vector3 | null>(null);
  const [hasData, setHasData] = useState(true);
  const pinGroupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  // Hero sequence state
  const isPlayingHero = useRef(false);
  const heroStartTime = useRef(0);
  const { camera } = useThree();

  useImperativeHandle(
    cameraRef,
    () => ({
      flyTo: (location) => {
        // Basic fly-to implementation
        if (controlsRef.current) {
          const [x, y, z] = locationToScenePosition(
            location.lat_rad,
            location.lon_rad,
            location.elev_m || 0,
          );

          // Move camera to a safe distance
          camera.position.set(x + 1000, y + 500, z + 1000);
          controlsRef.current.target.set(x, y, z);
          controlsRef.current.update();
        }
      },
      playHeroSequence: () => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReducedMotion) {
          if (inputs.current) {
            const selectedId = inputs.current.selected_site_id;
            const site = sites.find((s) => s.id === selectedId);
            if (site) {
              const lat_rad = (site.lat_deg * Math.PI) / 180;
              const lon_rad = (site.lon_deg * Math.PI) / 180;
              const [x, y, z] = locationToScenePosition(lat_rad, lon_rad, site.elev_m);
              camera.position.set(x + 1000, y + 500, z + 1000);
              if (controlsRef.current) {
                controlsRef.current.target.set(x, y, z);
                controlsRef.current.update();
              }
            }
          }
          return;
        }
        isPlayingHero.current = true;
        heroStartTime.current = performance.now();
      },
    }),
    [camera, sites, inputs],
  );

  useFrame(() => {
    // Position pin based on selected_site_id
    const targetPos = new THREE.Vector3(0, 0, 0);
    if (inputs.current) {
      const selectedId = inputs.current.selected_site_id;
      const site = sites.find((s) => s.id === selectedId);
      if (site) {
        const lat_rad = (site.lat_deg * Math.PI) / 180;
        const lon_rad = (site.lon_deg * Math.PI) / 180;
        const [x, y, z] = locationToScenePosition(lat_rad, lon_rad, site.elev_m);
        targetPos.set(x, y, z);
        if (pinGroupRef.current) {
          pinGroupRef.current.position.copy(targetPos);
        }

        // Update Sun/Earth directions based on inputs
        if (inputs.current.sun_earth) {
          if (!hasData) setHasData(true);
          const newSunDir = getLocalDirectionInScene(
            lat_rad,
            lon_rad,
            inputs.current.sun_earth.sun_azimuth_rad,
            inputs.current.sun_earth.sun_elevation_rad,
          );
          if (!sunDirection || newSunDir.distanceTo(sunDirection) > 0.001) {
            setSunDirection(newSunDir);
          }

          const newEarthDir = getLocalDirectionInScene(
            lat_rad,
            lon_rad,
            inputs.current.sun_earth.earth_azimuth_rad,
            inputs.current.sun_earth.earth_elevation_rad,
          );
          if (!earthDirection || newEarthDir.distanceTo(earthDirection) > 0.001) {
            setEarthDirection(newEarthDir);
          }
        } else {
          if (hasData) setHasData(false);
          if (sunDirection) setSunDirection(null);
          if (earthDirection) setEarthDirection(null);
        }
      }
    }

    // Handle hero sequence camera animation (20 seconds)
    if (isPlayingHero.current && controlsRef.current) {
      const elapsed = (performance.now() - heroStartTime.current) / 1000;
      if (elapsed > 20) {
        isPlayingHero.current = false; // Stop after 20 seconds
      } else {
        // Hero Sequence Logic:
        // Start high up and far away, slowly spiral down and approach the target site
        const t = elapsed / 20; // 0 to 1

        // Use smoothstep for easing
        const ease = t * t * (3.0 - 2.0 * t);

        // Spiral parameters
        const startRadius = 20000;
        const endRadius = 1500;
        const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, ease);

        const startHeight = 15000;
        const endHeight = 200;
        const currentHeight = THREE.MathUtils.lerp(startHeight, endHeight, ease);

        // Rotate around the Y axis
        const angle = ease * Math.PI * 2.5; // 1.25 revolutions

        const camX = targetPos.x + Math.sin(angle) * currentRadius;
        const camZ = targetPos.z + Math.cos(angle) * currentRadius;
        const camY = targetPos.y + currentHeight;

        camera.position.set(camX, camY, camZ);
        controlsRef.current.target.copy(targetPos);
        controlsRef.current.update();
      }
    }
  });

  return (
    <>
      <color attach="background" args={[Palette.sceneBackground]} />

      {/* Deep Space Sky */}
      <DeepSpaceSky sunDirection={sunDirection} earthDirection={earthDirection} />

      {/* Sun Light */}
      {sunDirection && (
        <directionalLight
          position={sunDirection.clone().multiplyScalar(100)}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
      )}
      <ambientLight intensity={0.1} />

      {/* Real Terrain mesh */}
      <group>
        <TerrainQuadtree tileSource={tileSource} sunDirection={sunDirection} inputs={inputs} />
      </group>

      {/* Site pin */}
      <group ref={pinGroupRef}>
        <SitePin
          label={
            sites.find((s) => s.id === inputs.current?.selected_site_id)?.name || "Target Site"
          }
          horizonMask={horizon}
        />
        {!hasData && (
          <Text
            position={[0, 80, 0]}
            fontSize={20}
            color={Palette.pinText}
            outlineWidth={2}
            outlineColor={Palette.pinTextOutline}
          >
            No Sun/Earth data
          </Text>
        )}
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={100}
        maxDistance={50000}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export const MoonScene = forwardRef<CameraHandle, Omit<MoonSceneProps, "ref">>(
  ({ sites, tileSource, inputs, horizon, onReady }, ref) => {
    useEffect(() => {
      onReady?.();
    }, [onReady]);
    const simulated = useSimulated(tileSource, inputs, horizon);

    return (
      <div style={{ width: "100%", height: "100%", display: "block", position: "relative" }}>
        {/* near = 5 m: with near 0.1 and far 500 km the depth buffer would flicker at 10 km. */}
        <Canvas
          shadows="percentage"
          camera={{ position: [0, 5000, 10000], fov: 45, near: 5, far: 500000 }}
        >
          <SceneContent
            sites={sites}
            tileSource={tileSource}
            inputs={inputs}
            cameraRef={ref}
            horizon={horizon}
          />
        </Canvas>
        {simulated && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "2px 8px",
              border: `1px solid ${Palette.simulatedBadge}`,
              color: Palette.simulatedBadge,
              fontFamily: "sans-serif",
              fontSize: 12,
              letterSpacing: "0.08em",
            }}
          >
            SIMULATED
          </div>
        )}
      </div>
    );
  },
);
