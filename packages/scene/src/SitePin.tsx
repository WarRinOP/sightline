import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { Palette } from "./palette";

interface SitePinProps {
  label: string;
  horizonMask?: number[] | null;
}

export function SitePin({ label, horizonMask }: SitePinProps) {
  const ringGeometry = useMemo(() => {
    if (!horizonMask || horizonMask.length === 0) return null;

    const radius = 400; // Ring radius in meters
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const az = (i % 360) * (Math.PI / 180);
      const el = (horizonMask[i % 360] || 0) * (Math.PI / 180);

      const x = Math.sin(az) * radius;
      const z = Math.cos(az) * radius;
      const y = Math.tan(el) * radius; // Height above the horizontal plane at that radius

      curvePoints.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    return new THREE.TubeGeometry(curve, 360, 5, 8, true);
  }, [horizonMask]);

  return (
    <group>
      {/* The Central Mast (Landers are typically tall, let's make it 20m) */}
      <mesh castShadow position={[0, 10, 0]}>
        <cylinderGeometry args={[2, 2, 20]} />
        <meshStandardMaterial color={Palette.pinMast} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* The base / landing pad */}
      <mesh receiveShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[10, 10, 1]} />
        <meshStandardMaterial color={Palette.pinBase} />
      </mesh>

      {/* Extruded Horizon Ring */}
      {ringGeometry && (
        <mesh geometry={ringGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={Palette.pinRing}
            emissive={Palette.pinRing}
            emissiveIntensity={0.5}
            wireframe={false}
          />
        </mesh>
      )}

      {/* Floating lines dropping from the horizon ring to the ground */}
      {ringGeometry && (
        <gridHelper
          args={[
            800,
            20,
            parseInt(Palette.pinRing.slice(1), 16),
            parseInt(Palette.pinRing.slice(1), 16),
          ]}
          position={[0, 0, 0]}
          material-opacity={0.1}
          material-transparent
        />
      )}

      {/* Floating Label */}
      <Text
        position={[0, 40, 0]}
        fontSize={30}
        color={Palette.pinText}
        outlineWidth={2}
        outlineColor={Palette.pinTextOutline}
      >
        {label}
      </Text>
    </group>
  );
}
