import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { MoonSceneProps, CameraHandle } from "./types";
import { locationToScenePosition, getLocalDirectionInScene } from "./math";
import { TerrainQuadtree } from "./TerrainQuadtree";
import { DeepSpaceSky } from "./DeepSpaceSky";
import { SitePin } from "./SitePin";
import { Palette } from "./palette";

function SceneContent({
  sites,
  tileSource,
  inputs,
  cameraRef,
}: Omit<MoonSceneProps, "ref" | "onReady" | "onPickLocation"> & {
  cameraRef?: React.Ref<CameraHandle>;
}) {
  const [sunDirection, setSunDirection] = useState(new THREE.Vector3(1, 0.5, 0));
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
    [camera],
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

        // Update Sun direction based on inputs
        if (inputs.current.sun) {
          const newSunDir = getLocalDirectionInScene(
            lat_rad,
            lon_rad,
            inputs.current.sun.az_rad,
            inputs.current.sun.el_rad,
          );
          if (newSunDir.distanceTo(sunDirection) > 0.001) {
            setSunDirection(newSunDir);
          }
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
      <DeepSpaceSky sunDirection={sunDirection} />

      {/* Sun Light */}
      <directionalLight
        position={sunDirection.clone().multiplyScalar(100)}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
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
          horizonMask={inputs.current?.horizon_mask}
        />
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

export function MoonScene({ sites, tileSource, inputs, ref, onReady }: MoonSceneProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div style={{ width: "100%", height: "100%", display: "block" }}>
      <Canvas shadows camera={{ position: [0, 5000, 10000], fov: 45, near: 0.1, far: 500000 }}>
        <SceneContent sites={sites} tileSource={tileSource} inputs={inputs} cameraRef={ref} />
      </Canvas>
    </div>
  );
}
