import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Controls = { up: boolean; down: boolean; left: boolean; right: boolean };

const ACCEL = 14, DRAG = 0.8, TURN = 2.2, MAX = 40;

function Car({ ctl, color, speedRef }: { ctl: React.RefObject<Controls>; color: string; speedRef: React.RefObject<HTMLSpanElement | null> }) {
  const g = useRef<THREE.Group>(null);
  const v = useRef({ speed: 0, yaw: 0 });
  useFrame(({ camera }, d) => {
    const dt = Math.min(d, 0.05), c = ctl.current, s = v.current, car = g.current;
    if (!car) return;
    if (c.up) s.speed += ACCEL * dt;
    if (c.down) s.speed -= ACCEL * 1.5 * dt;
    s.speed = THREE.MathUtils.clamp(s.speed * Math.exp(-DRAG * dt), -10, MAX);
    const steer = (c.left ? 1 : 0) - (c.right ? 1 : 0);
    s.yaw += steer * TURN * dt * Math.min(1, Math.abs(s.speed) / 5) * Math.sign(s.speed || 1);
    car.rotation.y = s.yaw;
    car.position.x = THREE.MathUtils.clamp(car.position.x + Math.sin(s.yaw) * s.speed * dt, -190, 190);
    car.position.z = THREE.MathUtils.clamp(car.position.z + Math.cos(s.yaw) * s.speed * dt, -190, 190);
    const back = new THREE.Vector3(-Math.sin(s.yaw) * 9, 4, -Math.cos(s.yaw) * 9).add(car.position);
    camera.position.lerp(back, 1 - Math.exp(-5 * dt));
    camera.lookAt(car.position.x, 1, car.position.z);
    if (speedRef.current) speedRef.current.textContent = `${Math.round(Math.abs(s.speed) * 3.6)} км/ч`;
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[1.9, 0.6, 4.2]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, 1.15, -0.3]} castShadow><boxGeometry args={[1.6, 0.5, 2]} /><meshStandardMaterial color="#1b2430" metalness={0.8} roughness={0.1} /></mesh>
      {([[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.35, 0.35, 0.3, 16]} /><meshStandardMaterial color="#111" /></mesh>
      ))}
      <mesh position={[0, 0.65, 2.11]}><boxGeometry args={[1.5, 0.15, 0.02]} /><meshStandardMaterial color="#fff6c0" emissive="#fff6c0" emissiveIntensity={1} /></mesh>
    </group>
  );
}

function City() {
  const blocks = useMemo(() => {
    const out: { x: number; z: number; h: number; c: string }[] = [];
    const cols = ["#8a93a6", "#b9a68a", "#6f8a7a", "#a77", "#9aa"];
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      if (i === 0 || j === 0) continue;
      const h = 4 + ((i * 7 + j * 13 + 100) % 9) * 2;
      out.push({ x: i * 40, z: j * 40, h, c: cols[(i + j + 20) % cols.length]! });
    }
    return out;
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#3b3f45" /></mesh>
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, 0.1, 0]}><boxGeometry args={[26, 0.2, 26]} /><meshStandardMaterial color="#4f7a3c" /></mesh>
          <mesh position={[0, b.h / 2, 0]} castShadow><boxGeometry args={[16, b.h, 16]} /><meshStandardMaterial color={b.c} /></mesh>
        </group>
      ))}
    </>
  );
}

export default function DriveScene({ ctl, color, speedRef }: { ctl: React.RefObject<Controls>; color: string; speedRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <Canvas shadows camera={{ position: [0, 4, -9], fov: 60 }} data-scene-ready>
      <color attach="background" args={["#9cc7ea"]} />
      <fog attach="fog" args={["#9cc7ea", 60, 200]} />
      <hemisphereLight args={["#ffffff", "#556", 0.9]} />
      <directionalLight position={[30, 50, 20]} intensity={1.6} castShadow />
      <City />
      <Car ctl={ctl} color={color} speedRef={speedRef} />
    </Canvas>
  );
}
