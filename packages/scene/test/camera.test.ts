import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clampAboveGround,
  GROUND_CLEARANCE_M,
  heroPose,
  HERO_DURATION_S,
  VIEW_BACK_M,
  VIEW_UP_M,
  viewTowardPose,
} from "../src/camera";

const pin = new THREE.Vector3(-2688, 1739, 6093);

describe("viewTowardPose", () => {
  it("stands behind the pin, opposite the body's azimuth, and looks at the pin", () => {
    const body = new THREE.Vector3(0.6, 0.02, -0.8).normalize();
    const { position, target } = viewTowardPose(pin, body);
    expect(target.equals(pin)).toBe(true);
    const offset = position.clone().sub(pin);
    expect(offset.y).toBeCloseTo(VIEW_UP_M, 9);
    expect(Math.hypot(offset.x, offset.z)).toBeCloseTo(VIEW_BACK_M, 9);
    // Looking from the camera through the pin points the same way as the body, horizontally.
    const look = pin.clone().sub(position).setY(0).normalize();
    const bodyH = body.clone().setY(0).normalize();
    expect(look.dot(bodyH)).toBeCloseTo(1, 12);
  });
});

describe("heroPose", () => {
  const end = viewTowardPose(pin, new THREE.Vector3(1, 0.01, 0).normalize());

  it("starts high and far out", () => {
    const start = heroPose(0, end);
    const off = start.position.clone().sub(pin);
    expect(off.y).toBeCloseTo(15_000, 6);
    expect(Math.hypot(off.x, off.z)).toBeCloseTo(20_000, 6);
  });

  it("ends exactly at the hand-over pose, so the orbit controls take over without a jump", () => {
    const last = heroPose(HERO_DURATION_S, end);
    expect(last.position.distanceTo(end.position)).toBeLessThan(1e-6);
    expect(last.target.distanceTo(end.target)).toBeLessThan(1e-9);
    const almost = heroPose(HERO_DURATION_S - 0.05, end);
    expect(almost.position.distanceTo(end.position)).toBeLessThan(5);
  });
});

describe("clampAboveGround", () => {
  it("raises a camera below the clearance and leaves others alone", () => {
    const p = new THREE.Vector3(0, 100, 0);
    expect(clampAboveGround(p, 95)).toBe(true);
    expect(p.y).toBe(95 + GROUND_CLEARANCE_M);
    const q = new THREE.Vector3(0, 500, 0);
    expect(clampAboveGround(q, 95)).toBe(false);
    expect(q.y).toBe(500);
    expect(clampAboveGround(q, null)).toBe(false);
  });
});
