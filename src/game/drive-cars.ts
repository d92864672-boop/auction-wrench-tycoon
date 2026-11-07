/**
 * Профили машин для «Покатушек»: скорость, силуэт, цвет и колёса.
 *
 * Требование игры: минимальная максимальная скорость — 148 км/ч (старая
 * дешёвая машина), максимальная — 326 км/ч (Lamborghini WERT Edition).
 * Скорость и динамика зависят от модели, поэтому у каждой машины свой профиль.
 */

export type DriveBodyKind = "classic" | "sedan" | "hatch" | "coupe" | "muscle" | "suv" | "super";
export type SpoilerKind = "none" | "lip" | "wing" | "big";

export type DriveSpec = {
  modelId: string;
  /** Максимальная скорость в км/ч: от 148 до 326. */
  topSpeedKmh: number;
  /** Разгон в м/с². */
  accel: number;
  body: DriveBodyKind;
  color: string;
  accent: string;
  glass: string;
  trim: string;
  size: { length: number; width: number; height: number };
  wheel: { radius: number; width: number };
  spoiler: SpoilerKind;
  /** Дополнительные детали кузова. */
  extras: { stripes?: boolean; bullBar?: boolean; roofRack?: boolean; lightBar?: boolean; underglow?: boolean };
};

export const MIN_TOP_SPEED_KMH = 148;
export const MAX_TOP_SPEED_KMH = 326;

const BASE: Omit<DriveSpec, "modelId" | "topSpeedKmh" | "accel" | "body" | "color" | "size" | "wheel"> = {
  accent: "#d81f2a",
  glass: "#0b1a24",
  trim: "#8b929f",
  spoiler: "none",
  extras: {},
};

const spec = (
  modelId: string,
  topSpeedKmh: number,
  accel: number,
  body: DriveBodyKind,
  color: string,
  size: DriveSpec["size"],
  wheel: DriveSpec["wheel"],
  rest: Partial<DriveSpec> = {},
): DriveSpec => ({ ...BASE, modelId, topSpeedKmh, accel, body, color, size, wheel, ...rest });

