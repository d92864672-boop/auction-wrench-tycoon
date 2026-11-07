/**
 * Профили машин для «Покатушек»: скорость, силуэт, цвет, колёса и детали кузова.
 *
 * Требование игры: минимальная максимальная скорость — 148 км/ч (старая
 * дешёвая машина), максимальная — 326 км/ч (Lamborghini WERT Edition).
 * Скорость и динамика зависят от модели, поэтому у каждой машины свой профиль.
 *
 * У каждой машины своя модель: тип кузова, форма носа, тип крыши, фары,
 * решётка, расширение арок, клиренс и набор уникальных деталей. Поэтому даже
 * два седана в гараже выглядят по-разному — не только цветом.
 */

export type DriveBodyKind = "classic" | "sedan" | "hatch" | "coupe" | "muscle" | "suv" | "super";
export type SpoilerKind = "none" | "lip" | "wing" | "big";
export type NoseKind = "flat" | "blunt" | "sloped" | "wedge" | "round";
export type RoofKind = "notch" | "hatch" | "fastback" | "wagon" | "box" | "coupe";
export type LightKind = "round" | "rect" | "quad" | "strip" | "popup";
export type GrilleKind = "none" | "narrow" | "wide" | "mesh" | "chrome" | "kidney" | "panamericana";

/** Фирменные детали конкретной модели. */
export type DrivePart =
  | "hoodScoop"
  | "sideSkirt"
  | "diffuser"
  | "splitter"
  | "canards"
  | "snorkel"
  | "spareWheel"
  | "towHook"
  | "roofSpoiler"
  | "quadExhaust"
  | "sidePipes"
  | "rollBar"
  | "nacaDuct"
  | "vents"
  | "lightPod"
  | "chromeBumpers"
  | "sunroof"
  | "bullBar"
  | "roofRack"
  | "lightBar"
  | "stripes"
  | "underglow"
  | "wideBody";

export type DriveLook = {
  nose: NoseKind;
  roof: RoofKind;
  lights: LightKind;
  grille: GrilleKind;
  /** Высота крыши как доля габаритной высоты. */
  roofHeight: number;
  /** Наклон лобового стекла: 0 — вертикально, 1 — почти лежит. */
  windshield: number;
  /** Расширение арок: 1 — ровные борта, больше — широкий обвес. */
  fenders: number;
  /** Дорожный просвет как доля радиуса колеса. */
  ride: number;
  parts: DrivePart[];
};

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
  look: DriveLook;
};

export const MIN_TOP_SPEED_KMH = 148;
export const MAX_TOP_SPEED_KMH = 326;

const BASE: Omit<DriveSpec, "modelId" | "topSpeedKmh" | "accel" | "body" | "color" | "size" | "wheel" | "look"> = {
  accent: "#d81f2a",
  glass: "#0b1a24",
  trim: "#8b929f",
  spoiler: "none",
};

const look = (
  nose: NoseKind,
  roof: RoofKind,
  lights: LightKind,
  grille: GrilleKind,
  roofHeight: number,
  windshield: number,
  fenders: number,
  ride: number,
  parts: DrivePart[] = [],
): DriveLook => ({ nose, roof, lights, grille, roofHeight, windshield, fenders, ride, parts });

const spec = (
  modelId: string,
  topSpeedKmh: number,
  accel: number,
  body: DriveBodyKind,
  color: string,
  size: DriveSpec["size"],
  wheel: DriveSpec["wheel"],
  carLook: DriveLook,
  rest: Partial<DriveSpec> = {},
): DriveSpec => ({ ...BASE, modelId, topSpeedKmh, accel, body, color, size, wheel, look: carLook, ...rest });

