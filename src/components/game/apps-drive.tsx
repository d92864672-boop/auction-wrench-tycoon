import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import type { Car } from "@/game/engine";
import { clearControls, DRIVE_MODES, KEY_CONTROLS, type Controls, type DriveMode } from "@/game/drive-physics";
import { driveSpec } from "@/game/drive-cars";
import { Empty, Tile } from "./ui";

const DriveScene = lazy(() => import("./drive-scene"));

// Бесплатная машина для тест-драйва: «Покатушки» должны работать сразу,
// даже если гараж пуст и игрок ещё ничего не купил.
const DEMO_CAR: Car = {
  id: "demo-drive",
  modelId: "demo-drive",
  name: "Тестовая тачка",
  year: 1998,
  mileage: 250000,
  condition: 70,
};

export function DriveApp() {
  const { state } = useGame();
  const [car, setCar] = useState<Car | null>(null);
  const [mode, setMode] = useState<DriveMode>("rwd");
  if (car) return <Drive car={car} mode={mode} setMode={setMode} exit={() => setCar(null)} />;
  return (
    <div className="space-y-3">
      <DriveSelector mode={mode} setMode={setMode} />
      {state.garage.length === 0 && <Empty>Гараж пуст — катайся на тестовой машине или купи свою в Перекупе</Empty>}
      {state.garage.length === 0 && (
        <Tile className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-sm">{DEMO_CAR.name} {DEMO_CAR.year}
            <span className="block text-xs text-muted-foreground">макс. {driveSpec(DEMO_CAR.modelId).topSpeedKmh} км/ч</span>
          </span>
          <Button size="sm" onClick={() => setCar(DEMO_CAR)}>Кататься</Button>
        </Tile>
      )}
      {state.garage.map((c) => (
        <Tile key={c.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-sm">{c.name} {c.year}
            <span className="block text-xs text-muted-foreground">макс. {driveSpec(c.modelId).topSpeedKmh} км/ч</span>
          </span>
          <Button size="sm" disabled={!!c.inService} onClick={() => setCar(c)}>{c.inService ? "В ремонте" : "Кататься"}</Button>
        </Tile>
      ))}
    </div>
  );
}
function DriveSelector({ mode, setMode }: { mode: DriveMode; setMode: (m: DriveMode) => void }) {
  return <div className="grid grid-cols-3 gap-1" aria-label="Привод">{DRIVE_MODES.map(m =>
    <Button key={m.id} size="sm" className="px-1 text-xs" variant={mode === m.id ? "default" : "secondary"} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</Button>
  )}</div>;
}
function Drive({ car, mode, setMode, exit }: { car: Car; mode: DriveMode; setMode: (m: DriveMode) => void; exit: () => void }) {
  const ctl = useRef<Controls>(clearControls());
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const speedRef = useRef<HTMLSpanElement>(null);
  const slipRef = useRef<HTMLSpanElement>(null);
  const resetRef = useRef(false);
  useEffect(() => {
    const handle = (on: boolean) => (e: KeyboardEvent) => {
      const key = KEY_CONTROLS[e.code];
      if (!key || (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) return;
      e.preventDefault(); ctl.current[key] = on;
    };
    const down = handle(true), up = handle(false);
    const clear = () => { ctl.current = clearControls(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); clear(); };
  }, []);
  const pad = (key: keyof Controls, label: string, icon: React.ReactNode) => (
    <Button variant="secondary" aria-label={label} title={key === "drift" ? "Ручник / дрифт · Пробел" : label}
      className="h-16 w-16 touch-none select-none rounded-full bg-background/80 p-0 text-xs backdrop-blur active:bg-primary"
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); ctl.current[key] = true; }}
      onPointerUp={() => { ctl.current[key] = false; }} onPointerCancel={() => { ctl.current[key] = false; }} onLostPointerCapture={() => { ctl.current[key] = false; }}
    >{icon}</Button>
  );
  return createPortal(
    <div className="fixed inset-0 z-50 bg-background">
      <ClientOnly fallback={<Empty>Загрузка…</Empty>}><Suspense fallback={<Empty>Загрузка…</Empty>}>
        <DriveScene car={car} ctl={ctl} modeRef={modeRef} speedRef={speedRef} slipRef={slipRef} resetRef={resetRef} />
      </Suspense></ClientOnly>
      <div className="absolute inset-x-3 top-3 mx-auto max-w-lg space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 rounded-lg bg-background/80 px-3 py-2 backdrop-blur">
            <p className="truncate text-xs">{car.name} · {car.year}</p>
            <p className="text-xs text-muted-foreground">макс. {driveSpec(car.modelId).topSpeedKmh} км/ч</p>
            <p className="font-display text-2xl tabular-nums"><span ref={speedRef}>0</span><span className="ml-2 text-xs text-muted-foreground">км/ч</span></p>
            <span ref={slipRef} className="text-xs text-warning">Сцепление</span>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="secondary" aria-label="На старт" title="На старт" onClick={() => { resetRef.current = true; ctl.current = clearControls(); }}><RotateCcw className="h-4 w-4" /></Button>
            <Button size="icon" variant="secondary" aria-label="Выйти" title="Выйти" onClick={exit}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <DriveSelector mode={mode} setMode={setMode} />
      </div>
      <div className="absolute bottom-6 left-3 flex gap-2">{pad("left", "Влево", <ArrowLeft />)}{pad("right", "Вправо", <ArrowRight />)}</div>
      <div className="absolute bottom-6 right-3 flex items-end gap-2">
        {pad("drift", "Дрифт", "ДРИФТ")}
        <div className="flex flex-col gap-2">{pad("up", "Газ", <ArrowUp />)}{pad("down", "Тормоз / задний ход", <ArrowDown />)}</div>
      </div>
    </div>, document.body
  );
}
