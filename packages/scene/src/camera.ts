import * as THREE from "three";

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** The camera never goes closer to the ground than this (m): the orbit limit alone allowed it under ridges. */
export const GROUND_CLEARANCE_M = 20;

/** How far behind and above the pin the camera stands to look toward the Sun or the Earth (m). */
export const VIEW_BACK_M = 700;
export const VIEW_UP_M = 60;

/**
 * The Hero flight ends looking 25° to the side of the Sun: the Sun stays in frame (the horizontal
 * field of view is about 60°) and the terrain is side-lit instead of seen against the light.
 */
export const HERO_SUN_OFFSET_RAD = (25 * Math.PI) / 180;

/** Hero flight: 20 s from 15 km up and 20 km out, 1.25 turns, ending at the view-toward pose. */
export const HERO_DURATION_S = 20;
const HERO_START_RADIUS_M = 20_000;
const HERO_START_HEIGHT_M = 15_000;
const HERO_TURNS = 1.25;

export function smoothstep01(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Behind the pin, opposite the body's azimuth, looking at the pin: the body then stands above the
 * pin at its real elevation over the terrain beyond. `direction` is the body's unit vector in the
 * scene; only its horizontal part is used.
 */
export function viewTowardPose(
  pin: THREE.Vector3,
  direction: THREE.Vector3,
  offset_rad: number = 0,
): CameraPose {
  const horizontal = new THREE.Vector3(direction.x, 0, direction.z);
  if (horizontal.lengthSq() < 1e-12) horizontal.set(0, 0, -1);
  horizontal.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset_rad);
  const position = pin
    .clone()
    .addScaledVector(horizontal, -VIEW_BACK_M)
    .add(new THREE.Vector3(0, VIEW_UP_M, 0));
  return { position, target: pin.clone() };
}

/** Angle about +Y of an offset (x, z), in the convention offset = (sin a, ·, cos a) · r. */
export function offsetAngle(offset: THREE.Vector3): number {
  return Math.atan2(offset.x, offset.z);
}

/**
 * Camera pose `t` seconds into the Hero flight. The spiral ends exactly at `end`, so the flight hands
 * over to the orbit controls without a jump.
 */
export function heroPose(t_s: number, end: CameraPose): CameraPose {
  const e = smoothstep01(t_s / HERO_DURATION_S);
  const endOffset = end.position.clone().sub(end.target);
  const endRadius = Math.hypot(endOffset.x, endOffset.z);
  const endAngle = offsetAngle(endOffset);
  const radius = THREE.MathUtils.lerp(HERO_START_RADIUS_M, endRadius, e);
  const height = THREE.MathUtils.lerp(HERO_START_HEIGHT_M, endOffset.y, e);
  const angle = endAngle - (1 - e) * HERO_TURNS * 2 * Math.PI;
  const position = end.target
    .clone()
    .add(new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius));
  return { position, target: end.target.clone() };
}

/** Raises `position` (in place) to the clearance above `ground_m`; returns whether it moved. */
export function clampAboveGround(position: THREE.Vector3, ground_m: number | null): boolean {
  if (ground_m === null) return false;
  const min = ground_m + GROUND_CLEARANCE_M;
  if (position.y >= min) return false;
  position.y = min;
  return true;
}
