import { useEffect, useState, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TileSource, TileManifest, TileData, TileCoord } from "@sightline/contracts";
import type { SceneInputs } from "./types";
import { Palette } from "./palette";

// --- Tile Cache ---
// Cache tiles by coordinate to avoid re-fetching on remount (Task 5)
const tileCache = new Map<string, Promise<TileData>>();
function getCachedTile(source: TileSource, coord: TileCoord): Promise<TileData> {
  const key = `${coord.level}_${coord.x}_${coord.y}`;
  if (!tileCache.has(key)) {
    tileCache.set(key, source.getTile(coord));
  }
  return tileCache.get(key)!;
}

// --- Shared Material ---
// Share one material instead of creating a new onBeforeCompile per node (Task 5)
const sharedTerrainMaterial = new THREE.MeshStandardMaterial({
  color: Palette.terrain,
  wireframe: false,
  flatShading: true,
});

sharedTerrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uSunDirection = { value: new THREE.Vector3(1, 0.5, 0) };
  shader.uniforms.uHeightTexture = { value: null };
  shader.uniforms.uBounds = { value: new THREE.Vector4(0, 0, 0, 0) };
  shader.uniforms.uLayerMode = { value: 0 };

  // Attach uniforms to material so onBeforeRender can access them
  sharedTerrainMaterial.userData.shader = shader;

  shader.vertexShader = `
    varying vec3 vTerrainWorldPos;
    ${shader.vertexShader}
  `.replace(
    "#include <worldpos_vertex>",
    `
    #include <worldpos_vertex>
    vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `,
  );

  shader.fragmentShader = `
    uniform vec3 uSunDirection;
    uniform sampler2D uHeightTexture;
    uniform vec4 uBounds; // x_min, y_min, x_max, y_max
    uniform int uLayerMode;
    varying vec3 vTerrainWorldPos;
    
    vec3 magma(float t) { return vec3(t, t * 0.5, 0.2 + 0.8 * t); }
    
    ${shader.fragmentShader}
  `;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    `
    #include <dithering_fragment>
    
    vec3 viewDir = normalize(vViewPosition);
    float cosE = max(0.01, dot(geometryNormal, viewDir));
    float cosI = max(0.01, dot(geometryNormal, uSunDirection));
    float lommelSeeliger = cosI / (cosI + cosE);
    
    // Note: These shadows are visual only. Real shadows are determined by the horizon mask (Task 10).
    float shadowMask = 1.0;
    if (cosI > 0.0) {
      vec3 rayPos = vTerrainWorldPos;
      vec3 rayDir = normalize(uSunDirection);
      float stepSize = (uBounds.z - uBounds.x) / 64.0; 
      
      for (int i = 1; i <= 8; i++) {
        rayPos += rayDir * stepSize;
        // Fix shadow shader UV border offset (Task 6)
        float u = ((rayPos.x - uBounds.x) / (uBounds.z - uBounds.x) * 62.0 + 1.0) / 64.0;
        float v = ((-rayPos.z - uBounds.y) / (uBounds.w - uBounds.y) * 62.0 + 1.0) / 64.0;
        
        if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
          float h = texture2D(uHeightTexture, vec2(u, v)).r;
          if (h > rayPos.y) {
            shadowMask = 0.0;
            break;
          }
        }
      }
    } else {
      shadowMask = 0.0;
    }
    
    vec3 finalColor = gl_FragColor.rgb * (0.5 + 1.5 * lommelSeeliger) * shadowMask;
    
    // Apply overlays based on uLayerMode
    if (uLayerMode == 1) {
      float slope = 1.0 - dot(geometryNormal, vec3(0.0, 1.0, 0.0));
      float normSlope = clamp(slope / 0.3, 0.0, 1.0);
      finalColor = mix(finalColor, magma(normSlope), 0.7);
    }
    // Note: PSR, Illum, DTE overlays removed (Task 8)
    
    gl_FragColor.rgb = finalColor;
    `,
  );
};

interface TerrainQuadtreeProps {
  tileSource: TileSource;
  sunDirection: THREE.Vector3;
  inputs: React.MutableRefObject<SceneInputs>;
}

interface TerrainNodeProps {
  tileSource: TileSource;
  manifest: TileManifest;
  coord: TileCoord;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
  sunDirection: THREE.Vector3;
  inputs: React.MutableRefObject<SceneInputs>;
}

