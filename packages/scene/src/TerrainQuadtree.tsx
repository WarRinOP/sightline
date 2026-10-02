import { useEffect, useState, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TileSource, TileManifest, TileData, TileCoord } from "@sightline/contracts";
import type { SceneInputs } from "./types";
import { Palette } from "./palette";
import { getCachedTile, loadChildTiles } from "./tileCache";
import { tileVertexHeightsM } from "./tileMesh";

// --- Base Material ---
const baseTerrainMaterial = new THREE.MeshStandardMaterial({
  color: Palette.terrain,
  wireframe: false,
  flatShading: true,
});

function createTileMaterial(heightTexture: THREE.Texture, bounds: THREE.Vector4) {
  const mat = baseTerrainMaterial.clone();
  mat.customProgramCacheKey = () => "terrainQuadtree";
  mat.onBeforeCompile = (shader) => {
    // No Sun until the app sends one (D-030): the shader draws ambient-only terrain, never a default Sun.
    shader.uniforms.uSunEnabled = { value: 0 };
    shader.uniforms.uSunDirection = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uHeightTexture = { value: heightTexture };
    shader.uniforms.uBounds = { value: bounds };
    shader.uniforms.uLayerMode = { value: 0 };

    mat.userData.shader = shader;

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
      uniform float uSunEnabled;
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
      
      // Note: These shadows are visual only. Real shadows are determined by the horizon mask.
      float shadowMask = 1.0;
      if (cosI > 0.0) {
        vec3 rayPos = vTerrainWorldPos;
        vec3 rayDir = normalize(uSunDirection);
        float stepSize = (uBounds.z - uBounds.x) / 64.0; 
        
        for (int i = 1; i <= 8; i++) {
          rayPos += rayDir * stepSize;
          // Fix shadow shader UV border offset
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
      if (uSunEnabled < 0.5) finalColor = gl_FragColor.rgb * 0.3;
      
      // Apply overlays based on uLayerMode
      if (uLayerMode == 1) {
        float slopeDeg = acos(dot(geometryNormal, vec3(0.0, 1.0, 0.0))) * 180.0 / 3.14159265;
        float normSlope = clamp(slopeDeg / 30.0, 0.0, 1.0);
        finalColor = mix(finalColor, magma(normSlope), 0.7);
      }
      
      gl_FragColor.rgb = finalColor;
      `,
    );
  };
  return mat;
}

interface TerrainQuadtreeProps {
  tileSource: TileSource;
  sunDirection: THREE.Vector3 | null;
  inputs: React.MutableRefObject<SceneInputs>;
}

interface TerrainNodeProps {
  tileSource: TileSource;
  manifest: TileManifest;
  coord: TileCoord;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
  sunDirection: THREE.Vector3 | null;
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

  // 0 = unsubdivided, 1 = loading children, 2 = subdivided, 3 = failed children
  const [subdivisionState, setSubdivisionState] = useState<0 | 1 | 2 | 3>(0);

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

  const bXMin = bounds.x_min;
  const bYMin = bounds.y_min;
  const bXMax = bounds.x_max;
  const bYMax = bounds.y_max;

  const { geometry, heightTexture, material } = useMemo(() => {
    if (!tileData) return { geometry: null, heightTexture: null, material: null };
    const { size_px, offset_m, scale_m, heights } = tileData;
    const sizeX = bXMax - bXMin;
    const sizeY = bYMax - bYMin;

    const vertices = size_px - 1;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY, vertices - 1, vertices - 1);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position as THREE.BufferAttribute;
    const vertexHeights = tileVertexHeightsM(tileData);
    for (let i = 0; i < pos.count; i++) {
      // The plane's first row is the tile's highest y (after the rotation), the heights start at the lowest.
      const col = i % vertices;
      const row = vertices - 1 - Math.floor(i / vertices);
      pos.setY(i, vertexHeights[row * vertices + col] ?? 0);
    }
    geom.computeVertexNormals();

    const data = new Float32Array(size_px * size_px);
    for (let i = 0; i < heights.length; i++) {
      data[i] = offset_m + (heights[i] ?? 0) * scale_m;
    }
    const texture = new THREE.DataTexture(data, size_px, size_px, THREE.RedFormat, THREE.FloatType);
    texture.needsUpdate = true;

    const boundsVec = new THREE.Vector4(bXMin, bYMin, bXMax, bYMax);
    const mat = createTileMaterial(texture, boundsVec);

    return { geometry: geom, heightTexture: texture, material: mat };
  }, [tileData, bXMin, bYMin, bXMax, bYMax]);

  // Dispose geometries and DataTextures on unmount
  useEffect(() => {
    return () => {
      geometry?.dispose();
      heightTexture?.dispose();
      material?.dispose();
    };
  }, [geometry, heightTexture, material]);

  useFrame(() => {
    // Update layer mode and sun direction per frame if material is ready
    if (material && material.userData.shader) {
      const layerMode = inputs.current?.layers?.slope ? 1 : 0;
      const u = material.userData.shader.uniforms;
      u.uSunEnabled.value = sunDirection ? 1 : 0;
      if (sunDirection) u.uSunDirection.value.copy(sunDirection);
      material.userData.shader.uniforms.uLayerMode.value = layerMode;
    }

    const center = new THREE.Vector3(
      (bXMin + bXMax) / 2,
      tileData?.offset_m || 0,
      -(bYMin + bYMax) / 2,
    );
    const dist = camera.position.distanceTo(center);
    const size = bXMax - bXMin;

    const shouldSubdivide = dist < size * 2 && coord.level < manifest.level_count - 1;

    // Only attempt subdivision if we are in state 0
    if (shouldSubdivide && subdivisionState === 0) {
      setSubdivisionState(1); // loading

      loadChildTiles(tileSource, coord).then((allLoaded) => {
        setSubdivisionState(allLoaded ? 2 : 3); // 3: a child is missing, keep drawing this tile
      });
    } else if (!shouldSubdivide && (subdivisionState === 2 || subdivisionState === 3)) {
      setSubdivisionState(0);
    }
  });

  if (!tileData || !geometry || !material) return null;

  const midX = (bXMin + bXMax) / 2;
  const midY = (bYMin + bYMax) / 2;

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
          material={material}
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
                bounds={{ x_min: bXMin, y_min: midY, x_max: midX, y_max: bYMax }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 }}
                bounds={{ x_min: midX, y_min: midY, x_max: bXMax, y_max: bYMax }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 }}
                bounds={{ x_min: bXMin, y_min: bYMin, x_max: midX, y_max: midY }}
                sunDirection={sunDirection}
                inputs={inputs}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 }}
                bounds={{ x_min: midX, y_min: bYMin, x_max: bXMax, y_max: midY }}
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
