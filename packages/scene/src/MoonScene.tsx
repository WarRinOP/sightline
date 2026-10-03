import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MOON_REFERENCE_RADIUS_M, type Site, type TileManifest } from "@sightline/contracts";
import type { MoonSceneProps, CameraHandle } from "./types";
import { locationToScenePosition } from "./math";
import { createSkyState, updateSkyState, type SkyState } from "./sky";
import {
  clampAboveGround,
  heroPose,
  HERO_DURATION_S,
  HERO_SUN_OFFSET_RAD,
  smoothstep01,
  viewTowardPose,
  type CameraPose,
} from "./camera";
import { curvatureDropM, terrainHeightAtM } from "./terrainHeight";
import { TerrainQuadtree } from "./TerrainQuadtree";
import { DeepSpaceSky } from "./DeepSpaceSky";
import { SitePin } from "./SitePin";
import { Palette } from "./palette";
import { useSimulated } from "./simulated";

function sitePosition(site: Site): THREE.Vector3 {
  const [x, y, z] = locationToScenePosition(
    (site.lat_deg * Math.PI) / 180,
    (site.lon_deg * Math.PI) / 180,
    site.elev_m,
  );
  return new THREE.Vector3(x, y, z);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface CameraTween {
  from: CameraPose;
  to: CameraPose;
  start_ms: number;
  duration_ms: number;
}

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
  const sky = useRef<SkyState>(createSkyState());
  const [hasData, setHasData] = useState(true);
  const [manifest, setManifest] = useState<TileManifest | null>(null);
  const pinGroupRef = useRef<THREE.Group>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const tween = useRef<CameraTween | null>(null);
  const heroStart_ms = useRef<number | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    let cancelled = false;
    tileSource.getManifest().then(
      (m) => {
        if (!cancelled) setManifest(m);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [tileSource]);

  // The drawn ground: terrain height less the curvature drop from the selected site (terrainMaterial).
  const groundAt = (p: THREE.Vector3): number | null => {
    if (!manifest) return null;
    const h = terrainHeightAtM(tileSource, manifest, p.x, -p.z);
    if (h === null) return null;
    const o = sky.current.siteMap;
    return h - curvatureDropM(p.x - o.x, -p.z - o.y, MOON_REFERENCE_RADIUS_M);
  };

  /** Eased move of camera and orbit target; a jump under prefers-reduced-motion. */
  const moveCamera = (to: CameraPose, duration_s: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    heroStart_ms.current = null;
    clampAboveGround(to.position, groundAt(to.position));
    if (duration_s <= 0 || prefersReducedMotion()) {
      tween.current = null;
      camera.position.copy(to.position);
      controls.target.copy(to.target);
      controls.update();
      return;
    }
    tween.current = {
      from: { position: camera.position.clone(), target: controls.target.clone() },
      to,
      start_ms: performance.now(),
      duration_ms: duration_s * 1000,
    };
  };

  const selectedSite = () => sites.find((s) => s.id === inputs.current?.selected_site_id);

  /** Behind the pin looking toward the Sun or the Earth (map +y when the engine has not answered). */
  const viewPose = (body: "sun" | "earth", offset_rad = 0): CameraPose | null => {
    const site = selectedSite();
    if (!site) return null;
    const s = sky.current;
    const direction = !s.hasSunEarth
      ? new THREE.Vector3(0, 0, -1)
      : body === "sun"
        ? s.sunDirection
        : s.earthDirection;
    return viewTowardPose(sitePosition(site), direction, offset_rad);
  };

  useImperativeHandle(
    cameraRef,
    () => ({
      flyTo: (location) => {
        const [x, y, z] = locationToScenePosition(
          location.lat_rad,
          location.lon_rad,
          location.elev_m || 0,
        );
        const target = new THREE.Vector3(x, y, z);
        moveCamera(
          { position: target.clone().add(new THREE.Vector3(1000, 500, 1000)), target },
          2.5,
        );
      },
      viewToward: (body) => {
        const pose = viewPose(body);
        if (pose) moveCamera(pose, 3);
      },
      playHeroSequence: () => {
        const pose = viewPose("sun", HERO_SUN_OFFSET_RAD);
        if (!pose) return;
        if (prefersReducedMotion()) {
          moveCamera(pose, 0);
          return;
        }
        tween.current = null;
        heroStart_ms.current = performance.now();
      },
    }),
    [camera, sites, inputs, manifest, tileSource],
  );

  // Runs before every other frame callback (priority -1 still lets R3F render): the pin, the sky
  // state and the light follow the engine's answer for the selected site, without React state.
  useFrame(() => {
    const site = selectedSite();
    const sunEarth = inputs.current?.sun_earth;
    if (site && pinGroupRef.current) pinGroupRef.current.position.copy(sitePosition(site));
    updateSkyState(sky.current, sunEarth, site);
    const light = sunLightRef.current;
    if (light) {
      light.visible = sky.current.hasSunEarth;
      light.position.copy(sky.current.sunDirection).multiplyScalar(100);
    }
    const nowHasData = site !== undefined && sunEarth != null;
    if (nowHasData !== hasData) setHasData(nowHasData);
  }, -1);

  // Camera: the Hero flight or an eased move, then the ground clamp, after the orbit controls.
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (heroStart_ms.current !== null) {
      const t_s = (performance.now() - heroStart_ms.current) / 1000;
      const end = viewPose("sun", HERO_SUN_OFFSET_RAD);
      if (!end || t_s >= HERO_DURATION_S) {
        heroStart_ms.current = null;
        if (end) {
          camera.position.copy(end.position);
          controls.target.copy(end.target);
        }
      } else {
        const pose = heroPose(t_s, end);
        camera.position.copy(pose.position);
        controls.target.copy(pose.target);
      }
      controls.update();
    } else if (tween.current) {
      const { from, to, start_ms, duration_ms } = tween.current;
      const e = smoothstep01((performance.now() - start_ms) / duration_ms);
      camera.position.lerpVectors(from.position, to.position, e);
      controls.target.lerpVectors(from.target, to.target, e);
      if (e >= 1) tween.current = null;
      controls.update();
    }
    clampAboveGround(camera.position, groundAt(camera.position));
  });

  return (
    <>
      <color attach="background" args={[Palette.sceneBackground]} />

      <DeepSpaceSky sky={sky} />

      {/* Lights the pin only; the terrain shades itself from the same sky state. */}
      <directionalLight ref={sunLightRef} intensity={1.5} visible={false} />
      <ambientLight intensity={0.15} />

      {/* Real Terrain mesh */}
      <group>
        <TerrainQuadtree tileSource={tileSource} sky={sky} inputs={inputs} />
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
          <Html position={[0, 70, 0]} center zIndexRange={[12, 0]}>
            <div
              style={{
                color: Palette.pinText,
                background: Palette.labelBackground,
                padding: "2px 8px",
                borderRadius: 4,
                font: "12px/1.4 system-ui, sans-serif",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              No Sun/Earth data
            </div>
          </Html>
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
        {/* No shadow maps: the terrain shades and shadows itself in its shader (terrainMaterial.ts). */}
        <Canvas camera={{ position: [0, 5000, 10000], fov: 45, near: 5, far: 500000 }}>
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