function TerrainNode({
  tileSource,
  manifest,
  coord,
  bounds,
  sunDirection,
  inputs,
}: TerrainNodeProps) {
  const { camera } = useThree();
  const [tileData, setTileData] = useState<TileData | null>(null);

  // 0 = unsubdivided, 1 = loading children, 2 = subdivided
  const [subdivisionState, setSubdivisionState] = useState<0 | 1 | 2>(0);

  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    let canceled = false;
    getCachedTile(tileSource, coord)
      .then((data) => {
        if (!canceled) setTileData(data);
      })
      .catch((e) => {
        console.warn("Failed to load tile", coord, e);
      });
    return () => {
      canceled = true;
    };
  }, [tileSource, coord]);

  useFrame(() => {
    const center = new THREE.Vector3(
      (bounds.x_min + bounds.x_max) / 2,
      tileData?.offset_m || 0,
      -(bounds.y_min + bounds.y_max) / 2,
    );
    const dist = camera.position.distanceTo(center);
    const size = bounds.x_max - bounds.x_min;

    const shouldSubdivide = dist < size * 2 && coord.level < manifest.level_count - 1;

    if (shouldSubdivide && subdivisionState === 0) {
      setSubdivisionState(1); // loading

      const nextLevel = coord.level + 1;
      const c1 = { level: nextLevel, x: coord.x * 2, y: coord.y * 2 + 1 };
      const c2 = { level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 };
      const c3 = { level: nextLevel, x: coord.x * 2, y: coord.y * 2 };
      const c4 = { level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 };

      // Load the four with Promise.allSettled, and subdivide only if all fulfil (Task 5)
      Promise.allSettled([
        getCachedTile(tileSource, c1),
        getCachedTile(tileSource, c2),
        getCachedTile(tileSource, c3),
        getCachedTile(tileSource, c4),
      ]).then((results) => {
        const allFulfilled = results.every((r) => r.status === "fulfilled");
        if (allFulfilled) {
          setSubdivisionState(2);
        } else {
          // Stay unsubdivided if children fail
          setSubdivisionState(0);
        }
      });
    } else if (!shouldSubdivide && subdivisionState === 2) {
      setSubdivisionState(0);
    }
  });

  const { geometry, heightTexture } = useMemo(() => {
    if (!tileData) return { geometry: null, heightTexture: null };
    const { size_px, offset_m, scale_m, heights } = tileData;
    const sizeX = bounds.x_max - bounds.x_min;
    const sizeY = bounds.y_max - bounds.y_min;

    // Task 6: 63x63 vertices instead of 64
    const vertices = size_px - 1;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY, vertices - 1, vertices - 1);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position as THREE.BufferAttribute;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        // Map vertex index to 63x63 grid
        const col = i % vertices;
        const row = vertices - 1 - Math.floor(i / vertices);

        // Sample heights from the 64x64 grid (mean of 4 surrounding samples for border issue)
        const idx00 = row * size_px + col;
        const idx01 = row * size_px + col + 1;
        const idx10 = (row + 1) * size_px + col;
        const idx11 = (row + 1) * size_px + col + 1;

        const h00 = heights[idx00] ?? 0;
        const h01 = heights[idx01] ?? 0;
        const h10 = heights[idx10] ?? 0;
        const h11 = heights[idx11] ?? 0;

        const hAvg = (h00 + h01 + h10 + h11) / 4;
        pos.setY(i, offset_m + hAvg * scale_m);
      }
      geom.computeVertexNormals();
    }

    const data = new Float32Array(size_px * size_px);
    for (let i = 0; i < heights.length; i++) {
      data[i] = offset_m + (heights[i] ?? 0) * scale_m;
    }
    const texture = new THREE.DataTexture(data, size_px, size_px, THREE.RedFormat, THREE.FloatType);
    texture.needsUpdate = true;

    return { geometry: geom, heightTexture: texture };
  }, [tileData, bounds]);

  // Dispose geometries and DataTextures on unmount (Task 5)
  useEffect(() => {
    return () => {
      geometry?.dispose();
      heightTexture?.dispose();
    };
  }, [geometry, heightTexture]);

  if (!tileData || !geometry || !heightTexture) return null;

  const midX = (bounds.x_min + bounds.x_max) / 2;
  const midY = (bounds.y_min + bounds.y_max) / 2;

  let layerMode = 0;
  if (inputs.current?.layers?.slope) layerMode = 1;

  return (
    <group>
      {/* We keep drawing ourselves until subdivision is complete (state 2) */}
      {subdivisionState !== 2 && (
        <mesh
          ref={meshRef}
          geometry={geometry}
          position={[midX, 0, -midY]}
          receiveShadow
          castShadow
          material={sharedTerrainMaterial}
          onBeforeRender={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const shader = sharedTerrainMaterial.userData.shader as any;
            if (shader) {
              shader.uniforms.uHeightTexture.value = heightTexture;
              shader.uniforms.uBounds.value.set(
                bounds.x_min,
                bounds.y_min,
                bounds.x_max,
                bounds.y_max,
              );
              shader.uniforms.uSunDirection.value.copy(sunDirection);
              shader.uniforms.uLayerMode.value = layerMode;
            }
          }}
        />
      )}

      {subdivisionState === 2 &&
        (() => {
          const nextLevel = coord.level + 1;
          return (
            <>
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 + 1 }}
                bounds={{ x_min: bounds.x_min, y_min: midY, x_max: midX, y_max: bounds.y_max }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 }}
                bounds={{ x_min: midX, y_min: midY, x_max: bounds.x_max, y_max: bounds.y_max }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 }}
                bounds={{ x_min: bounds.x_min, y_min: bounds.y_min, x_max: midX, y_max: midY }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 }}
                bounds={{ x_min: midX, y_min: bounds.y_min, x_max: bounds.x_max, y_max: midY }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
            </>
          );
        })()}
    </group>
  );
}

export function TerrainQuadtree({ tileSource, sunDirection, inputs }: TerrainQuadtreeProps) {
  const [manifest, setManifest] = useState<TileManifest | null>(null);

  useEffect(() => {
    let canceled = false;
    tileSource.getManifest().then((m) => {
      if (!canceled) setManifest(m);
    });
    return () => {
      canceled = true;
    };
  }, [tileSource]);

  if (!manifest) return null;

  return (
    <group>
      <TerrainNode
        tileSource={tileSource}
        manifest={manifest}
        coord={{ level: 0, x: 0, y: 0 }}
        bounds={{
          x_min: manifest.bounds_m.x_min_m,
          y_min: manifest.bounds_m.y_min_m,
          x_max: manifest.bounds_m.x_max_m,
          y_max: manifest.bounds_m.y_max_m,
        }}
        sunDirection={sunDirection}
        inputs={inputs}
      />
    </group>
  );
}