export const DRIVE_SPECS: Record<string, DriveSpec> = {
  // --- старые и дешёвые: медленные, узкие колёса, хром ---
  vaz2107: spec("vaz2107", 148, 8.5, "classic", "#6e1a20", { length: 4.1, width: 1.62, height: 1.44 }, { radius: 0.32, width: 0.2 },
    look("flat", "notch", "round", "chrome", 0.34, 0.18, 1, 0.52, ["chromeBumpers", "towHook"]), {
      accent: "#d9d2c5",
      trim: "#c9ced6",
    }),
  priora: spec("priora", 165, 9.4, "sedan", "#1f3b6d", { length: 4.35, width: 1.7, height: 1.5 }, { radius: 0.33, width: 0.22 },
    look("sloped", "notch", "rect", "narrow", 0.32, 0.3, 1, 0.46, ["sideSkirt"])),
  mark2: spec("mark2", 195, 11, "sedan", "#e6e7ea", { length: 4.76, width: 1.75, height: 1.4 }, { radius: 0.34, width: 0.24 },
    look("flat", "notch", "quad", "narrow", 0.33, 0.26, 1.01, 0.48, ["chromeBumpers"]), { spoiler: "lip" }),
  polo: spec("polo", 176, 9.8, "hatch", "#26543f", { length: 4.05, width: 1.7, height: 1.46 }, { radius: 0.33, width: 0.22 },
    look("sloped", "hatch", "rect", "narrow", 0.35, 0.34, 1, 0.46, ["sideSkirt"])),
  solaris: spec("solaris", 178, 9.9, "sedan", "#d8dbe0", { length: 4.4, width: 1.73, height: 1.47 }, { radius: 0.33, width: 0.22 },
    look("round", "notch", "rect", "narrow", 0.32, 0.32, 1, 0.46)),
  vesta: spec("vesta", 180, 10.2, "sedan", "#b6bcc4", { length: 4.4, width: 1.78, height: 1.5 }, { radius: 0.34, width: 0.23 },
    look("sloped", "notch", "strip", "wide", 0.31, 0.34, 1.01, 0.46, ["sideSkirt", "sunroof"])),

  // --- средний класс ---
  camry: spec("camry", 205, 12.2, "sedan", "#15171c", { length: 4.88, width: 1.84, height: 1.45 }, { radius: 0.35, width: 0.25 },
    look("wedge", "notch", "strip", "wide", 0.3, 0.38, 1.02, 0.44, ["sideSkirt", "sunroof"])),
  lc200: spec("lc200", 210, 12, "suv", "#101215", { length: 4.95, width: 1.98, height: 1.86 }, { radius: 0.42, width: 0.3 },
    look("blunt", "box", "rect", "chrome", 0.4, 0.16, 1.03, 0.72, ["roofRack", "lightBar", "sideSkirt", "towHook"]), {
      spoiler: "lip",
    }),
  skyline: spec("skyline", 232, 13.4, "coupe", "#2a4c8f", { length: 4.6, width: 1.78, height: 1.34 }, { radius: 0.35, width: 0.26 },
    look("round", "coupe", "quad", "narrow", 0.28, 0.34, 1.04, 0.42, ["sideSkirt", "rollBar"]), { spoiler: "wing" }),
  g63: spec("g63", 235, 13.6, "suv", "#0f1113", { length: 4.8, width: 1.98, height: 1.95 }, { radius: 0.44, width: 0.32 },
    look("flat", "box", "round", "mesh", 0.42, 0.1, 1.05, 0.76, ["bullBar", "sidePipes", "roofRack", "lightPod"]), {
      trim: "#2a2c31",
    }),
  supra: spec("supra", 250, 14.6, "coupe", "#dfe1e6", { length: 4.5, width: 1.82, height: 1.28 }, { radius: 0.36, width: 0.28 },
    look("round", "coupe", "round", "narrow", 0.26, 0.38, 1.04, 0.42, ["hoodScoop", "sideSkirt"]), { spoiler: "big" }),
  mustang: spec("mustang", 258, 15, "muscle", "#16306b", { length: 4.78, width: 1.9, height: 1.36 }, { radius: 0.37, width: 0.29 },
    look("flat", "fastback", "quad", "wide", 0.27, 0.4, 1.05, 0.42, ["hoodScoop", "stripes", "diffuser", "quadExhaust"]), {
      accent: "#e8eaee",
      spoiler: "lip",
    }),
  bmw5: spec("bmw5", 262, 15.2, "sedan", "#14161b", { length: 4.94, width: 1.87, height: 1.44 }, { radius: 0.36, width: 0.27 },
    look("wedge", "notch", "quad", "kidney", 0.3, 0.36, 1.02, 0.44, ["quadExhaust", "sideSkirt"]), { spoiler: "lip" }),
  e63: spec("e63", 268, 15.6, "sedan", "#6f7480", { length: 4.99, width: 1.9, height: 1.45 }, { radius: 0.36, width: 0.27 },
    look("wedge", "notch", "strip", "panamericana", 0.3, 0.38, 1.03, 0.44, ["quadExhaust", "diffuser", "sunroof"]), {
      spoiler: "lip",
    }),
  rs6: spec("rs6", 275, 16, "sedan", "#23324a", { length: 4.99, width: 1.92, height: 1.47 }, { radius: 0.37, width: 0.28 },
    look("sloped", "wagon", "rect", "mesh", 0.32, 0.3, 1.06, 0.46, ["roofSpoiler", "quadExhaust", "sideSkirt"]), {
      spoiler: "wing",
    }),

  // --- премиум и суперкары ---
  tesla: spec("tesla", 285, 16.8, "super", "#d7dbe0", { length: 4.98, width: 1.96, height: 1.4 }, { radius: 0.37, width: 0.28 },
    look("round", "fastback", "strip", "none", 0.29, 0.44, 1.02, 0.42, ["sunroof", "splitter"]), { trim: "#3a3f47" }),
  urus: spec("urus", 300, 17.4, "suv", "#2b2f36", { length: 5.11, width: 2.02, height: 1.64 }, { radius: 0.43, width: 0.32 },
    look("wedge", "fastback", "strip", "mesh", 0.31, 0.4, 1.08, 0.6, ["diffuser", "sideSkirt", "quadExhaust"]), {
      spoiler: "wing",
    }),
  f40: spec("f40", 320, 18.4, "super", "#d81f26", { length: 4.48, width: 1.98, height: 1.12 }, { radius: 0.36, width: 0.3 },
    look("wedge", "fastback", "popup", "none", 0.24, 0.44, 1.06, 0.4, ["nacaDuct", "vents", "canards", "quadExhaust"]), {
      spoiler: "big",
    }),
  wert: spec("wert", 326, 19, "super", "#c1131d", { length: 4.6, width: 2.02, height: 1.1 }, { radius: 0.37, width: 0.32 },
    look("wedge", "fastback", "strip", "mesh", 0.24, 0.46, 1.1, 0.38, ["splitter", "canards", "diffuser", "underglow", "vents"]), {
      accent: "#f5d34a",
      trim: "#1b1b1f",
      spoiler: "big",
    }),

  // --- WERTOOS BLACK: те же кузова, но закрытая серия — тонировка, обвес, своя деталь ---
  "wb-urus": spec("wb-urus", 310, 18.2, "suv", "#0b0c0e", { length: 5.16, width: 2.06, height: 1.62 }, { radius: 0.44, width: 0.34 },
    look("wedge", "fastback", "strip", "mesh", 0.31, 0.4, 1.1, 0.56, ["wideBody", "diffuser", "sideSkirt", "quadExhaust", "roofSpoiler"]), {
      accent: "#ff2a1a",
      trim: "#4a4f57",
      spoiler: "wing",
    }),
  "wb-g63": spec("wb-g63", 245, 14.2, "suv", "#0a0a0c", { length: 4.84, width: 2.02, height: 1.96 }, { radius: 0.45, width: 0.34 },
    look("flat", "box", "round", "mesh", 0.42, 0.1, 1.08, 0.78, ["bullBar", "sidePipes", "roofRack", "lightPod", "snorkel"]), {
      accent: "#c9a227",
      trim: "#33363c",
      spoiler: "lip",
    }),
  "wb-rs6": spec("wb-rs6", 290, 17.2, "sedan", "#101216", { length: 5.02, width: 1.96, height: 1.45 }, { radius: 0.38, width: 0.3 },
    look("sloped", "wagon", "rect", "mesh", 0.32, 0.3, 1.09, 0.44, ["wideBody", "roofSpoiler", "quadExhaust", "sideSkirt", "vents"]), {
      accent: "#d81f2a",
      trim: "#4c525b",
      spoiler: "wing",
    }),
  "wb-e63": spec("wb-e63", 282, 16.8, "sedan", "#0c0d10", { length: 5.02, width: 1.93, height: 1.43 }, { radius: 0.37, width: 0.29 },
    look("wedge", "notch", "strip", "panamericana", 0.3, 0.38, 1.05, 0.42, ["quadExhaust", "diffuser", "sunroof", "canards"]), {
      accent: "#ff2a1a",
      trim: "#3d424a",
      spoiler: "lip",
    }),
  "wb-tesla": spec("wb-tesla", 298, 17.6, "super", "#0b0d12", { length: 5, width: 1.98, height: 1.38 }, { radius: 0.38, width: 0.3 },
    look("round", "fastback", "strip", "none", 0.29, 0.44, 1.04, 0.4, ["sunroof", "splitter", "diffuser"]), {
      accent: "#3ba7ff",
      trim: "#2c313a",
      spoiler: "lip",
    }),
  "wb-supra": spec("wb-supra", 268, 15.8, "coupe", "#121014", { length: 4.54, width: 1.86, height: 1.26 }, { radius: 0.37, width: 0.3 },
    look("round", "coupe", "round", "narrow", 0.26, 0.38, 1.07, 0.4, ["hoodScoop", "sideSkirt", "rollBar", "roofSpoiler"]), {
      accent: "#f5d34a",
      trim: "#454a52",
      spoiler: "big",
    }),
  "wb-lc200": spec("wb-lc200", 220, 12.6, "suv", "#0d0f11", { length: 4.98, width: 2, height: 1.88 }, { radius: 0.43, width: 0.32 },
    look("blunt", "box", "rect", "chrome", 0.4, 0.16, 1.06, 0.74, ["roofRack", "lightBar", "spareWheel", "towHook", "snorkel"]), {
      accent: "#c9a227",
      trim: "#3a3f47",
      spoiler: "lip",
    }),
  "wb-f40": spec("wb-f40", 324, 18.8, "super", "#1a1113", { length: 4.5, width: 2.02, height: 1.1 }, { radius: 0.37, width: 0.32 },
    look("wedge", "fastback", "popup", "none", 0.24, 0.46, 1.08, 0.38, ["nacaDuct", "vents", "canards", "quadExhaust", "underglow"]), {
      accent: "#f5d34a",
      trim: "#2b2b30",
      spoiler: "big",
    }),

  // Тестовая машина для пустого гаража — самая скромная.
  "demo-drive": spec("demo-drive", 148, 8.2, "classic", "#4b4f57", { length: 4.05, width: 1.6, height: 1.42 }, { radius: 0.31, width: 0.19 },
    look("flat", "notch", "round", "chrome", 0.34, 0.18, 1, 0.52, ["chromeBumpers"])),
};

