import { useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TileSource, TileManifest, TileData, TileCoord } from "@sightline/contracts";

interface TerrainQuadtreeProps {
  tileSource: TileSource;
  sunDirection: THREE.Vector3;
}

interface TerrainNodeProps {
  tileSource: TileSource;
  manifest: TileManifest;
  coord: TileCoord;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
  sunDirection: THREE.Vector3;
}

function TerrainNode({ tileSource, manifest, coord, bounds, sunDirection }: TerrainNodeProps) {
  const { camera } = useThree();
  const [tileData, setTileData] = useState<TileData | null>(null);
  const [isSubdivided, setIsSubdivided] = useState(false);

  useEffect(() => {
    let canceled = false;
    tileSource.getTile(coord).then((data) => {
      if (!canceled) setTileData(data);
    }).catch(e => {
      console.warn("Failed to load tile", coord, e);
    });
    return () => { canceled = true; };
  }, [tileSource, coord.level, coord.x, coord.y]);

  useFrame(() => {
    // Basic LOD check
    const center = new THREE.Vector3(
      (bounds.x_min + bounds.x_max) / 2,
      (tileData?.offset_m || 0), // Rough height approximation
      -(bounds.y_min + bounds.y_max) / 2
    );
    const dist = camera.position.distanceTo(center);
    const size = bounds.x_max - bounds.x_min;
    
    // Subdivide if we are close enough and not at max level
    const shouldSubdivide = (dist < size * 2) && (coord.level < manifest.level_count - 1);
    
    if (shouldSubdivide !== isSubdivided) {
      setIsSubdivided(shouldSubdivide);
    }
  });

  const { geometry, heightTexture } = useMemo(() => {
    if (!tileData) return { geometry: null, heightTexture: null };
    const { size_px, offset_m, scale_m, heights } = tileData;
    const sizeX = bounds.x_max - bounds.x_min;
    const sizeY = bounds.y_max - bounds.y_min;
    
    const segments = size_px - 1;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY, segments, segments);
    geom.rotateX(-Math.PI / 2);
    
    const pos = geom.attributes.position as THREE.BufferAttribute;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const col = i % size_px;
        const row = (size_px - 1) - Math.floor(i / size_px);
        const idx = row * size_px + col;
        const hCount = heights[idx] ?? 0;
        pos.setY(i, offset_m + hCount * scale_m);
      }
      geom.computeVertexNormals();
    }
    
    // Create DataTexture for the heightmap
    const data = new Float32Array(size_px * size_px);
    for (let i = 0; i < heights.length; i++) {
      data[i] = offset_m + (heights[i] ?? 0) * scale_m;
    }
    const texture = new THREE.DataTexture(data, size_px, size_px, THREE.RedFormat, THREE.FloatType);
    texture.needsUpdate = true;
    
    return { geometry: geom, heightTexture: texture };
  }, [tileData, bounds]);

  if (!tileData || !geometry || !heightTexture) return null; // Loading

  const midX = (bounds.x_min + bounds.x_max) / 2;
  const midY = (bounds.y_min + bounds.y_max) / 2;

  // Render children or self
  if (isSubdivided) {
    const nextLevel = coord.level + 1;
    return (
      <group>
        {/* Top Left (y max, x min) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 + 1 }}
          bounds={{ x_min: bounds.x_min, y_min: midY, x_max: midX, y_max: bounds.y_max }} 
          sunDirection={sunDirection}
        />
        {/* Top Right (y max, x max) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 }}
          bounds={{ x_min: midX, y_min: midY, x_max: bounds.x_max, y_max: bounds.y_max }} 
          sunDirection={sunDirection}
        />
        {/* Bottom Left (y min, x min) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 }}
          bounds={{ x_min: bounds.x_min, y_min: bounds.y_min, x_max: midX, y_max: midY }} 
          sunDirection={sunDirection}
        />
        {/* Bottom Right (y min, x max) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 }}
          bounds={{ x_min: midX, y_min: bounds.y_min, x_max: bounds.x_max, y_max: midY }} 
          sunDirection={sunDirection}
        />
      </group>
    );
  }

  return (
    <mesh 
      geometry={geometry!} 
      position={[midX, 0, -midY]} 
      receiveShadow 
      castShadow
    >
      <meshStandardMaterial 
        color="#888888" 
        wireframe={false} 
        flatShading 
        onBeforeCompile={(shader) => {
          shader.uniforms.uSunDirection = { value: sunDirection };
          shader.uniforms.uHeightTexture = { value: heightTexture };
          shader.uniforms.uBounds = { value: new THREE.Vector4(bounds.x_min, bounds.y_min, bounds.x_max, bounds.y_max) };
          
          shader.vertexShader = `
            varying vec3 vTerrainWorldPos;
            ${shader.vertexShader}
          `.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
          );

          shader.fragmentShader = `
            uniform vec3 uSunDirection;
            uniform sampler2D uHeightTexture;
            uniform vec4 uBounds; // x_min, y_min, x_max, y_max
            varying vec3 vTerrainWorldPos;
            ${shader.fragmentShader}
          `;
          
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
            // Lommel-Seeliger reflectance
            vec3 viewDir = normalize(vViewPosition);
            float cosE = max(0.01, dot(geometryNormal, viewDir));
            float cosI = max(0.01, dot(geometryNormal, uSunDirection));
            float lommelSeeliger = cosI / (cosI + cosE);
            
            // Near-field shadow ray-march (M3-04)
            // March along uSunDirection
            float shadowMask = 1.0;
            if (cosI > 0.0) {
              vec3 rayPos = vTerrainWorldPos;
              vec3 rayDir = normalize(uSunDirection);
              float stepSize = (uBounds.z - uBounds.x) / 64.0; // approx tile pixel size
              
              for (int i = 1; i <= 8; i++) {
                rayPos += rayDir * stepSize;
                
                // Map world XZ to texture UV (uBounds: x_min, y_min, x_max, y_max)
                // Note: World Z corresponds to Terrain Y, which is mapped to uBounds y
                float u = (rayPos.x - uBounds.x) / (uBounds.z - uBounds.x);
                float v = (-rayPos.z - uBounds.y) / (uBounds.w - uBounds.y);
                
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
            
            gl_FragColor.rgb = gl_FragColor.rgb * (0.5 + 1.5 * lommelSeeliger) * shadowMask;
            `
          );
        }}
      />
    </mesh>
  );
}

export function TerrainQuadtree({ tileSource, sunDirection }: TerrainQuadtreeProps) {
  const [manifest, setManifest] = useState<TileManifest | null>(null);

  useEffect(() => {
    let canceled = false;
    tileSource.getManifest().then(m => {
      if (!canceled) setManifest(m);
    });
    return () => { canceled = true; };
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
          y_max: manifest.bounds_m.y_max_m
        }}
        sunDirection={sunDirection}
      />
    </group>
  );
}
