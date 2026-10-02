import { useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TileSource, TileManifest, TileData, TileCoord } from "@sightline/contracts";

interface TerrainQuadtreeProps {
  tileSource: TileSource;
}

interface TerrainNodeProps {
  tileSource: TileSource;
  manifest: TileManifest;
  coord: TileCoord;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
}

function TerrainNode({ tileSource, manifest, coord, bounds }: TerrainNodeProps) {
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

  const geometry = useMemo(() => {
    if (!tileData) return null;
    const { size_px, offset_m, scale_m, heights } = tileData;
    const sizeX = bounds.x_max - bounds.x_min;
    const sizeY = bounds.y_max - bounds.y_min;
    
    // We create a plane geometry. Note that PlaneGeometry creates segments, so vertices = segments + 1
    // The tile data has size_px samples. We need size_px - 1 segments.
    const segments = size_px - 1;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY, segments, segments);
    
    // Rotate to lie flat on XZ plane
    geom.rotateX(-Math.PI / 2);
    
    const pos = geom.attributes.position as THREE.BufferAttribute;
    if (!pos) return geom;
    
    // PlaneGeometry generates vertices from top-left (y max, x min) to bottom-right (y min, x max)
    // Our TileData has row 0 at y_min (bottom) and col 0 at x_min (left).
    
    for (let i = 0; i < pos.count; i++) {
      const col = i % size_px;
      // PlaneGeometry rows go from top (y_max) to bottom (y_min)
      const row = (size_px - 1) - Math.floor(i / size_px);
      
      const idx = row * size_px + col;
      const hCount = heights[idx] ?? 0;
      const h = offset_m + hCount * scale_m;
      pos.setY(i, h);
    }
    
    geom.computeVertexNormals();
    return geom;
  }, [tileData, bounds]);

  if (!tileData) return null; // Loading

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
        />
        {/* Top Right (y max, x max) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 }}
          bounds={{ x_min: midX, y_min: midY, x_max: bounds.x_max, y_max: bounds.y_max }} 
        />
        {/* Bottom Left (y min, x min) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 }}
          bounds={{ x_min: bounds.x_min, y_min: bounds.y_min, x_max: midX, y_max: midY }} 
        />
        {/* Bottom Right (y min, x max) */}
        <TerrainNode 
          tileSource={tileSource} manifest={manifest} 
          coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 }}
          bounds={{ x_min: midX, y_min: bounds.y_min, x_max: bounds.x_max, y_max: midY }} 
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
      <meshStandardMaterial color="#888888" wireframe={false} flatShading />
    </mesh>
  );
}

export function TerrainQuadtree({ tileSource }: TerrainQuadtreeProps) {
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
      />
    </group>
  );
}
