import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

interface SitePinProps {
  label: string;
  // A simulated horizon array (azimuth 0-360) mapped to elevation angles (in degrees)
  horizonMask?: number[];
}

export function SitePin({ label, horizonMask }: SitePinProps) {
  // Generate a mock horizon mask if none is provided
  const mask = useMemo(() => {
    if (horizonMask && horizonMask.length > 0) return horizonMask;
    const mock = new Array(360);
    for (let i = 0; i < 360; i++) {
      // Simulate jagged terrain horizon: base 5 deg + some low frequency noise
      mock[i] =
        5 + Math.sin(((i * Math.PI) / 180) * 4) * 2 + Math.cos(((i * Math.PI) / 180) * 7) * 1.5;
    }
    return mock;
  }, [horizonMask]);

  // Create the 3D ring geometry from the horizon mask
  const ringGeometry = useMemo(() => {
    const radius = 400; // Ring radius in meters
    const shape = new THREE.Shape();

    // Create a 2D shape for the extruded ring cross-section
    const width = 10;
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, 50);
    shape.lineTo(-width / 2, 50);
    shape.lineTo(-width / 2, 0);

    // We will build a custom Tube-like geometry or just modify a torus/cylinder
    // Actually, generating a custom line or tube along the mask heights is better:
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const az = (i % 360) * (Math.PI / 180);
      const el = mask[i % 360] * (Math.PI / 180);

      const x = Math.sin(az) * radius;
      const z = Math.cos(az) * radius;
      const y = Math.tan(el) * radius; // Height above the horizontal plane at that radius

      curvePoints.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    // Use TubeGeometry to sweep a circle along the horizon curve
    return new THREE.TubeGeometry(curve, 360, 5, 8, true);
  }, [mask]);

  return (
    <group>
      {/* The Central Mast (Landers are typically tall, let's make it 20m) */}
      <mesh castShadow position={[0, 10, 0]}>
        <cylinderGeometry args={[2, 2, 20]} />
        <meshStandardMaterial color="#CCCCCC" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* The base / landing pad */}
      <mesh receiveShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[10, 10, 1]} />
        <meshStandardMaterial color="#4CC9F0" />
      </mesh>

      {/* Extruded Horizon Ring */}
      <mesh geometry={ringGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#FF3366"
          emissive="#FF3366"
          emissiveIntensity={0.5}
          wireframe={false}
        />
      </mesh>

      {/* Floating lines dropping from the horizon ring to the ground */}
      <gridHelper
        args={[800, 20, 0xff3366, 0xff3366]}
        position={[0, 0, 0]}
        material-opacity={0.1}
        material-transparent
      />

      {/* Floating Label */}
      <Text
        position={[0, 40, 0]}
        fontSize={30}
        color="#FFFFFF"
        outlineWidth={2}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}