/** Профиль по умолчанию: медленная старая машина. */
export const DEFAULT_DRIVE_SPEC = DRIVE_SPECS["demo-drive"]!;

const clampSpeed = (kmh: number) => Math.min(MAX_TOP_SPEED_KMH, Math.max(MIN_TOP_SPEED_KMH, Math.round(kmh)));

const FALLBACK_BODY: DriveBodyKind[] = ["classic", "sedan", "hatch", "coupe", "muscle", "suv", "super"];
const FALLBACK_NOSE: NoseKind[] = ["flat", "blunt", "sloped", "wedge", "round"];
const FALLBACK_ROOF: RoofKind[] = ["notch", "hatch", "fastback", "wagon", "box", "coupe"];
const FALLBACK_LIGHTS: LightKind[] = ["round", "rect", "quad", "strip", "popup"];
const FALLBACK_GRILLE: GrilleKind[] = ["narrow", "wide", "mesh", "chrome", "kidney", "panamericana"];
const FALLBACK_PARTS: DrivePart[] = ["sideSkirt", "hoodScoop", "diffuser", "roofSpoiler", "vents", "sunroof", "quadExhaust", "splitter"];

/** Стабильный хэш строки: один и тот же id всегда даёт одну и ту же машину. */
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Незнакомая модель (например, редкий лот из будущего обновления) получает
 * собственную машину, а не общий серый «классик»: силуэт, цвет и детали
 * выводятся из id и не меняются между запусками.
 */
