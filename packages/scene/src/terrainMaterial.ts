import * as THREE from "three";
import { MOON_REFERENCE_RADIUS_M } from "@sightline/contracts";
import { Palette } from "./palette";
import type { SkyState } from "./sky";
import { CLIP_TEXELS, type ShadowField } from "./shadowField";
import { SUN_ANGULAR_RADIUS_RAD } from "./sky";

/**
 * Terrain shading. Visual only (the page says so): the numbers come from the engine.
 *
 * - Curvature: the plane is bent down by d² / 2R from the selected site, the frame the engine's Sun
 *   and Earth directions are given in, so far ridges sink as on the real Moon (26 km at 300 km) and
 *   the normals tilt with the ground.
 * - Sunlight: McEwen's (1991) lunar-Lambert law, L · 2cos i / (cos i + cos e) + (1 − L) cos i, which
 *   keeps grazing-lit regolith brighter than plain Lambert, as the Moon looks. L is a fixed 0.65.
 * - Shadows: the Sun's ray is marched over the curved heights (own tile, then the shadow field's
 *   clips), and the result is the visible share of the Sun's disk, so edges are soft as at a real
 *   grazing Sun.
 * - Fill: a faint sky term and earthshine from the Earth's direction, scaled by the Earth's lit share
 *   (sky.ts), so dark ground keeps its relief. Not radiometric: chosen so shadowed ground reads.
 * - Without the engine's answer there is no Sun at all (D-030): a flat ambient shows the relief.
 */
export const TERRAIN_LIGHT = {
  lunarLambertL: 0.65,
  sunIntensity: 1.6,
  skyFill: 0.1,
  earthshine: 0.18,
  noSunAmbient: 0.45,
} as const;

/** Shadow march: first step as a share of the tile's own sample spacing, then × this per step. */
const MARCH_GROWTH = 1.1;
const MARCH_MAX_STEPS = 140;
const MARCH_MAX_DISTANCE_M = 400_000;

