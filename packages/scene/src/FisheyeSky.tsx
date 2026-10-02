import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import type { FisheyeSkyProps, SceneInputs } from "./types";
import { Palette } from "./palette";
import type { HorizonMask, TileSource } from "@sightline/contracts";

function FisheyeContent({
  inputs,
  horizon,
  tileSource,
}: {
  inputs: React.MutableRefObject<SceneInputs> | undefined;
  horizon: HorizonMask | null;
  tileSource: TileSource;
}) {
  const sunRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const dataLabelRef = useRef<THREE.Mesh>(null);
  const simBadgeRef = useRef<THREE.Mesh>(null);
  const [isManifestSimulated, setIsManifestSimulated] = useState(false);

  useEffect(() => {
    tileSource.getManifest().then((m) => {
      setIsManifestSimulated(m.simulated);
    });
  }, [tileSource]);

  useFrame(() => {
    const sunEarth = inputs?.current?.sun_earth;
    const hasData = !!sunEarth || !!horizon;

    if (dataLabelRef.current) {
      dataLabelRef.current.visible = !hasData;
    }
    if (simBadgeRef.current) {
      simBadgeRef.current.visible =
        sunEarth?.simulated === true || horizon?.simulated === true || isManifestSimulated === true;
    }

    if (sunRef.current) {
      if (sunEarth) {
        sunRef.current.visible = true;
        const az = sunEarth.sun_azimuth_rad;
        const el = sunEarth.sun_elevation_rad;
        const r = 45 * (1 - el / (Math.PI / 2));
        sunRef.current.position.set(Math.sin(az) * r, Math.cos(az) * r, 0);
      } else {
        sunRef.current.visible = false;
      }
    }

    if (earthRef.current) {
      if (sunEarth && sunEarth.earth_visible) {
        earthRef.current.visible = true;
        const az = sunEarth.earth_azimuth_rad;
        const el = sunEarth.earth_elevation_rad;
        const r = 45 * (1 - el / (Math.PI / 2));
        earthRef.current.position.set(Math.sin(az) * r, Math.cos(az) * r, 0);
      } else {
        earthRef.current.visible = false;
      }
    }
  });

  const horizonLine = useMemo(() => {
    if (!horizon) return null;
    const points: THREE.Vector3[] = [];
    const mask = horizon.mask_elevation_rad;
    const step = horizon.azimuth_step_rad;
    for (let i = 0; i <= mask.length; i++) {
      const idx = i % mask.length;
      const az = idx * step;
      const el = mask[idx] ?? 0;
      const r = 45 * (1 - el / (Math.PI / 2));
      points.push(new THREE.Vector3(Math.sin(az) * r, Math.cos(az) * r, 0));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [horizon]);

  return (
    <>
      <color attach="background" args={[Palette.skyBackground]} />

      {/* Outer horizon ring (equator) */}
      <mesh>
        <ringGeometry args={[44.5, 45, 64]} />
        <meshBasicMaterial color={Palette.skyGrid} side={THREE.DoubleSide} />
      </mesh>

      {/* Horizon Mask Line */}
      {horizonLine && (
        <lineLoop geometry={horizonLine}>
          <lineBasicMaterial color={Palette.terrain} />
        </lineLoop>
      )}

      {/* Compass / Horizon markers */}
      <Text position={[0, 48, 0]} fontSize={5} color={Palette.skyText}>
        N
      </Text>
      <Text position={[0, -48, 0]} fontSize={5} color={Palette.skyText}>
        S
      </Text>
      <Text position={[48, 0, 0]} fontSize={5} color={Palette.skyText}>
        E
      </Text>
      <Text position={[-48, 0, 0]} fontSize={5} color={Palette.skyText}>
        W
      </Text>

      {/* Sun marker */}
      <mesh ref={sunRef}>
        <circleGeometry args={[2, 32]} />
        <meshBasicMaterial color={Palette.skySun} />
      </mesh>

      {/* Earth marker */}
      <mesh ref={earthRef}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial color={Palette.skyEarth} />
      </mesh>

      {/* Center Pin (Zenith) */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color={Palette.skyCenterPin} />
      </mesh>

      {/* Labels */}
      <mesh ref={dataLabelRef} visible={false}>
        <Text position={[0, -10, 0]} fontSize={4} color={Palette.skyText}>
          no data
        </Text>
      </mesh>

      <mesh ref={simBadgeRef} visible={false}>
        <Text position={[0, -35, 0]} fontSize={4} color={Palette.simulatedBadge}>
          SIMULATED
        </Text>
      </mesh>

      {/* Camera: orthographic, looking down */}
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={6} />
    </>
  );
}

export function FisheyeSky({ inputs, horizon, tileSource, onReady }: FisheyeSkyProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div style={{ width: "100%", height: "100%", display: "block" }}>
      <Canvas>
        <FisheyeContent inputs={inputs} horizon={horizon} tileSource={tileSource} />
      </Canvas>
    </div>
  );
}
