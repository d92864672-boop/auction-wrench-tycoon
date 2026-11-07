import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { newDrive, stepDrive, type Controls, type DriveMode } from "@/game/drive-physics";

function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (key: string) => css.getPropertyValue(`--drive-${key}`).trim();
  return { sky: read("sky"), asphalt: read("asphalt"), line: read("line"), grass: read("grass"), building: read("building"), window: read("window"), sun: read("sun") };
}
type SceneProps = { ctl: RefObject<Controls>; modeRef: RefObject<DriveMode>; speedRef: RefObject<HTMLSpanElement | null>; slipRef: RefObject<HTMLSpanElement | null>; resetRef: RefObject<boolean> };

const WHEEL_NAMES = ["wheel-front-left", "wheel-front-right", "wheel-back-left", "wheel-back-right"] as const;
const WHEELS: { name: (typeof WHEEL_NAMES)[number]; position: [number, number, number] }[] = [
  { name: "wheel-front-left", position: [-0.92, 0.5, -1.35] },
  { name: "wheel-front-right", position: [0.92, 0.5, -1.35] },
  { name: "wheel-back-left", position: [-0.92, 0.5, 1.4] },
  { name: "wheel-back-right", position: [0.92, 0.5, 1.4] },
];

/** Колесо: покрышка + диск + спица, чтобы вращение было видно. */
function Wheel({ name, position }: { name: string; position: [number, number, number] }) {
  return (
    <group name={name} position={position}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 0.34, 24]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.9} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.29, 0.29, 0.36, 20]} />
        <meshStandardMaterial color="#c7ccd6" metalness={0.95} roughness={0.22} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[(i * Math.PI) / 3, 0, Math.PI / 2]} position={[0, 0, 0]}>
          <boxGeometry args={[0.06, 0.52, 0.36]} />
          <meshStandardMaterial color="#8b929f" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Машина собрана из примитивов прямо в сцене: никаких внешних .glb,
 * поэтому «Покатушки» запускаются сразу и не зависят от загрузки ассетов.
 */
function Vehicle({ ctl, modeRef, speedRef, slipRef, resetRef }: SceneProps) {
  const g = useRef<THREE.Group>(null);
  const s = useRef(newDrive());
  const ready = useRef(false);
  const wheels = useRef<THREE.Object3D[]>([]);
  const behind = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    wheels.current = WHEEL_NAMES.map((n) => g.current?.getObjectByName(n)).filter((o): o is THREE.Object3D => Boolean(o));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = { get state() { return { ...s.current, mode: modeRef.current }; }, sim(seconds: number) {
      for (let i = 0; i < Math.min(seconds, 60) * 60; i++) s.current = stepDrive(s.current, ctl.current, modeRef.current, 1 / 60);
      return { ...s.current };
    } };
    Object.assign(window, { __drive: debug });
    return () => { Reflect.deleteProperty(window, "__drive"); };
  }, [ctl, modeRef]);

  useFrame(({ camera, gl }, delta) => {
    const car = g.current;
    if (!car) return;
    if (resetRef.current) { s.current = newDrive(); resetRef.current = false; }
    const dt = Math.min(delta, 0.05);
    s.current = stepDrive(s.current, ctl.current, modeRef.current, dt);
    const v = s.current;
    car.position.set(v.x, 0, v.z); car.rotation.y = v.yaw;
    for (const wheel of wheels.current) {
      wheel.rotation.x += (v.speed * dt) / 0.5;
      if (wheel.name.includes("front")) wheel.rotation.y = (Number(ctl.current.right) - Number(ctl.current.left)) * 0.35;
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

  return (
    <group ref={g}>
      {/* кузов */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.56, 4.2]} />
        <meshStandardMaterial color="#17171b" metalness={0.72} roughness={0.3} />
      </mesh>
      {/* капот и корма чуть ниже — силуэт купе */}
      <mesh position={[0, 0.92, -1.05]} castShadow>
        <boxGeometry args={[1.7, 0.24, 1.7]} />
        <meshStandardMaterial color="#1d1d22" metalness={0.7} roughness={0.34} />
      </mesh>
      {/* кабина */}
      <mesh position={[0, 1.12, 0.25]} castShadow>
        <boxGeometry args={[1.56, 0.44, 1.9]} />
        <meshStandardMaterial color="#202026" metalness={0.6} roughness={0.38} />
      </mesh>
      {/* стёкла */}
      <mesh position={[0, 1.16, 0.25]}>
        <boxGeometry args={[1.6, 0.3, 1.7]} />
        <meshStandardMaterial color="#0b1a24" metalness={0.9} roughness={0.08} />
      </mesh>
      {/* красная полоса по борту */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.9, 0.1, 3.4]} />
        <meshStandardMaterial color="#d81f2a" emissive="#5c0006" emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
      {/* фары */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={`hl${x}`} position={[x, 0.72, -2.08]}>
          <boxGeometry args={[0.44, 0.16, 0.08]} />
          <meshStandardMaterial color="#fff6d5" emissive="#ffe9a8" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {/* стопы */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`tl${x}`} position={[x, 0.76, 2.08]}>
          <boxGeometry args={[0.42, 0.14, 0.08]} />
          <meshStandardMaterial color="#ff3b30" emissive="#ff1a10" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {/* антикрыло */}
      <mesh position={[0, 1.06, 1.92]} castShadow>
        <boxGeometry args={[1.5, 0.07, 0.42]} />
        <meshStandardMaterial color="#101014" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* выхлоп */}
      {[-0.35, 0.35].map((x) => (
        <mesh key={`ex${x}`} position={[x, 0.36, 2.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.2, 12]} />
          <meshStandardMaterial color="#4a4f57" metalness={0.95} roughness={0.25} />
        </mesh>
      ))}
      {WHEELS.map((w) => (
        <Wheel key={w.name} name={w.name} position={w.position} />
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
