import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import type { Car } from "@/game/engine";
import type { Controls } from "./drive-scene";
import { Empty, Tile } from "./ui";

const DriveScene = lazy(() => import("./drive-scene"));
const COLORS = ["#c0392b", "#2c6fbb", "#e0e0e0", "#222", "#d4a017", "#2e8b57"];

export function DriveApp() {
  const { state } = useGame();
  const [car, setCar] = useState<Car | null>(null);
  if (!car)
    return (
      <div className="space-y-2">
        {state.garage.length === 0 && <Empty>В гараже нет машин — купи в Перекупе</Empty>}
        {state.garage.map((c) => (
          <Tile key={c.id} className="flex items-center justify-between">
            <span>{c.name} {c.year}</span>
            <Button size="sm" onClick={() => setCar(c)}>Кататься</Button>
          </Tile>
        ))}
      </div>
    );
  const color = COLORS[[...car.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]!;
  return <Drive car={car} color={color} exit={() => setCar(null)} />;
}

function Drive({ car, color, exit }: { car: Car; color: string; exit: () => void }) {
  const ctl = useRef<Controls>({ up: false, down: false, left: false, right: false });
  const speedRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const map: Record<string, keyof Controls> = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
    const h = (on: boolean) => (e: KeyboardEvent) => { const k = map[e.code]; if (k) ctl.current[k] = on; };
    const dn = h(true), up = h(false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);
  const pad = (k: keyof Controls, label: string) => (
    <button
      className="h-16 w-16 rounded-full bg-background/60 text-2xl font-bold backdrop-blur select-none touch-none"
      onPointerDown={() => (ctl.current[k] = true)}
      onPointerUp={() => (ctl.current[k] = false)}
      onPointerLeave={() => (ctl.current[k] = false)}
      onPointerCancel={() => (ctl.current[k] = false)}
    >{label}</button>
  );
  return (
    <div className="relative h-[70vh] overflow-hidden rounded-xl">
      <ClientOnly fallback={<Empty>Загрузка…</Empty>}>
        <Suspense fallback={<Empty>Загрузка…</Empty>}>
          <DriveScene ctl={ctl} color={color} speedRef={speedRef} />
        </Suspense>
      </ClientOnly>
      <div className="absolute left-2 top-2 rounded bg-background/70 px-2 py-1 text-sm">{car.name} · <span ref={speedRef}>0 км/ч</span></div>
      <Button size="sm" variant="secondary" className="absolute right-2 top-2" onClick={exit}>Выйти</Button>
      <div className="absolute bottom-3 left-3 flex gap-2">{pad("left", "◀")}{pad("right", "▶")}</div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">{pad("up", "▲")}{pad("down", "▼")}</div>
    </div>
  );
}
