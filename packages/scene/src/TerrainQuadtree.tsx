import { useEffect, useState, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TileSource, TileManifest, TileData, TileCoord } from "@sightline/contracts";
import type { SceneInputs } from "./types";
import type { SkyState } from "./sky";
import { getCachedTile, getLoadedTile, loadChildTiles } from "./tileCache";
import { buildTileGeometry } from "./tileMesh";
import {
  createTerrainMaterial,
  createTerrainUniforms,
  updateTerrainUniforms,
  type TerrainUniforms,
} from "./terrainMaterial";
import { ShadowField } from "./shadowField";

interface TerrainQuadtreeProps {
  tileSource: TileSource;
  sky: React.MutableRefObject<SkyState>;
  inputs: React.MutableRefObject<SceneInputs>;
}

interface TerrainNodeProps {
  tileSource: TileSource;
  manifest: TileManifest;
  coord: TileCoord;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
  uniforms: TerrainUniforms;
}

function TerrainNode({ tileSource, manifest, coord, bounds, uniforms }: TerrainNodeProps) {
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

    // The parent's normals go along: the shader blends toward them with distance, so the shading
    // meets a coarser neighbour without a step at the tile edge.
    const parentTile =
      coord.level > 0
        ? getLoadedTile(tileSource, {
            level: coord.level - 1,
            x: Math.floor(coord.x / 2),
            y: Math.floor(coord.y / 2),
          })
        : undefined;
    const geom = buildTileGeometry(
      tileData,
      sizeX,
      sizeY,
      parentTile ? { tile: parentTile, quadrant: { x: coord.x % 2, y: coord.y % 2 } } : undefined,
    );

    const data = new Float32Array(size_px * size_px);
    for (let i = 0; i < heights.length; i++) {
      data[i] = offset_m + (heights[i] ?? 0) * scale_m;
    }
    const texture = new THREE.DataTexture(data, size_px, size_px, THREE.RedFormat, THREE.FloatType);
    texture.needsUpdate = true;

    const boundsVec = new THREE.Vector4(bXMin, bYMin, bXMax, bYMax);
    const mat = createTerrainMaterial(uniforms, texture, boundsVec);

    return { geometry: geom, heightTexture: texture, material: mat };
  }, [tileData, bXMin, bYMin, bXMax, bYMax, uniforms, tileSource, coord]);

  // Dispose geometries and DataTextures on unmount
  useEffect(() => {
    return () => {
      geometry?.dispose();
      heightTexture?.dispose();
      material?.dispose();
    };
  }, [geometry, heightTexture, material]);

  const center = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    center.set((bXMin + bXMax) / 2, tileData?.offset_m || 0, -(bYMin + bYMax) / 2);
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
        <mesh ref={meshRef} geometry={geometry} position={[midX, 0, -midY]} material={material} />
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
                uniforms={uniforms}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 + 1 }}
                bounds={{ x_min: midX, y_min: midY, x_max: bXMax, y_max: bYMax }}
                uniforms={uniforms}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2, y: coord.y * 2 }}
                bounds={{ x_min: bXMin, y_min: bYMin, x_max: midX, y_max: midY }}
                uniforms={uniforms}
              />
              <TerrainNode
                tileSource={tileSource}
                manifest={manifest}
                coord={{ level: nextLevel, x: coord.x * 2 + 1, y: coord.y * 2 }}
                bounds={{ x_min: midX, y_min: bYMin, x_max: bXMax, y_max: midY }}
                uniforms={uniforms}
              />
            </>
          );
        })()}
    </group>
  );
}

export function TerrainQuadtree({ tileSource, sky, inputs }: TerrainQuadtreeProps) {
  const [manifest, setManifest] = useState<TileManifest | null>(null);
  const uniforms = useMemo(() => createTerrainUniforms(), []);
  const field = useMemo(
    () => (manifest ? new ShadowField(tileSource, manifest) : null),
    [tileSource, manifest],
  );

  useEffect(() => {
    let canceled = false;
    tileSource.getManifest().then((m) => {
      if (!canceled) setManifest(m);
    });
    return () => {
      canceled = true;
    };
  }, [tileSource]);

  useEffect(() => () => field?.dispose(), [field]);

  // Once per frame for every tile: the materials share these uniform objects.
  useFrame(() => {
    const s = sky.current;
    if (field && s.hasSite) field.setCenter(s.siteMap.x, s.siteMap.y, () => undefined);
    updateTerrainUniforms(uniforms, s, s.siteMap, field, inputs.current?.layers?.slope === true);
  });

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
        uniforms={uniforms}
      />
    </group>
  );
}
