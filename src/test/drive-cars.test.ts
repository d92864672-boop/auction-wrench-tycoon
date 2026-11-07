import { describe, expect, it } from "vitest";
import {
  DRIVE_SPECS,
  MAX_TOP_SPEED_KMH,
  MIN_TOP_SPEED_KMH,
  driveSpec,
  lookFingerprint,
  topSpeedMs,
  wheelCircumference,
} from "@/game/drive-cars";
import { BLACK_SELLERS, CAR_MODELS } from "@/game/data";
import { clearControls, frontWheelSteer, newDrive, stepDrive, wheelSpinDelta } from "@/game/drive-physics";

const cruise = (modelId: string) => {
  const spec = driveSpec(modelId);
  let s = newDrive();
  let peak = 0;
  const limits = { max: topSpeedMs(spec), accel: spec.accel };
  for (let i = 0; i < 60 * 90; i++) {
    s = stepDrive(s, { ...clearControls(), up: true }, "awd", 1 / 60, limits);
    peak = Math.max(peak, s.speed);
    // Дальше начинается стена карты: она гасит скорость, это не лимит машины.
    if (Math.abs(s.z) > 150 || Math.abs(s.x) > 150) break;
  }
  return { spec, state: s, kmh: peak * 3.6 };
};

const BLACK_CAR_IDS = BLACK_SELLERS.flatMap((seller) => seller.cars);

describe("машины в Покатушках", () => {
  it("у каждой модели из каталога есть свой профиль скорости в диапазоне 148–326 км/ч", () => {
    for (const model of CAR_MODELS) {
      const spec = driveSpec(model.id);
      expect(spec.modelId, model.id).toBe(model.id);
      expect(spec.topSpeedKmh, model.id).toBeGreaterThanOrEqual(MIN_TOP_SPEED_KMH);
      expect(spec.topSpeedKmh, model.id).toBeLessThanOrEqual(MAX_TOP_SPEED_KMH);
    }
  });

  it("каждая машина WERTOOS BLACK тоже имеет свой профиль, а не общий запасной", () => {
    expect(BLACK_CAR_IDS.length).toBeGreaterThan(0);
    for (const id of BLACK_CAR_IDS) {
      const own = DRIVE_SPECS[id];
      expect(own, id).toBeDefined();
      expect(own!.modelId, id).toBe(id);
      const spec = driveSpec(id);
      expect(spec.topSpeedKmh).toBeGreaterThanOrEqual(MIN_TOP_SPEED_KMH);
      expect(spec.topSpeedKmh).toBeLessThanOrEqual(MAX_TOP_SPEED_KMH);
      // Свой профиль, а не DEFAULT_DRIVE_SPEC с подставленным id.
      expect(spec.body, id).toBe(own!.body);
      expect(spec.look.parts, id).toEqual(own!.look.parts);
    }
  });

  it("дешёвая старая машина медленнее новой и дорогой", () => {
    expect(driveSpec("vaz2107").topSpeedKmh).toBe(MIN_TOP_SPEED_KMH);
    expect(driveSpec("wert").topSpeedKmh).toBe(MAX_TOP_SPEED_KMH);
    const cheap = driveSpec("vaz2107");
    const expensive = driveSpec("f40");
    expect(expensive.topSpeedKmh).toBeGreaterThan(cheap.topSpeedKmh);
    expect(expensive.accel).toBeGreaterThan(cheap.accel);
  });

  it("разгон упирается в максимум конкретной машины, а не в общий лимит", () => {
    const slow = cruise("vaz2107");
    const fast = cruise("wert");
    expect(slow.kmh).toBeGreaterThan(slow.spec.topSpeedKmh - 3);
    expect(slow.kmh).toBeLessThanOrEqual(slow.spec.topSpeedKmh + 0.5);
    expect(fast.kmh).toBeGreaterThan(fast.spec.topSpeedKmh - 3);
    expect(fast.kmh).toBeLessThanOrEqual(fast.spec.topSpeedKmh + 0.5);
    expect(fast.kmh).toBeGreaterThan(slow.kmh + 100);
  });

  it("у каждой машины своя модель: силуэт, нос, крыша, фары, решётка и детали не повторяются", () => {
    const ids = Object.keys(DRIVE_SPECS);
    const prints = ids.map((id) => lookFingerprint(DRIVE_SPECS[id]!));
    expect(new Set(prints).size).toBe(ids.length);
    // Внешность действительно разная, а не только цвет: проверяем форму без краски.
    const shapes = new Set(ids.map((id) => {
      const s = DRIVE_SPECS[id]!;
      return [s.body, s.look.nose, s.look.roof, s.look.lights, s.look.grille, ...s.look.parts].sort().join("|");
    }));
    expect(shapes.size).toBe(ids.length);
  });

  it("незнакомая модель получает собственную машину, а не общий серый кузов", () => {
    const ids = ["legacy-1", "legacy-2", "future-suv", "gt-900", "old-coupe", "van-x"];
    const specs = ids.map((id) => driveSpec(id));
    // Стабильно между запусками: один id — одна и та же машина.
    for (const [i, id] of ids.entries()) {
      expect(lookFingerprint(driveSpec(id))).toBe(lookFingerprint(specs[i]!));
      expect(specs[i]!.modelId).toBe(id);
      expect(specs[i]!.topSpeedKmh).toBeGreaterThanOrEqual(MIN_TOP_SPEED_KMH);
      expect(specs[i]!.topSpeedKmh).toBeLessThanOrEqual(MAX_TOP_SPEED_KMH);
    }
    // И заметно разная: хотя бы четыре разных силуэта на шесть незнакомых id.
    const shapes = new Set(specs.map((s) => lookFingerprint(s)));
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  it("колесо катится по скорости и радиусу, без пробуксовки в расчётах", () => {
    const spec = driveSpec("vaz2107");
    const spin = wheelSpinDelta(20, 1 / 60, spec.wheel.radius);
    const travelled = (spin * spec.wheel.radius) / (1 / 60);
    expect(travelled).toBeCloseTo(20, 6);
    // Вперёд (+Z) — положительный угол: верх колеса уходит вперёд.
    expect(spin).toBeGreaterThan(0);
    expect(wheelSpinDelta(-20, 1 / 60, spec.wheel.radius)).toBeLessThan(0);
    expect(wheelSpinDelta(20, 1 / 60, 0)).toBe(0);
    expect(wheelCircumference(spec)).toBeCloseTo(2 * Math.PI * spec.wheel.radius, 6);
  });

  it("руль поворачивает передние колёса в сторону нажатия", () => {
    expect(frontWheelSteer({ ...clearControls(), left: true })).toBeGreaterThan(0);
    expect(frontWheelSteer({ ...clearControls(), right: true })).toBeLessThan(0);
    expect(frontWheelSteer(clearControls())).toBe(0);
  });

  it("машина едет туда, куда смотрит нос: вперёд по +Z, влево — по +X", () => {
    let s = newDrive();
    for (let i = 0; i < 90; i++) s = stepDrive(s, { ...clearControls(), up: true }, "rwd", 1 / 60);
    expect(s.z).toBeGreaterThan(0);
    for (let i = 0; i < 45; i++) s = stepDrive(s, { ...clearControls(), up: true, left: true }, "rwd", 1 / 60);
    expect(s.x).toBeGreaterThan(0);
  });
});
