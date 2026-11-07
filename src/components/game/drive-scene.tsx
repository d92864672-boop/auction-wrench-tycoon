import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import {
  frontWheelSteer,
  newDrive,
  stepDrive,
  wheelSpinDelta,
  type Controls,
  type DriveMode,
} from "@/game/drive-physics";
import { driveSpec, topSpeedMs, type DrivePart, type DriveSpec, type RoofKind } from "@/game/drive-cars";
import type { Car } from "@/game/engine";

function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (key: string) => css.getPropertyValue(`--drive-${key}`).trim();
  return { sky: read("sky"), asphalt: read("asphalt"), line: read("line"), grass: read("grass"), building: read("building"), window: read("window"), sun: read("sun") };
}

type SceneProps = {
  car: Car;
  ctl: RefObject<Controls>;
  modeRef: RefObject<DriveMode>;
  speedRef: RefObject<HTMLSpanElement | null>;
  slipRef: RefObject<HTMLSpanElement | null>;
  resetRef: RefObject<boolean>;
};

const WHEELS = [
  { key: "fl", x: -1, z: 1, steer: true },
  { key: "fr", x: 1, z: 1, steer: true },
  { key: "bl", x: -1, z: -1, steer: false },
  { key: "br", x: 1, z: -1, steer: false },
] as const;
const WHEEL_KEYS = WHEELS.map((w) => w.key);

/** Пропорции кабины по типу крыши: длина как доля габаритов и сдвиг по Z. */
const CABIN: Record<RoofKind, { len: number; offset: number }> = {
  notch: { len: 0.46, offset: 0.02 },
  hatch: { len: 0.54, offset: 0.1 },
  fastback: { len: 0.5, offset: 0 },
  wagon: { len: 0.62, offset: -0.02 },
  box: { len: 0.66, offset: -0.03 },
  coupe: { len: 0.42, offset: 0.06 },
};

/** Колесо: покрышка, диск и спицы, чтобы вращение было видно. */
function Wheel({
  spec,
  position,
  spinRef,
  steerRef,
}: {
  spec: DriveSpec;
  position: [number, number, number];
  spinRef: (o: THREE.Group | null) => void;
  steerRef: (o: THREE.Group | null) => void;
}) {
  const { radius: R, width: Wd } = spec.wheel;
  return (
    <group position={position}>
      <group ref={steerRef}>
        <group ref={spinRef}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R, R, Wd, 24]} />
            <meshStandardMaterial color="#0d0d10" roughness={0.92} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R * 0.62, R * 0.62, Wd * 1.04, 20]} />
            <meshStandardMaterial color={spec.trim} metalness={0.95} roughness={0.22} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[(i * Math.PI) / 4, 0, 0]}>
              <boxGeometry args={[Wd * 0.9, R * 1.7, 0.05]} />
              <meshStandardMaterial color={spec.trim} metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

type BoxProps = {
  size: [number, number, number];
  pos: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  rot?: [number, number, number];
};

