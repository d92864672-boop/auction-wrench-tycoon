import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import {
  IMPORT_SECONDS,
  ROLLBACK_COST,
  buyGreyCar,
  carValue,
  clearCustoms,
  customsDuty,
  fmt,
  orderImport,
  rollbackMileage,
  sellToFence,
} from "@/game/engine";
import { Empty, Progress, Section, Tile } from "./ui";

export function BlackMarketApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-4">
      <Tile className="icon-dark border-0">
        <p className="font-semibold">🕶 Чёрный рынок</p>
        <p className="text-xs opacity-80">Дёшево и быстро, но можно попасть на полицию.</p>
      </Tile>
      <Section title="1. Серые машины">
        <Tile className="space-y-2">
          <p className="text-sm text-muted-foreground">Машина за 50% цены. Шанс 25%, что её изымет полиция.</p>
          <Button className="w-full" onClick={() => act((s) => buyGreyCar(s))}>Взять случайную тачку</Button>
        </Tile>
      </Section>
      <Section title="2. Скупщик · 3. Скрутка пробега">
        {state.garage.length === 0 && <Empty>В гараже нет машин</Empty>}
        {state.garage.map((c) => (
          <Tile key={c.id} className="space-y-2">
            <p className="font-semibold">{c.name} · {c.mileage.toLocaleString("ru-RU")} км</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => act((s) => sellToFence(s, c.id))}>Скупщику {fmt(carValue(c))}</Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => act((s) => rollbackMileage(s, c.id))}>Скрутить · {fmt(ROLLBACK_COST)}</Button>
            </div>
          </Tile>
        ))}
        <p className="text-center text-[11px] text-muted-foreground">Скупщик: 15% шанс штрафа. Скрутка: 20% шанс штрафа 100 000 ₽.</p>
      </Section>
    </div>
  );
}

const ORIGINS = [
  { id: "jp", name: "🇯🇵 Япония" },
  { id: "eu", name: "🇪🇺 Европа" },
  { id: "us", name: "🇺🇸 США" },
] as const;

export function ImportApp() {
  const { state, act } = useGame();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const orders = state.imports ?? [];
  return (
    <div className="space-y-4">
      <Section title="1. Заказать авто из-за границы">
        <p className="text-xs text-muted-foreground">Свежая машина за 70% цены, едет {IMPORT_SECONDS} секунд.</p>
        <div className="grid grid-cols-3 gap-2">
          {ORIGINS.map((o) => (
            <Button key={o.id} variant="secondary" className="h-auto py-3 text-xs" onClick={() => act((s) => orderImport(s, o.id))}>{o.name}</Button>
          ))}
        </div>
      </Section>
      <Section title="2. Отслеживание · 3. Растаможка">
        {orders.length === 0 && <Empty>Заказов пока нет</Empty>}
        {orders.map((o) => {
          const left = Math.max(0, o.endAt - now);
          return (
            <Tile key={o.id} className="space-y-2">
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{o.car.name} · {o.car.year}</p>
                <p className="text-xs text-muted-foreground">{fmt(o.price)}</p>
              </div>
              <Progress value={100 - (left / (IMPORT_SECONDS * 1000)) * 100} />
              <p className="text-xs text-muted-foreground">{left > 0 ? `🚢 В пути, осталось ${Math.ceil(left / 1000)} с` : "✅ Прибыла на таможню"}</p>
              <Button size="sm" className={left > 0 ? "w-full" : "shimmer w-full"} disabled={left > 0} onClick={() => act((s) => clearCustoms(s, o.id))}>
                Растаможить · {fmt(customsDuty(o))}
              </Button>
            </Tile>
          );
        })}
      </Section>
    </div>
  );
}