function fallbackSpec(modelId: string): DriveSpec {
  const h = idHash(modelId);
  const pick = <T,>(arr: T[], shift: number): T => arr[(h >>> shift) % arr.length]!;
  const hue = (h % 360 + 360) % 360;
  const body = pick(FALLBACK_BODY, 0);
  const parts: DrivePart[] = [pick(FALLBACK_PARTS, 3)];
  const second = pick(FALLBACK_PARTS, 11);
  if (second !== parts[0]) parts.push(second);
  const long = 3.9 + ((h >>> 5) % 13) / 10;
  const wide = 1.58 + ((h >>> 9) % 5) / 20;
  const tall = 1.3 + ((h >>> 13) % 7) / 10;
  return {
    ...DEFAULT_DRIVE_SPEC,
    modelId,
    topSpeedKmh: clampSpeed(155 + (h % 165)),
    accel: 8.5 + ((h >>> 7) % 110) / 10,
    body,
    color: `hsl(${hue} ${35 + ((h >>> 17) % 30)}% ${22 + ((h >>> 19) % 45)}%)`,
    accent: `hsl(${(hue + 180) % 360} 78% 52%)`,
    size: { length: Math.round(long * 100) / 100, width: Math.round(wide * 100) / 100, height: Math.round(tall * 100) / 100 },
    wheel: { radius: 0.31 + ((h >>> 21) % 14) / 100, width: 0.2 + ((h >>> 23) % 12) / 100 },
    spoiler: (["none", "lip", "wing", "big"] as SpoilerKind[])[(h >>> 25) % 4]!,
    look: {
      nose: pick(FALLBACK_NOSE, 1),
      roof: pick(FALLBACK_ROOF, 2),
      lights: pick(FALLBACK_LIGHTS, 4),
      grille: pick(FALLBACK_GRILLE, 6),
      roofHeight: 0.26 + ((h >>> 15) % 17) / 100,
      windshield: 0.18 + ((h >>> 27) % 28) / 100,
      fenders: 1 + ((h >>> 29) % 10) / 100,
      ride: 0.4 + ((h >>> 31) % 35) / 100,
      parts,
    },
  };
}

/** Профиль для машины из гаража; неизвестная модель получает свою запасную машину. */
export function driveSpec(modelId: string | undefined | null): DriveSpec {
  if (!modelId) return DEFAULT_DRIVE_SPEC;
  const found = DRIVE_SPECS[modelId];
  if (found) return { ...found, topSpeedKmh: clampSpeed(found.topSpeedKmh) };
  return fallbackSpec(modelId);
}

/** Максимальная скорость в м/с — физика работает в метрах и секундах. */
export const topSpeedMs = (spec: DriveSpec): number => spec.topSpeedKmh / 3.6;

/** Длина окружности колеса: сколько метров проходит машина за один оборот. */
export const wheelCircumference = (spec: DriveSpec): number => 2 * Math.PI * spec.wheel.radius;

/** Отпечаток внешности: по нему видно, что модели не повторяют друг друга. */
export const lookFingerprint = (spec: DriveSpec): string =>
  [
    spec.body,
    spec.look.nose,
    spec.look.roof,
    spec.look.lights,
    spec.look.grille,
    spec.size.length,
    spec.size.width,
    spec.size.height,
    spec.wheel.radius,
    spec.wheel.width,
    spec.spoiler,
    [...spec.look.parts].sort().join("+"),
  ].join("|");
