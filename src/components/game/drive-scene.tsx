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
import { driveSpec, topSpeedMs, type DriveSpec } from "@/game/drive-cars";
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

/** Пропорции кабины по типу кузова: длина/высота как доля габаритов, сдвиг по Z. */
const CABIN: Record<DriveSpec["body"], { h: number; len: number; offset: number }> = {
  classic: { h: 0.36, len: 0.44, offset: 0.02 },
  sedan: { h: 0.32, len: 0.46, offset: 0.04 },
  hatch: { h: 0.36, len: 0.5, offset: 0.16 },
  coupe: { h: 0.27, len: 0.42, offset: 0.08 },
  muscle: { h: 0.26, len: 0.4, offset: 0.1 },
  suv: { h: 0.4, len: 0.56, offset: 0.06 },
  super: { h: 0.24, len: 0.36, offset: 0.08 },
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

/**
 * Кузов собирается из примитивов по профилю машины: у каждой модели свой
 * силуэт (классика, седан, хэтч, купе, маслкар, внедорожник, суперкар),
 * цвет, габариты, колёса и детали вроде антикрыла или кенгурятника.
 * Нос машины смотрит в +Z — туда же, куда едет физика.
 */
function CarBody({ spec }: { spec: DriveSpec }) {
  const { length: L, width: W, height: H } = spec.size;
  const cabin = CABIN[spec.body];
  const ride = spec.wheel.radius * (spec.body === "suv" ? 0.72 : 0.5);
  const bodyH = H * 0.42;
  const bodyY = ride + bodyH / 2;
  const cabinH = H * cabin.h;
  const cabinLen = L * cabin.len;
  const cabinZ = L * cabin.offset;
  const cabinY = ride + bodyH + cabinH / 2 - bodyH * 0.08;
  const noseZ = L / 2;
  const tailZ = -L / 2;
  const glassColor = spec.glass;

  return (
    <group>
      {/* нижняя часть кузова */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, bodyH, L]} />
        <meshStandardMaterial color={spec.color} metalness={0.62} roughness={0.34} />
      </mesh>
      {/* капот спереди (+Z) и багажник/корма сзади (-Z) */}
      <mesh position={[0, bodyY + bodyH * 0.32, noseZ - L * 0.22]} castShadow>
        <boxGeometry args={[W * 0.92, bodyH * 0.3, L * 0.3]} />
        <meshStandardMaterial color={spec.color} metalness={0.6} roughness={0.36} />
      </mesh>
      {spec.body !== "hatch" && spec.body !== "suv" && (
        <mesh position={[0, bodyY + bodyH * 0.3, tailZ + L * 0.16]} castShadow>
          <boxGeometry args={[W * 0.92, bodyH * 0.26, L * 0.24]} />
          <meshStandardMaterial color={spec.color} metalness={0.6} roughness={0.36} />
        </mesh>
      )}
      {/* кабина */}
      <mesh position={[0, cabinY, cabinZ]} castShadow>
        <boxGeometry args={[W * 0.86, cabinH, cabinLen]} />
        <meshStandardMaterial color={spec.color} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* стёкла */}
      <mesh position={[0, cabinY + cabinH * 0.1, cabinZ]}>
        <boxGeometry args={[W * 0.88, cabinH * 0.62, cabinLen * 0.94]} />
        <meshStandardMaterial color={glassColor} metalness={0.9} roughness={0.08} />
      </mesh>
      {/* акцентная полоса по борту */}
      <mesh position={[0, bodyY + bodyH * 0.1, 0]}>
        <boxGeometry args={[W * 1.01, Math.max(0.04, H * 0.05), L * 0.86]} />
        <meshStandardMaterial color={spec.accent} emissive={spec.accent} emissiveIntensity={0.25} roughness={0.4} />
      </mesh>
      {/* фары (нос, +Z) */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`hl${x}`} position={[x * W * 0.72, bodyY + bodyH * 0.34, noseZ + 0.02]}>
          <boxGeometry args={[W * 0.2, H * 0.09, 0.07]} />
          <meshStandardMaterial color="#fff6d5" emissive="#ffe9a8" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {/* стопы (корма, -Z) */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`tl${x}`} position={[x * W * 0.72, bodyY + bodyH * 0.34, tailZ - 0.02]}>
          <boxGeometry args={[W * 0.2, H * 0.08, 0.07]} />
          <meshStandardMaterial color="#ff3b30" emissive="#ff1a10" emissiveIntensity={1.3} />
        </mesh>
      ))}
      {/* антикрыло / спойлер */}
      {spec.spoiler === "lip" && (
        <mesh position={[0, bodyY + bodyH * 0.52, tailZ + L * 0.04]} castShadow>
          <boxGeometry args={[W * 0.8, H * 0.05, L * 0.12]} />
          <meshStandardMaterial color={spec.color} metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      {spec.spoiler !== "lip" && spec.spoiler !== "none" && (
        <group position={[0, bodyY + bodyH * 0.5, tailZ + L * 0.02]}>
          <mesh position={[0, H * 0.16, 0]} castShadow>
            <boxGeometry args={[W * (spec.spoiler === "big" ? 0.98 : 0.82), H * 0.045, L * 0.13]} />
            <meshStandardMaterial color={spec.color} metalness={0.7} roughness={0.3} />
          </mesh>
          {[-0.32, 0.32].map((x) => (
            <mesh key={`sup${x}`} position={[x * W, H * 0.08, 0]}>
              <boxGeometry args={[W * 0.05, H * 0.16, L * 0.06]} />
              <meshStandardMaterial color={spec.trim} metalness={0.8} roughness={0.35} />
            </mesh>
          ))}
        </group>
      )}
      {/* полосы маслкара */}
      {spec.extras.stripes &&
        [-0.16, 0.16].map((x) => (
          <mesh key={`stripe${x}`} position={[x * W, ride + bodyH + 0.01, 0]}>
            <boxGeometry args={[W * 0.1, 0.02, L * 0.94]} />
            <meshStandardMaterial color={spec.accent} roughness={0.45} />
          </mesh>
        ))}
      {/* кенгурятник у G-класса */}
      {spec.extras.bullBar && (
        <group position={[0, ride + bodyH * 0.2, noseZ + 0.08]}>
          <mesh>
            <boxGeometry args={[W * 0.9, H * 0.04, 0.06]} />
            <meshStandardMaterial color={spec.trim} metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh>
            <boxGeometry args={[W * 0.9, H * 0.04, 0.06]} />
            <meshStandardMaterial color={spec.trim} metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      )}
      {/* багажник на крыше и балка света */}
      {spec.extras.roofRack &&
        [-0.34, 0.34].map((x) => (
          <mesh key={`rail${x}`} position={[x * W, cabinY + cabinH * 0.52, cabinZ]}>
            <boxGeometry args={[W * 0.06, H * 0.04, cabinLen * 0.92]} />
            <meshStandardMaterial color={spec.trim} metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      {spec.extras.lightBar && (
        <mesh position={[0, cabinY + cabinH * 0.6, cabinZ + cabinLen * 0.4]}>
          <boxGeometry args={[W * 0.6, H * 0.05, 0.08]} />
          <meshStandardMaterial color="#fffbe8" emissive="#fff2b0" emissiveIntensity={1.4} />
        </mesh>
      )}
      {/* подсветка днища у WERT Edition */}
      {spec.extras.underglow && (
        <mesh position={[0, ride * 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 1.1, L * 0.9]} />
          <meshBasicMaterial color={spec.accent} transparent opacity={0.35} />
        </mesh>
      )}
      {/* выхлоп */}
      {[-0.34, 0.34].map((x) => (
        <mesh key={`ex${x}`} position={[x * W, ride + bodyH * 0.1, tailZ - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
          <meshStandardMaterial color={spec.trim} metalness={0.95} roughness={0.25} />
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