export const DRIVE_SPECS: Record<string, DriveSpec> = {
  // --- старые и дешёвые: медленные, узкие колёса, хром ---
  vaz2107: spec("vaz2107", 148, 8.5, "classic", "#6e1a20", { length: 4.1, width: 1.62, height: 1.44 }, { radius: 0.32, width: 0.2 }, {
    accent: "#d9d2c5",
    trim: "#c9ced6",
  }),
  priora: spec("priora", 165, 9.4, "sedan", "#1f3b6d", { length: 4.35, width: 1.7, height: 1.5 }, { radius: 0.33, width: 0.22 }),
  mark2: spec("mark2", 195, 11, "sedan", "#e6e7ea", { length: 4.76, width: 1.75, height: 1.4 }, { radius: 0.34, width: 0.24 }, {
    spoiler: "lip",
  }),
  polo: spec("polo", 176, 9.8, "hatch", "#26543f", { length: 4.05, width: 1.7, height: 1.46 }, { radius: 0.33, width: 0.22 }),
  solaris: spec("solaris", 178, 9.9, "sedan", "#d8dbe0", { length: 4.4, width: 1.73, height: 1.47 }, { radius: 0.33, width: 0.22 }),
  vesta: spec("vesta", 180, 10.2, "sedan", "#b6bcc4", { length: 4.4, width: 1.78, height: 1.5 }, { radius: 0.34, width: 0.23 }),

  // --- средний класс ---
  camry: spec("camry", 205, 12.2, "sedan", "#15171c", { length: 4.88, width: 1.84, height: 1.45 }, { radius: 0.35, width: 0.25 }),
  lc200: spec("lc200", 210, 12, "suv", "#101215", { length: 4.95, width: 1.98, height: 1.86 }, { radius: 0.42, width: 0.3 }, {
    spoiler: "lip",
    extras: { roofRack: true, lightBar: true },
  }),
  skyline: spec("skyline", 232, 13.4, "coupe", "#2a4c8f", { length: 4.6, width: 1.78, height: 1.34 }, { radius: 0.35, width: 0.26 }, {
    spoiler: "wing",
  }),
  g63: spec("g63", 235, 13.6, "suv", "#0f1113", { length: 4.8, width: 1.98, height: 1.95 }, { radius: 0.44, width: 0.32 }, {
    trim: "#2a2c31",
    extras: { bullBar: true, roofRack: true },
  }),
  supra: spec("supra", 250, 14.6, "coupe", "#dfe1e6", { length: 4.5, width: 1.82, height: 1.28 }, { radius: 0.36, width: 0.28 }, {
    spoiler: "big",
  }),
  mustang: spec("mustang", 258, 15, "muscle", "#16306b", { length: 4.78, width: 1.9, height: 1.36 }, { radius: 0.37, width: 0.29 }, {
    accent: "#e8eaee",
    spoiler: "lip",
    extras: { stripes: true },
  }),
  bmw5: spec("bmw5", 262, 15.2, "sedan", "#14161b", { length: 4.94, width: 1.87, height: 1.44 }, { radius: 0.36, width: 0.27 }, {
    spoiler: "lip",
  }),
  e63: spec("e63", 268, 15.6, "sedan", "#6f7480", { length: 4.99, width: 1.9, height: 1.45 }, { radius: 0.36, width: 0.27 }, {
    spoiler: "lip",
  }),
  rs6: spec("rs6", 275, 16, "sedan", "#23324a", { length: 4.99, width: 1.92, height: 1.47 }, { radius: 0.37, width: 0.28 }, {
    spoiler: "wing",
  }),

  // --- премиум и суперкары ---
  tesla: spec("tesla", 285, 16.8, "super", "#d7dbe0", { length: 4.98, width: 1.96, height: 1.4 }, { radius: 0.37, width: 0.28 }, {
    trim: "#3a3f47",
  }),
  urus: spec("urus", 300, 17.4, "suv", "#2b2f36", { length: 5.11, width: 2.02, height: 1.64 }, { radius: 0.43, width: 0.32 }, {
    spoiler: "wing",
  }),
  f40: spec("f40", 320, 18.4, "super", "#d81f26", { length: 4.48, width: 1.98, height: 1.12 }, { radius: 0.36, width: 0.3 }, {
    spoiler: "big",
  }),
  wert: spec("wert", 326, 19, "super", "#c1131d", { length: 4.6, width: 2.02, height: 1.1 }, { radius: 0.37, width: 0.32 }, {
    accent: "#f5d34a",
    trim: "#1b1b1f",
    spoiler: "big",
    extras: { underglow: true },
  }),

  // Тестовая машина для пустого гаража — самая скромная.
  "demo-drive": spec("demo-drive", 148, 8.2, "classic", "#4b4f57", { length: 4.05, width: 1.6, height: 1.42 }, { radius: 0.31, width: 0.19 }),
};

/** Профиль по умолчанию: медленная старая машина. */
export const DEFAULT_DRIVE_SPEC = DRIVE_SPECS["demo-drive"]!;

const clampSpeed = (kmh: number) => Math.min(MAX_TOP_SPEED_KMH, Math.max(MIN_TOP_SPEED_KMH, Math.round(kmh)));

/** Профиль для машины из гаража; неизвестная модель получает запасной вариант. */
export function driveSpec(modelId: string | undefined | null): DriveSpec {
  if (!modelId) return DEFAULT_DRIVE_SPEC;
  const found = DRIVE_SPECS[modelId];
  if (found) return { ...found, topSpeedKmh: clampSpeed(found.topSpeedKmh) };
  // Неизвестная модель: скорость по префиксу хэша, но в разрешённом диапазоне.
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) hash = (hash * 31 + modelId.charCodeAt(i)) % 9973;
  return { ...DEFAULT_DRIVE_SPEC, modelId, topSpeedKmh: clampSpeed(160 + (hash % 120)) };
}

/** Максимальная скорость в м/с — физика работает в метрах и секундах. */
export const topSpeedMs = (spec: DriveSpec): number => spec.topSpeedKmh / 3.6;

/** Длина окружности колеса: сколько метров проходит машина за один оборот. */
export const wheelCircumference = (spec: DriveSpec): number => 2 * Math.PI * spec.wheel.radius;
