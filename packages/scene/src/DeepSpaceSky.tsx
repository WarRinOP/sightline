import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Palette } from "./palette";

interface DeepSpaceSkyProps {
  sunDirection: THREE.Vector3 | null;
  earthDirection: THREE.Vector3 | null;
}

const SUN_ANGULAR_RADIUS = 0.2666 * (Math.PI / 180);
const EARTH_ANGULAR_RADIUS = 0.95 * (Math.PI / 180);

export function DeepSpaceSky({ sunDirection, earthDirection }: DeepSpaceSkyProps) {
  const sunGroupRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    const D = 100000; // 100km inside far plane

    if (sunGroupRef.current) {
      if (sunDirection) {
        sunGroupRef.current.visible = true;
        sunGroupRef.current.position
          .copy(camera.position)
          .add(sunDirection.clone().multiplyScalar(D));
      } else {
        sunGroupRef.current.visible = false;
      }
    }

    if (earthRef.current) {
      if (earthDirection) {
        earthRef.current.visible = true;
        earthRef.current.position
          .copy(camera.position)
          .add(earthDirection.clone().multiplyScalar(D));
        earthRef.current.lookAt(camera.position);
      } else {
        earthRef.current.visible = false;
      }
    }
  });

  const sunRadius = 100000 * Math.tan(SUN_ANGULAR_RADIUS);
  const earthRadius = 100000 * Math.tan(EARTH_ANGULAR_RADIUS);

  return (
    <>
      <Stars radius={200000} depth={500} count={5000} factor={4} saturation={0} fade speed={0.5} />

      {/* Sun */}
      <group ref={sunGroupRef}>
        <mesh>
          <sphereGeometry args={[sunRadius, 32, 32]} />
          <meshBasicMaterial color={Palette.stars} />
        </mesh>
        <mesh>
          <sphereGeometry args={[sunRadius * 1.4, 32, 32]} />
          <meshBasicMaterial
            color={Palette.sunInner}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[sunRadius * 2.4, 32, 32]} />
          <meshBasicMaterial
            color={Palette.sunOuter}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[earthRadius, 32, 32]} />
        <meshStandardMaterial color={Palette.earth} roughness={0.7} metalness={0.1} />
      </mesh>
    </>
  );
}
