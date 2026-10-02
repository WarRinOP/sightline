import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

interface DeepSpaceSkyProps {
  sunDirection: THREE.Vector3;
  earthDirection?: THREE.Vector3;
}

export function DeepSpaceSky({ sunDirection, earthDirection = new THREE.Vector3(0, 0.5, 1).normalize() }: DeepSpaceSkyProps) {
  const sunRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // Keep Sun and Earth positioned at "infinity" relative to camera, but here we just place them far away.
    // In a real skybox, they would follow the camera or be rendered in a background pass.
    if (sunRef.current) {
      // 20000 km away
      sunRef.current.position.copy(sunDirection).multiplyScalar(20000);
      sunRef.current.position.y += 1737400; // Offset by moon radius to stay above scene origin
    }
    if (earthRef.current) {
      earthRef.current.position.copy(earthDirection).multiplyScalar(15000);
      earthRef.current.position.y += 1737400;
      // Make earth look at origin
      earthRef.current.lookAt(0, 1737400, 0);
    }
  });

  return (
    <>
      <Stars radius={10000} depth={500} count={5000} factor={4} saturation={0} fade speed={0.5} />
      
      {/* Sun */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#FFFAFA" />
        {/* Simple bloom hack using a slightly larger transparent sphere */}
        <mesh>
          <sphereGeometry args={[700, 32, 32]} />
          <meshBasicMaterial color="#FFEA00" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1200, 32, 32]} />
          <meshBasicMaterial color="#FFB300" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </mesh>

      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[200, 32, 32]} />
        {/* Earth phase is naturally created by the sunDirectional light hitting this standard material */}
        <meshStandardMaterial color="#4A90E2" roughness={0.7} metalness={0.1} />
      </mesh>
    </>
  );
}
