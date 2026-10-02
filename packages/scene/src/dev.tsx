import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { MoonScene } from "./MoonScene";
import type { SceneInputs } from "./types";

function DevApp() {
  const inputsRef = useRef<SceneInputs>({
    epoch_et: 0,
    selected_site_id: "shackleton-rim",
    layers: {},
  });

  // A simulated tile source for local preview
  const mockTileSource = useMemo(() => {
    return {
      manifest: {
        id: "mock-tile",
        levels: 1,
        tileSize: 64,
        projection: "polar-stereo",
      },
      getTile: async (level: number, x: number, y: number) => {
        // Generate a simple heightmap patch
        const size = 64;
        const heights = new Float32Array(size * size);
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            heights[i * size + j] = Math.sin(i * 0.2) * Math.cos(j * 0.2) * 5;
          }
        }
        return { data: heights, offset: 0 };
      }
    };
  }, []);

  return (
    <Canvas camera={{ position: [0, 50, 100], fov: 45 }} shadows>
      <color attach="background" args={["#05070A"]} />
      
      {/* Sun Light (S1-06 part 2.4) */}
      <directionalLight 
        position={[100, 50, 0]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      >
        <mesh>
          <sphereGeometry args={[2]} />
          <meshBasicMaterial color="#FFC857" />
        </mesh>
      </directionalLight>
      <ambientLight intensity={0.1} />

      {/* Terrain (S1-06 part 2.2) */}
      <mesh receiveShadow castShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 64, 64]} />
        <meshStandardMaterial color="#888888" wireframe={false} />
      </mesh>
      <Text position={[0, 10, -50]} fontSize={5} color="#C77DFF">
        SIMULATED terrain
      </Text>

      {/* Site pin (S1-06 part 2.5) */}
      <group position={[0, 5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.5, 0.5, 10]} />
          <meshStandardMaterial color="#4CC9F0" />
        </mesh>
        <Text position={[0, 7, 0]} fontSize={3} color="#FFFFFF">
          Site Pin
        </Text>
      </group>

      <OrbitControls makeDefault minDistance={10} maxDistance={300} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<DevApp />);
}
