// Arcade driving is transient: it never changes garage cars or the economy.
// +Z is forward; negative yaw turns screen-left from the chase camera.
export type DriveMode = "fwd" | "rwd" | "awd";
export type Controls = { up: boolean; down: boolean; left: boolean; right: boolean; drift: boolean };
export type DriveState = { x: number; z: number; yaw: number; vx: number; vz: number; speed: number; slip: number };
export const DRIVE_MODES: { id: DriveMode; label: string }[] = [
  { id: "fwd", label: "Передний" }, { id: "rwd", label: "Задний" }, { id: "awd", label: "Полный" },
];
export const DRIVE_TUNING = {
  fwd: { accel: 11, grip: 9, driftGrip: 2.2, turn: 0.85, max: 44 },
  rwd: { accel: 13, grip: 6, driftGrip: 0.75, turn: 1.2, max: 50 },
  awd: { accel: 15, grip: 12, driftGrip: 1.6, turn: 1, max: 54 },
};
export const clearControls = (): Controls => ({ up: false, down: false, left: false, right: false, drift: false });
export const newDrive = (): DriveState => ({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, slip: 0 });
export const KEY_CONTROLS: Record<string, keyof Controls> = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "drift",
};
export function stepDrive(s: DriveState, c: Controls, mode: DriveMode, delta: number): DriveState {
  const dt = Math.max(0, Math.min(delta, 0.05)), p = DRIVE_TUNING[mode];
  let forward = s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw);
  if (c.up) forward += p.accel * dt;
  if (c.down) forward -= (forward > 0.3 ? 25 : p.accel * 0.65) * dt;
  forward *= Math.exp(-(c.drift ? 0.5 : 0.16) * dt);
  forward = Math.max(-9, Math.min(p.max, forward));
  const steer = Number(c.right) - Number(c.left);
  const yaw = s.yaw + steer * p.turn * (c.drift ? 1.45 : 1) * Math.min(1, Math.abs(forward) / 6) * Math.sign(forward || 1) * dt;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Keep momentum in world space while the body turns: reduced lateral grip creates real sliding.
  const added = forward - (s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw));
  const vx0 = s.vx + Math.sin(s.yaw) * added, vz0 = s.vz + Math.cos(s.yaw) * added;
  const longitudinal = vx0 * sin + vz0 * cos;
  const lateral = (vx0 * cos - vz0 * sin) * Math.exp(-(c.drift ? p.driftGrip : p.grip) * dt);
  let vx = sin * longitudinal + cos * lateral, vz = cos * longitudinal - sin * lateral;
  let x = s.x + vx * dt, z = s.z + vz * dt;
  // Simple boundary collision; the open central roads are unobstructed.
  if (Math.abs(x) > 185) { x = Math.sign(x) * 185; vx *= -0.2; }
  if (Math.abs(z) > 185) { z = Math.sign(z) * 185; vz *= -0.2; }
  const speed = Math.hypot(vx, vz);
  return { x, z, yaw, vx, vz, speed, slip: speed > 3 ? Math.abs(Math.atan2(lateral, Math.abs(longitudinal))) : 0 };
}