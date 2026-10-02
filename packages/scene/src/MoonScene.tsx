import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { MoonSceneProps, CameraHandle } from "./types";
import { locationToScenePosition } from "./math";
import { TerrainQuadtree } from "./TerrainQuadtree";
import { DeepSpaceSky } from "./DeepSpaceSky";

function SceneContent({ sites, tileSource, inputs }: Omit<MoonSceneProps, "ref" | "onReady" | "onPickLocation">) {
  const [sunDirection, setSunDirection] = useState(new THREE.Vector3(1, 0.5, 0));
  const pinGroupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    // We would poll inputs.current.epoch_et here to move the sun,
    // but without getSunEarth locally, we'll keep it static or simulated for now.
    
    // Position pin based on selected_site_id
    if (pinGroupRef.current && inputs.current) {
      const selectedId = inputs.current.selected_site_id;
      const site = sites.find(s => s.id === selectedId);
      if (site) {
        // use site.lat_deg, lon_deg, elev_m
        const lat_rad = (site.lat_deg * Math.PI) / 180;
        const lon_rad = (site.lon_deg * Math.PI) / 180;
        const [x, y, z] = locationToScenePosition(lat_rad, lon_rad, site.elev_m);
        pinGroupRef.current.position.set(x, y, z);
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#05070A"]} />
      
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

      {/* Terrain (SIMULATED) */}
      <group position={[0, 1737400, 0]}> {/* Shift simulated terrain up to Moon surface for preview if needed, but let's just keep it at origin relative to Moon center */}
        
      </group>
      {/* We will just center our camera at the first site for now */}
      
      {/* Real Terrain mesh will go here */}
      <group position={[0, 1737400, 0]}>
        <TerrainQuadtree tileSource={tileSource} sunDirection={sunDirection} inputs={inputs} />
      </group>

      {/* Site pin */}
      <group ref={pinGroupRef}>
        <mesh castShadow>
          <cylinderGeometry args={[50, 50, 1000]} />
          <meshStandardMaterial color="#4CC9F0" />
        </mesh>
        <Text position={[0, 700, 0]} fontSize={300} color="#FFFFFF">
          Site Pin
        </Text>
      </group>

      <OrbitControls ref={controlsRef} makeDefault minDistance={100} maxDistance={50000} target={[0, 1737400, 0]} maxPolarAngle={Math.PI / 2} />
    </>
  );
}

export function MoonScene({ sites, tileSource, inputs, ref, onReady, onPickLocation }: MoonSceneProps) {
  useImperativeHandle(ref, () => ({
    flyTo: (location) => {
      // Stub
    }
  }), []);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div style={{ width: "100%", height: "100%", display: "block" }}>
      <Canvas shadows camera={{ position: [0, 1737400 + 5000, 10000], fov: 45 }}>
        <SceneContent sites={sites} tileSource={tileSource} inputs={inputs} />
      </Canvas>
    </div>
  );
}
