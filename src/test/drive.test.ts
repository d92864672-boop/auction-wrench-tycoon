import { describe, it, expect } from "vitest";
import { clearControls, newDrive, stepDrive, DRIVE_MODES, KEY_CONTROLS, type DriveMode } from "@/game/drive-physics";
function sim(mode: DriveMode, drift = false) {
  let s = newDrive();
  for (let i = 0; i < 120; i++) s = stepDrive(s, { ...clearControls(), up: true }, mode, 1 / 60);
  for (let i = 0; i < 45; i++) s = stepDrive(s, { ...clearControls(), up: true, left: true, drift }, mode, 1 / 60);
  return s;
}
describe("garage driving", () => {
  it("offers front, rear and all-wheel drive", () => { expect(DRIVE_MODES.map(m => m.id)).toEqual(["fwd", "rwd", "awd"]); });
  it("rear-wheel handbrake drifting preserves more slip than front or all-wheel drive", () => {
    expect(sim("rwd", true).slip).toBeGreaterThan(sim("rwd").slip);
    expect(sim("rwd", true).slip).toBeGreaterThan(sim("fwd", true).slip);
    expect(sim("rwd", true).slip).toBeGreaterThan(sim("awd", true).slip);
  });
  it("keyboard and touch share steering direction, throttle and drift", () => {
    expect(KEY_CONTROLS["KeyA"]).toBe("left"); expect(KEY_CONTROLS["ArrowLeft"]).toBe("left"); expect(KEY_CONTROLS["Space"]).toBe("drift");
    expect(sim("rwd").x).toBeGreaterThan(0); expect(sim("rwd").z).toBeGreaterThan(0);
    const reverse = stepDrive(newDrive(), { ...clearControls(), down: true }, "fwd", 0.05);
    expect(reverse.vz).toBeLessThan(0);
  });
  it("speed is nonzero while accelerating and parked cars never drift", () => {
    expect(sim("awd").speed * 3.6).toBeGreaterThan(60);
    expect(stepDrive(newDrive(), { ...clearControls(), drift: true }, "rwd", 0.05).slip).toBe(0);
  });
});