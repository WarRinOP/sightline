import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import type { FisheyeSkyProps } from "./types";

function FisheyeContent() {
  const sunRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // Normally we'd use inputs.current.epoch_et and location to fetch the Sun/Earth state.
    // For now, animate the sun slightly for the preview.
    if (sunRef.current) {
      const time = Date.now() * 0.001;
      sunRef.current.position.x = Math.cos(time) * 40;
      sunRef.current.position.y = Math.sin(time) * 40;
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />

      {/* Outer horizon ring */}
      <mesh>
        <ringGeometry args={[45, 50, 64]} />
        <meshBasicMaterial color="#333333" side={THREE.DoubleSide} />
      </mesh>

      {/* Compass / Horizon markers */}
      <Text position={[0, 40, 0]} fontSize={5} color="#AAAAAA">
        N
      </Text>
      <Text position={[0, -40, 0]} fontSize={5} color="#AAAAAA">
        S
      </Text>
      <Text position={[40, 0, 0]} fontSize={5} color="#AAAAAA">
        E
      </Text>
      <Text position={[-40, 0, 0]} fontSize={5} color="#AAAAAA">
        W
      </Text>

      {/* Sun marker */}
      <mesh ref={sunRef} position={[20, 20, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshBasicMaterial color="#FFC857" />
      </mesh>

      {/* Earth marker */}
      <mesh ref={earthRef} position={[-20, 10, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial color="#4CC9F0" />
      </mesh>

      {/* "Now" marker in the center */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#FF0000" />
      </mesh>

      {/* Camera: orthographic, looking down */}
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={8} />
    </>
  );
}

export function FisheyeSky({ onReady }: FisheyeSkyProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div style={{ width: "100%", height: "100%", display: "block" }}>
      <Canvas>
        <FisheyeContent />
      </Canvas>
    </div>
  );
}