/** Короткая обёртка над коробкой: кузов собирается из десятков деталей. */
function Box({ size, pos, color, metalness = 0.6, roughness = 0.35, emissive, emissiveIntensity, rot }: BoxProps) {
  return (
    <mesh position={pos} rotation={rot} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

/**
 * Кузов собирается из примитивов по профилю конкретной машины: форма носа,
 * тип крыши, фары, решётка, расширение арок, клиренс и набор фирменных
 * деталей. Поэтому каждая модель выглядит по-своему, а не «как все».
 * Нос машины смотрит в +Z — туда же, куда едет физика.
 */
function CarBody({ spec }: { spec: DriveSpec }) {
  const { length: L, width: W, height: H } = spec.size;
  const { look } = spec;
  const R = spec.wheel.radius;
  const ride = R * look.ride;
  const bodyH = H * 0.4;
  const bodyY = ride + bodyH / 2;
  const noseZ = L / 2;
  const tailZ = -L / 2;
  const bodyColor = spec.color;
  const trim = spec.trim;
  const glass = spec.glass;
  const has = (part: DrivePart) => look.parts.includes(part);

  const cabin = CABIN[look.roof];
  const cabinH = H * look.roofHeight;
  const cabinLen = L * cabin.len;
  const cabinZ = L * cabin.offset;
  const cabinY = ride + bodyH * 0.94 + cabinH / 2;
  const roofY = cabinY + cabinH / 2;
  const wheelX = W / 2 - spec.wheel.width * 0.35;
  const wheelZ = L * 0.31;

  const lightColor = "#fff6d5";
  const lightEmissive = "#ffe9a8";
  const tailColor = "#ff3b30";
  const tailEmissive = "#ff1a10";

  // --- нос: у каждой модели своя форма передка ---
  const nose = (() => {
    switch (look.nose) {
      case "flat":
        return <Box size={[W * 0.95, bodyH * 0.9, L * 0.28]} pos={[0, bodyY + bodyH * 0.06, noseZ - L * 0.14]} color={bodyColor} />;
      case "blunt":
        return (
          <>
            <Box size={[W * 0.97, bodyH * 1.02, L * 0.22]} pos={[0, bodyY + bodyH * 0.1, noseZ - L * 0.11]} color={bodyColor} />
            <Box size={[W * 0.99, bodyH * 0.16, 0.1]} pos={[0, bodyY - bodyH * 0.28, noseZ + 0.02]} color={trim} metalness={0.85} roughness={0.3} />
          </>
        );
      case "sloped":
        return (
          <>
            <Box size={[W * 0.94, bodyH * 0.55, L * 0.34]} pos={[0, bodyY + bodyH * 0.22, noseZ - L * 0.17]} color={bodyColor} rot={[-0.08, 0, 0]} />
            <Box size={[W * 0.92, bodyH * 0.2, L * 0.1]} pos={[0, bodyY - bodyH * 0.16, noseZ - L * 0.03]} color={bodyColor} />
          </>
        );
      case "wedge":
        return (
          <>
            <Box size={[W * 0.97, bodyH * 0.52, L * 0.36]} pos={[0, bodyY - bodyH * 0.14, noseZ - L * 0.18]} color={bodyColor} />
            <Box size={[W * 0.9, bodyH * 0.26, L * 0.2]} pos={[0, bodyY + bodyH * 0.16, noseZ - L * 0.28]} color={bodyColor} rot={[-0.16, 0, 0]} />
          </>
        );
      case "round":
        return (
          <>
            <Box size={[W * 0.94, bodyH * 0.82, L * 0.24]} pos={[0, bodyY, noseZ - L * 0.12]} color={bodyColor} />
            <mesh position={[0, bodyY, noseZ - 0.01]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[bodyH * 0.4, bodyH * 0.4, W * 0.94, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.35} />
            </mesh>
          </>
        );
    }
  })();

  // --- корма: седан с багажником, лифтбек со скосом, универсал/рамник до крыши ---
  const tail = (() => {
    if (look.roof === "notch") {
      return <Box size={[W * 0.93, bodyH * 0.5, L * 0.26]} pos={[0, bodyY + bodyH * 0.16, tailZ + L * 0.14]} color={bodyColor} />;
    }
    if (look.roof === "fastback" || look.roof === "coupe") {
      return (
        <Box
          size={[W * 0.9, bodyH * 0.34, L * 0.4]}
          pos={[0, bodyY + bodyH * 0.28, tailZ + L * 0.2]}
          color={bodyColor}
          rot={[0.16, 0, 0]}
        />
      );
    }
    if (look.roof === "hatch") {
      return <Box size={[W * 0.92, bodyH * 0.72, L * 0.16]} pos={[0, bodyY + bodyH * 0.14, tailZ + L * 0.08]} color={bodyColor} />;
    }
    return null;
  })();

  // --- фары: круглые, прямоугольные, четырёхблочные, лента, «слепые» pop-up ---
  const lights = (() => {
    const y = bodyY + bodyH * 0.26;
    const z = noseZ + 0.03;
    switch (look.lights) {
      case "round":
        return [-0.33, 0.33].map((x) => (
          <mesh key={`r${x}`} position={[x * W, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[H * 0.075, H * 0.075, 0.08, 16]} />
            <meshStandardMaterial color={lightColor} emissive={lightEmissive} emissiveIntensity={1.6} />
          </mesh>
        ));
      case "rect":
        return [-0.32, 0.32].map((x) => (
          <Box key={`h${x}`} size={[W * 0.22, H * 0.075, 0.07]} pos={[x * W, y, z]} color={lightColor} emissive={lightEmissive} emissiveIntensity={1.5} metalness={0.2} roughness={0.2} />
        ));
      case "quad":
        return [-0.44, -0.28, 0.28, 0.44].map((x) => (
          <Box key={`q${x}`} size={[W * 0.12, H * 0.065, 0.07]} pos={[x * W, y, z]} color={lightColor} emissive={lightEmissive} emissiveIntensity={1.5} metalness={0.2} roughness={0.2} />
        ));
      case "strip":
        return (
          <Box size={[W * 0.8, H * 0.045, 0.06]} pos={[0, y, z]} color={lightColor} emissive={lightEmissive} emissiveIntensity={1.7} metalness={0.2} roughness={0.2} />
        );
      case "popup":
        return (
          <>
            {[-0.34, 0.34].map((x) => (
              <group key={`p${x}`}>
                <Box size={[W * 0.22, H * 0.05, L * 0.1]} pos={[x * W, bodyY + bodyH * 0.42, noseZ - L * 0.1]} color={bodyColor} />
                <Box size={[W * 0.18, H * 0.028, 0.04]} pos={[x * W, bodyY + bodyH * 0.44, noseZ - L * 0.06]} color={lightColor} emissive={lightEmissive} emissiveIntensity={1.4} metalness={0.2} roughness={0.2} />
              </group>
            ))}
          </>
        );
    }
  })();

  // --- решётка радиатора: у каждой марки своя ---
  const grille = (() => {
    const y = bodyY + bodyH * 0.02;
    const z = noseZ + 0.02;
    switch (look.grille) {
      case "none":
        return null;
      case "narrow":
        return <Box size={[W * 0.32, H * 0.07, 0.05]} pos={[0, y, z]} color="#101215" metalness={0.7} roughness={0.45} />;
      case "wide":
        return <Box size={[W * 0.6, H * 0.1, 0.05]} pos={[0, y, z]} color="#0c0e12" metalness={0.7} roughness={0.45} />;
      case "mesh":
        return <Box size={[W * 0.58, H * 0.13, 0.05]} pos={[0, y, z]} color="#0a0c10" metalness={0.85} roughness={0.5} />;
      case "chrome":
        return <Box size={[W * 0.44, H * 0.08, 0.05]} pos={[0, y, z]} color={trim} metalness={0.95} roughness={0.2} />;
      case "kidney":
        return [-0.1, 0.1].map((x) => (
          <Box key={`k${x}`} size={[W * 0.15, H * 0.1, 0.05]} pos={[x * W, y, z]} color={trim} metalness={0.95} roughness={0.2} />
        ));
      case "panamericana":
        return Array.from({ length: 5 }, (_, i) => (
          <Box key={`pam${i}`} size={[W * 0.03, H * 0.12, 0.045]} pos={[(i - 2) * W * 0.11, y, z]} color={trim} metalness={0.95} roughness={0.18} />
        ));
    }
  })();

  return (
    <group>
      {/* основной корпус */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, bodyH, L * 0.96]} />
        <meshStandardMaterial color={bodyColor} metalness={0.62} roughness={0.34} />
      </mesh>
      {nose}
      {tail}

      {/* кабина и стёкла */}
      <mesh position={[0, cabinY, cabinZ]} castShadow>
        <boxGeometry args={[W * 0.86, cabinH, cabinLen]} />
        <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, cabinY + cabinH * 0.06, cabinZ]}>
        <boxGeometry args={[W * 0.88, cabinH * 0.58, cabinLen * 0.94]} />
        <meshStandardMaterial color={glass} metalness={0.9} roughness={0.08} />
      </mesh>
      {/* лобовое стекло под своим углом для каждой модели */}
      <Box
        size={[W * 0.8, cabinH * 0.9, 0.05]}
        pos={[0, cabinY + cabinH * 0.02, cabinZ + cabinLen / 2 - 0.02]}
        color={glass}
        metalness={0.9}
        roughness={0.08}
        rot={[-0.35 - look.windshield * 0.5, 0, 0]}
      />
      {look.roof !== "box" && (
        <Box
          size={[W * 0.78, cabinH * 0.72, 0.05]}
          pos={[0, cabinY + cabinH * 0.02, cabinZ - cabinLen / 2 + 0.02]}
          color={glass}
          metalness={0.9}
          roughness={0.08}
          rot={[0.3 + look.windshield * 0.35, 0, 0]}
        />
      )}

      {/* акцентная полоса по борту */}
      <mesh position={[0, bodyY + bodyH * 0.08, 0]}>
        <boxGeometry args={[W * 1.005, Math.max(0.035, H * 0.045), L * 0.86]} />
        <meshStandardMaterial color={spec.accent} emissive={spec.accent} emissiveIntensity={0.25} roughness={0.4} />
      </mesh>

      {/* расширенные арки: широкий обвес видно издалека */}
      {(look.fenders > 1.01 || has("wideBody")) &&
        WHEELS.map((w) => (
          <Box
            key={`flare${w.key}`}
            size={[0.09 + (has("wideBody") ? 0.05 : 0), bodyH * 0.62, R * 2.35]}
            pos={[w.x * (W / 2 + 0.02), bodyY - bodyH * 0.04, w.z * wheelZ]}
            color={has("wideBody") ? spec.accent : bodyColor}
            metalness={0.55}
            roughness={0.42}
          />
        ))}

      {/* фары и решётка */}
      {lights}
      {grille}

      {/* стопы (корма, -Z) */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`tl${x}`} position={[x * W * 0.72, bodyY + bodyH * 0.32, tailZ - 0.02]}>
          <boxGeometry args={[W * 0.2, H * 0.08, 0.07]} />
          <meshStandardMaterial color={tailColor} emissive={tailEmissive} emissiveIntensity={1.3} />
        </mesh>
      ))}

      {/* антикрыло / спойлер */}
      {spec.spoiler === "lip" && (
        <Box size={[W * 0.8, H * 0.05, L * 0.12]} pos={[0, bodyY + bodyH * 0.52, tailZ + L * 0.04]} color={bodyColor} metalness={0.6} roughness={0.4} />
      )}
      {spec.spoiler !== "lip" && spec.spoiler !== "none" && (
        <group position={[0, bodyY + bodyH * 0.5, tailZ + L * 0.02]}>
          <Box
            size={[W * (spec.spoiler === "big" ? 0.98 : 0.82), H * 0.045, L * 0.13]}
            pos={[0, H * 0.16, 0]}
            color={bodyColor}
            metalness={0.7}
            roughness={0.3}
          />
          {[-0.32, 0.32].map((x) => (
            <Box key={`sup${x}`} size={[W * 0.05, H * 0.16, L * 0.06]} pos={[x * W, H * 0.08, 0]} color={trim} metalness={0.8} roughness={0.35} />
          ))}
        </group>
      )}

      {/* --- фирменные детали модели --- */}
      {has("chromeBumpers") && (
        <>
          <Box size={[W * 0.98, H * 0.07, 0.1]} pos={[0, ride + bodyH * 0.22, noseZ - 0.01]} color={trim} metalness={0.95} roughness={0.18} />
          <Box size={[W * 0.98, H * 0.07, 0.1]} pos={[0, ride + bodyH * 0.22, tailZ + 0.01]} color={trim} metalness={0.95} roughness={0.18} />
        </>
      )}
      {has("towHook") && (
        <mesh position={[W * 0.3, ride + 0.06, noseZ + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.14, 10]} />
          <meshStandardMaterial color={spec.accent} metalness={0.7} roughness={0.35} />
        </mesh>
      )}
      {has("sideSkirt") &&
        [-1, 1].map((side) => (
          <Box key={`skirt${side}`} size={[0.07, bodyH * 0.2, L * 0.52]} pos={[side * (W / 2), ride + bodyH * 0.14, 0]} color={bodyColor} metalness={0.5} roughness={0.5} />
        ))}
      {has("hoodScoop") && (
        <Box size={[W * 0.26, H * 0.05, L * 0.14]} pos={[0, ride + bodyH + 0.03, noseZ - L * 0.24]} color={bodyColor} metalness={0.55} roughness={0.45} />
      )}
      {has("nacaDuct") && (
        <Box size={[W * 0.3, 0.03, L * 0.1]} pos={[0, ride + bodyH + 0.02, noseZ - L * 0.3]} color="#0a0b0d" metalness={0.4} roughness={0.7} />
      )}
      {has("vents") &&
        [-1, 1].map((side) =>
          [0, 1, 2].map((i) => (
            <Box key={`vent${side}${i}`} size={[W * 0.09, 0.02, 0.05]} pos={[side * W * 0.3, ride + bodyH + 0.02, tailZ + L * 0.32 - i * 0.08]} color="#0a0b0d" metalness={0.5} roughness={0.6} />
          )),
        )}
      {has("splitter") && (
        <Box size={[W * 0.94, 0.04, L * 0.16]} pos={[0, ride + 0.04, noseZ - L * 0.05]} color={trim} metalness={0.8} roughness={0.3} />
      )}
      {has("diffuser") && (
        <>
          <Box size={[W * 0.82, H * 0.06, L * 0.1]} pos={[0, ride + 0.05, tailZ + L * 0.06]} color="#0a0b0d" metalness={0.6} roughness={0.5} />
          {[-0.28, 0, 0.28].map((x) => (
            <Box key={`fin${x}`} size={[0.03, H * 0.06, L * 0.09]} pos={[x * W, ride + 0.09, tailZ + L * 0.06]} color={trim} metalness={0.8} roughness={0.3} />
          ))}
        </>
      )}
      {has("canards") &&
        [-1, 1].map((side) =>
          [0, 1].map((i) => (
            <Box key={`can${side}${i}`} size={[W * 0.16, 0.02, 0.09]} pos={[side * (W / 2 + 0.04), ride + bodyH * 0.3 + i * 0.09, noseZ - L * 0.06]} color={trim} metalness={0.85} roughness={0.3} />
          )),
        )}
      {has("snorkel") && (
        <Box size={[0.09, H * 0.52, 0.1]} pos={[W * 0.42, cabinY, cabinZ + cabinLen * 0.42]} color={trim} metalness={0.85} roughness={0.3} />
      )}
      {has("spareWheel") && (
        <mesh position={[0, bodyY + bodyH * 0.2, tailZ - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R * 0.85, R * 0.85, 0.18, 20]} />
          <meshStandardMaterial color="#0d0d10" roughness={0.9} />
        </mesh>
      )}
      {has("roofSpoiler") && (
        <Box size={[W * 0.82, 0.05, L * 0.09]} pos={[0, roofY + 0.02, cabinZ - cabinLen * 0.44]} color={bodyColor} metalness={0.6} roughness={0.4} />
      )}
      {has("rollBar") && (
        <group position={[0, cabinY, cabinZ - cabinLen * 0.42]}>
          <Box size={[W * 0.78, 0.06, 0.06]} pos={[0, cabinH * 0.45, 0]} color={trim} metalness={0.9} roughness={0.25} />
          {[-0.34, 0.34].map((x) => (
            <Box key={`rb${x}`} size={[0.05, cabinH * 0.9, 0.05]} pos={[x * W, 0, 0]} color={trim} metalness={0.9} roughness={0.25} />
          ))}
        </group>
      )}
      {has("sidePipes") &&
        [-1, 1].map((side) => (
          <mesh key={`sp${side}`} position={[side * (W / 2 + 0.03), ride + bodyH * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, L * 0.5, 12]} />
            <meshStandardMaterial color={trim} metalness={0.95} roughness={0.22} />
          </mesh>
        ))}
      {has("lightPod") && (
        <group position={[0, roofY + 0.05, cabinZ + cabinLen * 0.3]}>
          <Box size={[W * 0.6, 0.07, 0.12]} pos={[0, 0, 0]} color={trim} metalness={0.7} roughness={0.4} />
          {[-0.24, -0.08, 0.08, 0.24].map((x) => (
            <Box key={`lp${x}`} size={[0.09, 0.05, 0.04]} pos={[x * W, 0, 0.07]} color="#fffbe8" emissive="#fff2b0" emissiveIntensity={1.5} metalness={0.2} roughness={0.2} />
          ))}
        </group>
      )}
      {has("bullBar") && (
        <group position={[0, ride + bodyH * 0.16, noseZ + 0.08]}>
          {[0, 1].map((i) => (
            <Box key={`bb${i}`} size={[W * 0.9, 0.05, 0.06]} pos={[0, i * 0.18, 0]} color={trim} metalness={0.9} roughness={0.3} />
          ))}
          {[-0.34, 0, 0.34].map((x) => (
            <Box key={`bv${x}`} size={[0.05, 0.24, 0.05]} pos={[x * W, 0.09, 0]} color={trim} metalness={0.9} roughness={0.3} />
          ))}
        </group>
      )}
      {has("roofRack") &&
        [-0.34, 0.34].map((x) => (
          <Box key={`rail${x}`} size={[W * 0.06, 0.04, cabinLen * 0.92]} pos={[x * W, roofY + 0.03, cabinZ]} color={trim} metalness={0.85} roughness={0.3} />
        ))}
      {has("lightBar") && (
        <Box size={[W * 0.6, 0.05, 0.08]} pos={[0, roofY + 0.06, cabinZ + cabinLen * 0.42]} color="#fffbe8" emissive="#fff2b0" emissiveIntensity={1.4} metalness={0.2} roughness={0.2} />
      )}
      {has("sunroof") && (
        <Box size={[W * 0.5, 0.02, cabinLen * 0.34]} pos={[0, roofY + 0.01, cabinZ + cabinLen * 0.1]} color={glass} metalness={0.9} roughness={0.08} />
      )}
      {has("stripes") &&
        [-0.16, 0.16].map((x) => (
          <Box key={`stripe${x}`} size={[W * 0.1, 0.02, L * 0.94]} pos={[x * W, ride + bodyH + 0.01, 0]} color={spec.accent} metalness={0.3} roughness={0.45} />
        ))}
      {has("underglow") && (
        <mesh position={[0, ride * 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 1.1, L * 0.9]} />
          <meshBasicMaterial color={spec.accent} transparent opacity={0.35} />
        </mesh>
      )}

      {/* выхлоп: у заряженных версий четыре трубы */}
      {(has("quadExhaust") ? [-0.42, -0.26, 0.26, 0.42] : [-0.34, 0.34]).map((x) => (
        <mesh key={`ex${x}`} position={[x * W, ride + bodyH * 0.12, tailZ - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
          <meshStandardMaterial color={trim} metalness={0.95} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function Vehicle({ car, ctl, modeRef, speedRef, slipRef, resetRef }: SceneProps) {
  const spec = useMemo(() => driveSpec(car.modelId), [car.modelId]);
  const g = useRef<THREE.Group>(null);
  const s = useRef(newDrive());
  const ready = useRef(false);
  const spinRefs = useRef<Record<string, THREE.Group | null>>({});
  const steerRefs = useRef<Record<string, THREE.Group | null>>({});
  const behind = useMemo(() => new THREE.Vector3(), []);
  const limits = useMemo(() => ({ max: topSpeedMs(spec), accel: spec.accel }), [spec]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = {
      get state() { return { ...s.current, mode: modeRef.current }; },
      sim(seconds: number) {
        for (let i = 0; i < Math.min(seconds, 60) * 60; i++) s.current = stepDrive(s.current, ctl.current, modeRef.current, 1 / 60, limits);
        return { ...s.current };
      },
    };
    Object.assign(window, { __drive: debug });
    return () => { Reflect.deleteProperty(window, "__drive"); };
  }, [ctl, modeRef, limits]);

  useFrame(({ camera, gl }, delta) => {
    const body = g.current;
    if (!body) return;
    if (resetRef.current) { s.current = newDrive(); resetRef.current = false; }
    const dt = Math.min(delta, 0.05);
    s.current = stepDrive(s.current, ctl.current, modeRef.current, dt, limits);
    const v = s.current;
    body.position.set(v.x, 0, v.z);
    body.rotation.y = v.yaw;

    // Колёса: катятся ровно по скорости и радиусу, передние ещё и рулят.
    const spin = wheelSpinDelta(v.speed, dt, spec.wheel.radius);
    for (const key of WHEEL_KEYS) {
      const wheel = spinRefs.current[key];
      if (wheel) wheel.rotation.x += spin;
    }
    const steerTarget = frontWheelSteer(ctl.current);
    for (const key of ["fl", "fr"] as const) {
      const pivot = steerRefs.current[key];
      if (pivot) pivot.rotation.y += (steerTarget - pivot.rotation.y) * Math.min(1, dt * 10);
    }

    behind.set(v.x - Math.sin(v.yaw) * 9, 4.6, v.z - Math.cos(v.yaw) * 9);
    camera.position.lerp(behind, 1 - Math.exp(-6 * dt));
    camera.lookAt(v.x + Math.sin(v.yaw) * 3, 1.1, v.z + Math.cos(v.yaw) * 3);
    if (speedRef.current) speedRef.current.textContent = String(Math.round(v.speed * 3.6));
    if (slipRef.current) slipRef.current.textContent = v.slip > 0.12 ? `ДРИФТ · ${Math.round(v.slip * 180 / Math.PI)}°` : "Сцепление";
    // Какая именно модель сейчас на трассе — видно снаружи и в браузерной проверке.
    if (gl.domElement.dataset['carModel'] !== spec.modelId) gl.domElement.dataset['carModel'] = spec.modelId;
    // This callback runs before rendering: mark ready on the following frame.
    if (ready.current) gl.domElement.dataset['sceneReady'] = "1";
    ready.current = true;
  });

  const wheelX = spec.size.width / 2 - spec.wheel.width * 0.35;
  const wheelZ = spec.size.length * 0.31;

  return (
    <group ref={g}>
      <CarBody spec={spec} />
      {WHEELS.map((w) => (
        <Wheel
          key={w.key}
          spec={spec}
          position={[w.x * wheelX, spec.wheel.radius, w.z * wheelZ]}
          spinRef={(o) => { spinRefs.current[w.key] = o; }}
          steerRef={w.steer ? (o) => { steerRefs.current[w.key] = o; } : () => {}}
        />
      ))}
    </group>
  );
}

function City({ p }: { p: ReturnType<typeof palette> }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = p['asphalt'] ?? ""; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = p['building'] ?? "";
      for (let i = 0; i < 900; i++) { ctx.globalAlpha = 0.07 + (i % 4) * 0.015; ctx.fillRect((i * 73) % 256, (i * 117) % 256, 1, 1); }
    }
    const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [p]);
  useEffect(() => () => texture.dispose(), [texture]);
  const blocks = useMemo(() => {
    const out: { x: number; z: number; h: number }[] = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      if (!i || !j) continue;
      out.push({ x: i * 50, z: j * 50, h: 5 + ((i * 7 + j * 13 + 100) % 6) * 2 });
    }
    return out;
  }, []);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial map={texture} roughness={0.95} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 110, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[160, 390]} /><meshStandardMaterial color={p['grass']} roughness={1} /></mesh>)}
    {Array.from({ length: 36 }, (_, i) => <mesh key={i} position={[0, 0.02, i * 10 - 175]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.18, 4]} /><meshStandardMaterial color={p['line']} /></mesh>)}
    {blocks.map((b, i) => <group key={i} position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]} castShadow><boxGeometry args={[15, b.h, 15]} /><meshStandardMaterial color={p['building']} roughness={0.85} /></mesh>
      <mesh position={[0, b.h * 0.62, -7.52]}><planeGeometry args={[12, b.h * 0.3]} /><meshStandardMaterial color={p['window']} metalness={0.35} roughness={0.3} /></mesh>
    </group>)}
  </>;
}

export default function DriveScene(props: SceneProps) {
  const p = useMemo(palette, []);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 4.6, -9], fov: 60 }}>
    <color attach="background" args={[p['sky'] ?? ""]} />
    <fog attach="fog" args={[p['sky'] ?? "", 100, 230]} />
    <hemisphereLight args={[p['sun'], p['window'], 1.2]} />
    <directionalLight position={[30, 50, -20]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0, 8, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} color={p['sun']} /></Environment>
    <City p={p} />
    <Suspense fallback={null}><Vehicle {...props} /></Suspense>
  </Canvas>;
}