const vertexShader = /* glsl */ `
  uniform vec2 uCurveOrigin;
  uniform float uCurveK;
  uniform vec4 uBounds;
  attribute vec3 normalCoarse;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSlopeCos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Level-of-detail morph of the normals: own at close range, the parent's toward the distance at
    // which this tile would merge back into its parent (TerrainQuadtree: 2 x the parent's size).
    float size = uBounds.z - uBounds.x;
    float morph = smoothstep(1.5 * size, 3.0 * size, distance(cameraPosition, world.xyz));
    vec3 n0 = normalize(mix(normal, normalCoarse, morph));
    vec2 rel = vec2(world.x, -world.z) - uCurveOrigin;
    world.y -= dot(rel, rel) * uCurveK;
    vWorldPos = world.xyz;
    // y = h - K|rel|^2: the gradient gains (-2K rel.x) in x and (+2K rel.y) in z (z = -map y).
    vec3 n = normalize(mat3(modelMatrix) * n0);
    // Slope against the ground's own tangent plane, before the curvature tilt.
    vSlopeCos = n.y;
    vNormal = normalize(n / max(n.y, 1e-3) + vec3(2.0 * uCurveK * rel.x, 0.0, -2.0 * uCurveK * rel.y));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAlbedo;
  uniform float uSunEnabled;
  uniform vec3 uSunDirection;
  uniform vec3 uEarthDirection;
  uniform float uEarthLit;
  uniform float uLunarLambertL;
  uniform float uSunIntensity;
  uniform float uSkyFill;
  uniform float uEarthshine;
  uniform float uNoSunAmbient;
  uniform float uSunRadius;
  uniform vec3 uSunTint;
  uniform vec3 uFillTint;
  uniform vec2 uCurveOrigin;
  uniform float uCurveK;
  uniform float uMaxHeight;
  uniform sampler2D uHeightTexture; // this tile's 64 x 64 samples
  uniform vec4 uBounds;             // this tile: x_min, y_min, x_max, y_max (tile plane)
  uniform sampler2D uClip0;
  uniform sampler2D uClip1;
  uniform sampler2D uClip2;
  uniform vec3 uClipRect[3];        // x_min, y_min, texel_m
  uniform int uLayerMode;
  uniform vec3 uSlopeColor;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSlopeCos;

  const int CLIP_TEXELS = ${CLIP_TEXELS};


  // Bilinear height from a grid whose texel k is centred at origin + (k + c) * step.
  float bilinear(sampler2D tex, vec2 t, int n) {
    vec2 f = fract(t);
    ivec2 k = clamp(ivec2(floor(t)), ivec2(0), ivec2(n - 2));
    float h00 = texelFetch(tex, k, 0).r;
    float h10 = texelFetch(tex, k + ivec2(1, 0), 0).r;
    float h01 = texelFetch(tex, k + ivec2(0, 1), 0).r;
    float h11 = texelFetch(tex, k + ivec2(1, 1), 0).r;
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  }

  // Own tile: sample j sits half a cell outside the edge for j = 0 (tileMesh.ts).
  vec2 ownCoord(vec2 q, float cell) { return (q - uBounds.xy) / cell + 0.5; }
  vec2 clipCoord(int i, vec2 q) { return (q - uClipRect[i].xy) / uClipRect[i].z - 0.5; }
  bool inGrid(vec2 t, int n) {
    return t.x >= 0.0 && t.y >= 0.0 && t.x <= float(n - 1) && t.y <= float(n - 1);
  }

  // Visible share of the Sun's disk at P (curved frame): the steepest terrain above the Sun's ray,
  // as an angle from P, against the disk's radius.
  float sunVisibleFraction(vec3 P) {
    vec3 d = uSunDirection;
    float cell = (uBounds.z - uBounds.x) / 62.0;
    // Each pixel starts the step sequence at a different phase (interleaved gradient noise), so the
    // fixed steps do not print as bands; what is left is fine grain.
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float s = 0.75 * cell * pow(${MARCH_GROWTH}, jitter);
    float maxDelta = -1.0;
    for (int i = 0; i < ${MARCH_MAX_STEPS}; i++) {
      vec3 q = P + d * s;
      // Above every peak and still climbing: nothing further can block the Sun.
      if (d.y > 0.0 && q.y > uMaxHeight) break;
      vec2 qm = vec2(q.x, -q.z);
      vec2 tOwn = ownCoord(qm, cell);
      vec2 t0 = clipCoord(0, qm);
      vec2 t1 = clipCoord(1, qm);
      vec2 t2 = clipCoord(2, qm);
      bool inOwn = inGrid(tOwn, 64);
      // A tile never reads heights much finer than its own mesh: a coarse mesh averages the ground,
      // so finer heights would stand above it and shadow the whole tile.
      float minTexel = 0.5 * cell;
      bool in0 = inGrid(t0, CLIP_TEXELS) && uClipRect[0].z >= minTexel;
      bool in1 = inGrid(t1, CLIP_TEXELS) && uClipRect[1].z >= minTexel;
      bool in2 = inGrid(t2, CLIP_TEXELS) && uClipRect[2].z >= minTexel;
      float h;
      float texel;
      // The finest source whose spacing suits the step; else the finest that covers the point.
      if (inOwn && s < 8.0 * cell) { h = bilinear(uHeightTexture, tOwn, 64); texel = cell; }
      else if (in0 && s >= 2.0 * uClipRect[0].z) { h = bilinear(uClip0, t0, CLIP_TEXELS); texel = uClipRect[0].z; }
      else if (in1 && s >= 2.0 * uClipRect[1].z) { h = bilinear(uClip1, t1, CLIP_TEXELS); texel = uClipRect[1].z; }
      else if (in2 && s >= 2.0 * uClipRect[2].z) { h = bilinear(uClip2, t2, CLIP_TEXELS); texel = uClipRect[2].z; }
      else if (inOwn) { h = bilinear(uHeightTexture, tOwn, 64); texel = cell; }
      else if (in0) { h = bilinear(uClip0, t0, CLIP_TEXELS); texel = uClipRect[0].z; }
      else if (in1) { h = bilinear(uClip1, t1, CLIP_TEXELS); texel = uClipRect[1].z; }
      else if (in2) { h = bilinear(uClip2, t2, CLIP_TEXELS); texel = uClipRect[2].z; }
      else break;
      vec2 rel = qm - uCurveOrigin;
      float H = h - dot(rel, rel) * uCurveK;
      // A quarter texel of slack: coarse heights must not shadow the finer surface they smooth.
      maxDelta = max(maxDelta, (H - q.y - 0.25 * texel) / s);
      if (maxDelta > uSunRadius) return 0.0;
      s *= ${MARCH_GROWTH};
      if (s > ${MARCH_MAX_DISTANCE_M}.0) break;
    }
    return clamp(0.5 - maxDelta / (2.0 * uSunRadius), 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    vec3 light;
    if (uSunEnabled > 0.5) {
      float cosI = dot(n, uSunDirection);
      // Floor on cos e: at a nearly edge-on view the lunar-Lambert term would spike to white.
      float cosE = max(dot(n, v), 0.25);
      float direct = 0.0;
      // The disk spans ±uSunRadius: a slope facing just away still catches its upper limb.
      if (cosI > -uSunRadius) {
        float c = max(cosI, 0.0) + uSunRadius * 0.5;
        float L = uLunarLambertL;
        direct = (L * 2.0 * c / (c + cosE) + (1.0 - L) * c) * smoothstep(-uSunRadius, uSunRadius, cosI);
        if (direct > 0.0) direct *= sunVisibleFraction(vWorldPos);
      }
      float sky = uSkyFill * (0.55 + 0.45 * n.y);
      float earth = uEarthshine * uEarthLit * max(dot(n, uEarthDirection), 0.0)
        * smoothstep(-0.02, 0.02, uEarthDirection.y);
      light = uSunTint * (uSunIntensity * direct) + uFillTint * (sky + earth);
    } else {
      light = vec3(uNoSunAmbient * (0.5 + 0.5 * n.y));
    }
    vec3 color = uAlbedo * light;
    if (uLayerMode == 1) {
      // A slope map, independent of the light: grey below 5°, red at 30° and steeper (not purple,
      // which the app keeps for SIMULATED); a soft shade keeps the relief readable.
      float slopeDeg = degrees(acos(clamp(vSlopeCos, -1.0, 1.0)));
      float t = smoothstep(5.0, 30.0, slopeDeg);
      color = mix(uAlbedo * 0.35, uSlopeColor * 0.6, t) * (0.6 + 0.4 * n.y);
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One set of uniform objects shared by every tile's material: updated once per frame. */
export type TerrainUniforms = Record<string, THREE.IUniform>;

const emptyClip = new THREE.DataTexture(
  new Float32Array([-1e5, -1e5, -1e5, -1e5]),
  2,
  2,
  THREE.RedFormat,
  THREE.FloatType,
);
emptyClip.needsUpdate = true;

export function createTerrainUniforms(): TerrainUniforms {
  return {
    uAlbedo: { value: new THREE.Color(Palette.terrain) },
    uSunEnabled: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uEarthDirection: { value: new THREE.Vector3(0, 1, 0) },
    uEarthLit: { value: 0 },
    uLunarLambertL: { value: TERRAIN_LIGHT.lunarLambertL },
    uSunIntensity: { value: TERRAIN_LIGHT.sunIntensity },
    uSkyFill: { value: TERRAIN_LIGHT.skyFill },
    uEarthshine: { value: TERRAIN_LIGHT.earthshine },
    uNoSunAmbient: { value: TERRAIN_LIGHT.noSunAmbient },
    uSunRadius: { value: SUN_ANGULAR_RADIUS_RAD },
    // Faint tints: sunlight a touch warm, earthshine and sky a touch cool (the app's gold and cyan).
    uSunTint: { value: new THREE.Color(Palette.sunlightTint) },
    uFillTint: { value: new THREE.Color(Palette.fillTint) },
    uCurveOrigin: { value: new THREE.Vector2(0, 0) },
    uCurveK: { value: 1 / (2 * MOON_REFERENCE_RADIUS_M) },
    // No early exit until the shadow field knows the highest peak.
    uMaxHeight: { value: 1e5 },
    uClip0: { value: emptyClip },
    uClip1: { value: emptyClip },
    uClip2: { value: emptyClip },
    // Empty clips: a 2 x 2 grid nowhere near the map, so nothing is ever inside them.
    uClipRect: { value: [0, 1, 2].map(() => new THREE.Vector3(1e9, 1e9, 1)) },
    uLayerMode: { value: 0 },
    uSlopeColor: { value: new THREE.Color(Palette.slopeSteep) },
  };
}

export function createTerrainMaterial(
  shared: TerrainUniforms,
  heightTexture: THREE.Texture,
  bounds: THREE.Vector4,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // The shared entries are the same objects in every material: one write reaches all tiles.
    uniforms: { ...shared, uHeightTexture: { value: heightTexture }, uBounds: { value: bounds } },
    vertexShader,
    fragmentShader,
  });
}

/**
 * Per frame: the engine's sky, the curvature origin (the selected site, tile plane m), the shadow
 * field and the layer toggle into the shared uniforms.
 */
export function updateTerrainUniforms(
  u: TerrainUniforms,
  sky: SkyState,
  origin: THREE.Vector2,
  field: ShadowField | null,
  slopeLayer: boolean,
): void {
  u.uSunEnabled!.value = sky.hasSunEarth ? 1 : 0;
  (u.uSunDirection!.value as THREE.Vector3).copy(sky.sunDirection);
  (u.uEarthDirection!.value as THREE.Vector3).copy(sky.earthDirection);
  u.uEarthLit!.value = sky.hasSunEarth ? sky.earthLitFraction : 0;
  (u.uCurveOrigin!.value as THREE.Vector2).copy(origin);
  u.uLayerMode!.value = slopeLayer ? 1 : 0;
  if (field) {
    const rects = u.uClipRect!.value as THREE.Vector3[];
    field.clips.forEach((clip, i) => {
      const key = `uClip${i}`;
      if (u[key]) u[key].value = clip.texture;
      rects[i]?.set(clip.rect.x_min, clip.rect.y_min, clip.rect.texel_m);
    });
    // A little above the highest texel: bilinear and the coarse levels can under-read a peak.
    u.uMaxHeight!.value = field.maxHeightM + 300;
  }
}
