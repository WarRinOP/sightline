import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Palette } from "./palette";
import { EARTH_ANGULAR_RADIUS_RAD, SUN_ANGULAR_RADIUS_RAD, type SkyState } from "./sky";

interface DeepSpaceSkyProps {
  sky: React.MutableRefObject<SkyState>;
}

/**
 * Distance at which the sky billboards are placed. Any distance works: they are drawn first with no
 * depth test, so everything in the scene covers them, as the real horizon covers bodies at infinity.
 */
const SKY_DISTANCE_M = 100_000;
/** Sky draw order: stars, then the Sun, then the Earth (the Earth's night side can eclipse the Sun). */
export const SKY_RENDER_ORDER = { stars: -1003, sun: -1002, earth: -1001 } as const;
/** Glow extent of the Sun billboard, in solar radii: visual only, a camera's glare, not a corona. */
const SUN_GLOW_RADII = 16;
/** The Earth billboard leaves room for a thin atmosphere rim around the disk. */
const EARTH_QUAD_RADII = 1.15;

const billboardVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Disk with solar limb darkening (linear law, u = 0.6, visual) and a glare that falls off with
// distance, so a disk 5 px wide still reads as the Sun. Added onto the sky.
const sunFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform float uExtent;
  varying vec2 vUv;
  void main() {
    float r = length((vUv * 2.0 - 1.0) * uExtent);
    vec3 col = vec3(0.0);
    if (r < 1.0) {
      float mu = sqrt(1.0 - r * r);
      col = mix(uInner, uCore, mu) * (1.0 - 0.6 * (1.0 - mu)) * 1.6;
    }
    float rr = max(r, 1.0);
    float glare = 0.85 / pow(rr, 2.4) + 0.05 * exp(-rr / 5.0);
    col += mix(uOuter, uInner, 1.0 / rr) * glare * smoothstep(uExtent, uExtent * 0.6, r);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Earth as a sphere lit by the Sun from the engine's direction, so the phase is the real one seen
// from the site. No surface texture (S1-19): a plain ocean colour, a soft terminator, a lit limb.
const earthFragment = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uOcean;
  uniform vec3 uAtmosphere;
  uniform float uExtent;
  uniform float uPixel;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uExtent;
    float r = length(p);
    if (r > uExtent) discard;
    vec3 col = vec3(0.0);
    float alpha = 0.0;
    if (r < 1.0) {
      vec3 n = vec3(p, sqrt(1.0 - r * r));
      float d = dot(n, uLight);
      float day = smoothstep(-0.06, 0.3, d);
      float limb = pow(1.0 - n.z, 2.5);
      col = uOcean * day * (0.35 + 0.65 * max(d, 0.0)) + uAtmosphere * limb * day * 0.7;
      col += uOcean * 0.015;
      alpha = 1.0 - smoothstep(1.0 - uPixel, 1.0, r);
    }
    // Thin atmosphere outside the lit limb.
    float lit = clamp(dot(normalize(vec3(p, 0.0)), uLight) * 1.5 + 0.2, 0.0, 1.0);
    float haze = exp(-(r - 1.0) * 30.0) * lit * step(1.0 - uPixel, r);
    col += uAtmosphere * haze * 0.8;
    alpha = max(alpha, haze * 0.8);
    gl_FragColor = vec4(col, alpha);
  }
`;

function linear(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function DeepSpaceSky({ sky }: DeepSpaceSkyProps) {
  const sunRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const inverse = useMemo(() => new THREE.Quaternion(), []);

  const sunMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCore: { value: linear(Palette.sunCore) },
          uInner: { value: linear(Palette.sunInner) },
          uOuter: { value: linear(Palette.sunOuter) },
          uExtent: { value: SUN_GLOW_RADII },
        },
        vertexShader: billboardVertex,
        fragmentShader: sunFragment,
        // Opaque list + additive: drawn before the terrain (render order), which then covers it.
        transparent: false,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const earthMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uLight: { value: new THREE.Vector3(0, 0, 1) },
          uOcean: { value: linear(Palette.earth) },
          uAtmosphere: { value: linear(Palette.earthAtmosphere) },
          uExtent: { value: EARTH_QUAD_RADII },
          uPixel: { value: 0.1 },
        },
        vertexShader: billboardVertex,
        fragmentShader: earthFragment,
        // Alpha blending inside the opaque pass (three applies any non-normal blending there).
        transparent: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      sunMaterial.dispose();
      earthMaterial.dispose();
    },
    [sunMaterial, earthMaterial],
  );

  // drei's starfield is transparent and depth-tested at 200 km, so far ridges beyond it would not
  // cover it: move it into the background pass like the Sun and Earth.
  useEffect(() => {
    const stars = starsRef.current;
    if (!stars) return;
    stars.renderOrder = SKY_RENDER_ORDER.stars;
    stars.frustumCulled = false;
    const material = stars.material as THREE.Material;
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = false;
    material.needsUpdate = true;
  }, []);

  useFrame(({ camera, size }) => {
    const s = sky.current;
    // Stars and bodies sit at infinity: they move with the camera, never closer.
    starsRef.current?.position.copy(camera.position);

    const sun = sunRef.current;
    if (sun) {
      sun.visible = s.hasSunEarth && s.sunVisible;
      if (sun.visible) {
        sun.position.copy(camera.position).addScaledVector(s.sunDirection, SKY_DISTANCE_M);
        sun.lookAt(camera.position);
      }
    }

    const earth = earthRef.current;
    if (earth) {
      earth.visible = s.hasSunEarth && s.earthVisible;
      if (earth.visible) {
        earth.position.copy(camera.position).addScaledVector(s.earthDirection, SKY_DISTANCE_M);
        earth.lookAt(camera.position);
        // The Sun's direction in the billboard's own frame lights the disk: the real phase.
        inverse.copy(earth.quaternion).invert();
        earthMaterial.uniforms.uLight!.value.copy(s.sunDirection).applyQuaternion(inverse);
        // Anti-alias the rim over about one pixel, whatever the canvas size.
        const fov_rad =
          camera instanceof THREE.PerspectiveCamera ? (camera.fov * Math.PI) / 180 : 0.8;
        const diskPx = (2 * EARTH_ANGULAR_RADIUS_RAD * size.height) / fov_rad;
        earthMaterial.uniforms.uPixel!.value = Math.min(0.5, 2 / Math.max(diskPx, 1));
      }
    }
  }, 0);

  const sunHalf_m = SKY_DISTANCE_M * Math.tan(SUN_ANGULAR_RADIUS_RAD * SUN_GLOW_RADII);
  const earthHalf_m = SKY_DISTANCE_M * Math.tan(EARTH_ANGULAR_RADIUS_RAD * EARTH_QUAD_RADII);

  return (
    <>
      {/* Decorative starfield, not a catalogue (S1-19). */}
      <Stars ref={starsRef} radius={200000} depth={500} count={4000} factor={3} saturation={0} />

      <mesh
        ref={sunRef}
        material={sunMaterial}
        renderOrder={SKY_RENDER_ORDER.sun}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[2 * sunHalf_m, 2 * sunHalf_m]} />
      </mesh>

      <mesh
        ref={earthRef}
        material={earthMaterial}
        renderOrder={SKY_RENDER_ORDER.earth}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[2 * earthHalf_m, 2 * earthHalf_m]} />
      </mesh>
    </>
  );
}
