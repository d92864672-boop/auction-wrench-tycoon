import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import carAsset from "@/assets/models/drive-car.glb.asset.json";
import { newDrive, stepDrive, type Controls, type DriveMode } from "@/game/drive-physics";

function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (key: string) => css.getPropertyValue(`--drive-${key}`).trim();
  return { sky: read("sky"), asphalt: read("asphalt"), line: read("line"), grass: read("grass"), building: read("building"), window: read("window"), sun: read("sun") };
}
type SceneProps = { ctl: RefObject<Controls>; modeRef: RefObject<DriveMode>; speedRef: RefObject<HTMLSpanElement | null>; slipRef: RefObject<HTMLSpanElement | null>; resetRef: RefObject<boolean> };
function Vehicle({ ctl, modeRef, speedRef, slipRef, resetRef }: SceneProps) {
  const { scene } = useGLTF(carAsset.url);
  const g = useRef<THREE.Group>(null);
  const s = useRef(newDrive());
  const ready = useRef(false);
  const behind = useMemo(() => new THREE.Vector3(), []);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(clone), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const scale = 4.2 / size.z;
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
  const wheels = useMemo(() => ["wheel-front-left", "wheel-front-right", "wheel-back-left", "wheel-back-right"].map(n => model.getObjectByName(n)).filter((n): n is THREE.Object3D => !!n), [model]);
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
    for (const wheel of wheels) {
      wheel.rotation.x += v.speed * dt / 0.5;
      if (wheel.name.includes("front")) wheel.rotation.y = (Number(ctl.current.right) - Number(ctl.current.left)) * 0.35;
    }
    behind.set(v.x - Math.sin(v.yaw) * 9, 4.6, v.z - Math.cos(v.yaw) * 9);
    camera.position.lerp(behind, 1 - Math.exp(-6 * dt));
    camera.lookAt(v.x + Math.sin(v.yaw) * 3, 1.1, v.z + Math.cos(v.yaw) * 3);
    if (speedRef.current) speedRef.current.textContent = String(Math.round(v.speed * 3.6));
    if (slipRef.current) slipRef.current.textContent = v.slip > 0.12 ? `ДРИФТ · ${Math.round(v.slip * 180 / Math.PI)}°` : "Сцепление";
    // This callback runs before rendering: mark ready on the following loaded-model frame.
    if (ready.current) gl.domElement.dataset['sceneReady'] = "1";
    ready.current = true;
  });
  return <group ref={g}><primitive object={model} /></group>;
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
