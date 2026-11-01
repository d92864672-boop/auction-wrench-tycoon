import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import {
  CURRENT_YEAR,
  buyListing,
  carValue,
  cityOf,
  fmt,
  garageCapacity,
  generateListings,
  modelOf,
  newPlateOffers,
  repairCar,
  repairCost,
  saleOffer,
  sellCar,
  type Car,
} from "@/game/engine";
import { CAR_MODELS, plateValue } from "@/game/data";
import { Empty, Progress, Section, Stat, Tile } from "./ui";

function CarInfo({ car }: { car: Car }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold">{car.name}</p>
      <p className="text-xs text-muted-foreground">
        {car.year} г. · {car.mileage.toLocaleString("ru-RU")} км{car.plate ? ` · ${car.plate}` : ""}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1">
          <Progress value={car.condition} />
        </div>
        <span className="text-[11px] text-muted-foreground">{car.condition}%</span>
      </div>
    </div>
  );
}

export function PerekupApp() {
  const { state, act, set } = useGame();
  const [haggle, setHaggle] = useState<Record<string, number>>({});
  const cap = garageCapacity(state);

  const refresh = () =>
    act((s) => (s.money < 5_000 ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - 5_000, listings: generateListings(s) }, message: "Объявления обновлены" }));

  const tryHaggle = (car: Car) => {
    if (haggle[car.id] !== undefined) return;
    const ok = Math.random() < 0.5;
    setHaggle((h) => ({ ...h, [car.id]: ok ? 1.08 : 0.92 }));
    toast(ok ? "Покупатель согласился на +8%" : "Покупатель обиделся: −8%");
  };

  return (
    <Tabs defaultValue="market">
      <TabsList className="w-full">
        <TabsTrigger value="market" className="flex-1">Объявления</TabsTrigger>
        <TabsTrigger value="garage" className="flex-1">Гараж {state.garage.length}/{cap}</TabsTrigger>
      </TabsList>
      <TabsContent value="market" className="mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Город: {cityOf(state).name}</p>
          <Button size="sm" variant="secondary" onClick={refresh}>Обновить · 5 000 ₽</Button>
        </div>
        {state.listings.length === 0 && <Empty>Объявлений нет — обнови список или подожди новый день</Empty>}
        {state.listings.map((l) => {
          const v = carValue(l);
          const deal = (v - l.price) / v;
          return (
            <Tile key={l.id}>
              <CarInfo car={l} />
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold">{fmt(l.price)}</p>
                  <p className={deal > 0.1 ? "text-xs text-success" : deal < -0.05 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    Оценка {fmt(v)} {deal > 0.1 ? "· Выгодно" : deal < -0.05 ? "· Дорого" : ""}
                    {modelOf(l.modelId).rare ? " · Редкая" : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => act((s) => buyListing(s, l.id))}>Купить</Button>
              </div>
            </Tile>
          );
        })}
      </TabsContent>
      <TabsContent value="garage" className="mt-3 space-y-3">
        {state.garage.length === 0 && <Empty>Гараж пуст. Купи первую машину в объявлениях.</Empty>}
        {state.garage.map((c) => {
          const offer = Math.round(saleOffer(state, c) * (haggle[c.id] ?? 1));
          const profit = offer - (c.boughtFor ?? 0);
          return (
            <Tile key={c.id}>
              <CarInfo car={c} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <p className="text-muted-foreground">Куплена: {fmt(c.boughtFor ?? 0)}</p>
                <p className={profit >= 0 ? "text-right text-success" : "text-right text-destructive"}>
                  {profit >= 0 ? "+" : ""}{fmt(profit)}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => act((s) => sellCar(s, c.id, offer))}>Продать {fmt(offer)}</Button>
                <Button size="sm" variant="secondary" disabled={haggle[c.id] !== undefined} onClick={() => tryHaggle(c)}>Торг</Button>
                {c.plate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set((s) => ({
                        ...s,
                        plates: [...s.plates, c.plate!],
                        garage: s.garage.map((x) => (x.id === c.id ? { ...x, plate: undefined } : x)),
                      }))
                    }
                  >
                    Снять номер
                  </Button>
                )}
              </div>
            </Tile>
          );
        })}
      </TabsContent>
    </Tabs>
  );
}

export function RepairApp() {
  const { state, act } = useGame();
  const broken = state.garage.filter((c) => c.condition < 100);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">После ремонта машина стоит дороже. Улучшение «Свой механик» снижает цену.</p>
      {broken.length === 0 && <Empty>Все машины в идеальном состоянии</Empty>}
      {broken.map((c) => {
        const after = carValue({ ...c, condition: 100 }) - carValue(c);
        return (
          <Tile key={c.id}>
            <CarInfo car={c} />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-success">Стоимость вырастет на {fmt(after)}</p>
              <Button size="sm" onClick={() => act((s) => repairCar(s, c.id))}>Ремонт {fmt(repairCost(state, c))}</Button>
            </div>
          </Tile>
        );
      })}
    </div>
  );
}

type Lot = { car: Car; bid: number; leader: "you" | "bot"; endsAt: number; botMax: number };

function newLot(): Lot {
  const rares = CAR_MODELS.filter((m) => m.rare && m.id !== "wert");
  const m = rares[Math.floor(Math.random() * rares.length)];
  const car: Car = {
    id: Math.random().toString(36).slice(2),
    modelId: m.id,
    name: m.name,
    year: 1990 + Math.floor(Math.random() * (CURRENT_YEAR - 1990)),
    mileage: Math.round(Math.random() * 120) * 1000,
    condition: 55 + Math.floor(Math.random() * 45),
  };
  const v = carValue(car);
  return { car, bid: Math.round(v * 0.45), leader: "bot", endsAt: Date.now() + 30_000, botMax: Math.round(v * (0.75 + Math.random() * 0.35)) };
}

export function AuctionApp() {
  const { state, act } = useGame();
  const [lot, setLot] = useState<Lot>(() => newLot());
  const [now, setNow] = useState(Date.now());
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setLot((l) => {
        if (Date.now() >= l.endsAt) return l;
        if (l.leader === "you" && l.bid < l.botMax && Math.random() < 0.35) {
          const bid = Math.min(l.botMax, Math.round(l.bid * 1.05));
          return { ...l, bid, leader: "bot", endsAt: Math.max(l.endsAt, Date.now() + 8_000) };
        }
        return l;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((lot.endsAt - now) / 1000));

  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    if (lot.leader === "you") {
      act((s) => {
        if (s.money < lot.bid) return { state: s, error: "Не хватило денег — лот ушёл другому" };
        if (s.garage.length >= garageCapacity(s)) return { state: s, error: "Гараж заполнен — лот ушёл другому" };
        return {
          state: { ...s, money: s.money - lot.bid, garage: [...s.garage, { ...lot.car, boughtFor: lot.bid }], stats: { ...s.stats, carsBought: s.stats.carsBought + 1 } },
          message: `Вы выиграли аукцион: ${lot.car.name}`,
        };
      });
    } else toast("Лот забрал другой участник");
  }, [left, lot, act]);

  const bid = () => {
    const next = Math.round(lot.bid * 1.05);
    if (state.money < next) return toast.error("Не хватает денег на ставку");
    setLot((l) => ({ ...l, bid: next, leader: "you", endsAt: Math.max(l.endsAt, Date.now() + 8_000) }));
  };

  return (
    <div className="space-y-3">
      <Tile>
        <p className="text-xs uppercase tracking-wider text-warning">Редкий лот</p>
        <div className="mt-1">
          <CarInfo car={lot.car} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Рыночная оценка: {fmt(carValue(lot.car))}</p>
      </Tile>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Текущая ставка" value={fmt(lot.bid)} />
        <Stat label="До конца" value={`${left} с`} tone={left < 8 ? "bad" : undefined} />
      </div>
      <p className="text-center text-sm">{lot.leader === "you" ? "Вы лидируете" : "Лидирует другой участник"}</p>
      {left > 0 ? (
        <Button className="w-full" size="lg" onClick={bid} disabled={lot.leader === "you"}>
          Поднять до {fmt(Math.round(lot.bid * 1.05))}
        </Button>
      ) : (
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={() => {
            done.current = false;
            setLot(newLot());
          }}
        >
          Следующий лот
        </Button>
      )}
    </div>
  );
}

export function PlatesApp() {
  const { state, act } = useGame();
  const [offers, setOffers] = useState(() => newPlateOffers());
  const [target, setTarget] = useState<string | null>(null);
  return (
    <Tabs defaultValue="buy">
      <TabsList className="w-full">
        <TabsTrigger value="buy" className="flex-1">Купить</TabsTrigger>
        <TabsTrigger value="mine" className="flex-1">Мои номера {state.plates.length}</TabsTrigger>
      </TabsList>
      <TabsContent value="buy" className="mt-3 space-y-2">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => setOffers(newPlateOffers())}>Показать другие</Button>
        {offers.map((o) => (
          <Tile key={o.plate} className="flex items-center justify-between">
            <span className="rounded-md border-2 border-foreground px-2 py-0.5 font-display text-sm tracking-widest">{o.plate}</span>
            <Button
              size="sm"
              onClick={() =>
                act((s) => {
                  if (s.money < o.price) return { state: s, error: "Не хватает денег" };
                  setOffers((x) => x.filter((p) => p.plate !== o.plate));
                  return { state: { ...s, money: s.money - o.price, plates: [...s.plates, o.plate] }, message: `Номер ${o.plate} куплен` };
                })
              }
            >
              {fmt(o.price)}
            </Button>
          </Tile>
        ))}
      </TabsContent>
      <TabsContent value="mine" className="mt-3 space-y-2">
        {state.plates.length === 0 && <Empty>Красивые номера — отличный актив и +к цене машины</Empty>}
        {state.plates.map((p) => (
          <Tile key={p}>
            <div className="flex items-center justify-between">
              <span className="rounded-md border-2 border-foreground px-2 py-0.5 font-display text-sm tracking-widest">{p}</span>
              <span className="text-sm text-muted-foreground">{fmt(plateValue(p))}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  act((s) => ({
                    state: { ...s, money: s.money + Math.round(plateValue(p) * 0.85), plates: s.plates.filter((x) => x !== p) },
                    message: `Продан за ${fmt(Math.round(plateValue(p) * 0.85))}`,
                  }))
                }
              >
                Продать
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setTarget(target === p ? null : p)}>На машину</Button>
            </div>
            {target === p && (
              <div className="mt-2 space-y-1">
                {state.garage.length === 0 && <p className="text-xs text-muted-foreground">Нет машин в гараже</p>}
                {state.garage.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      act((s) => ({
                        state: {
                          ...s,
                          plates: [...s.plates.filter((x) => x !== p), ...(c.plate ? [c.plate] : [])],
                          garage: s.garage.map((x) => (x.id === c.id ? { ...x, plate: p } : x)),
                        },
                        message: `${p} установлен на ${c.name}`,
                      }));
                      setTarget(null);
                    }}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
          </Tile>
        ))}
      </TabsContent>
    </Tabs>
  );
}

export function GosApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-4">
      <Section title="Водительские права">
        <Tile className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{state.license ? "Права категории B, C" : "Прав нет"}</p>
            <p className="text-xs text-muted-foreground">Нужны для дальних доставок</p>
          </div>
          {!state.license && (
            <Button
              size="sm"
              onClick={() =>
                act((s) => (s.money < 30_000 ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - 30_000, license: true }, message: "Права получены" }))
              }
            >
              30 000 ₽
            </Button>
          )}
        </Tile>
      </Section>
      <Section title="Налоги">
        <Tile className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{fmt(state.taxDue)}</p>
            <p className="text-xs text-muted-foreground">4% с дохода бизнеса и аренды. Пени +3% в день</p>
          </div>
          <Button
            size="sm"
            disabled={state.taxDue <= 0}
            onClick={() =>
              act((s) => (s.money < s.taxDue ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - s.taxDue, taxDue: 0 }, message: "Налоги оплачены" }))
            }
          >
            Оплатить
          </Button>
        </Tile>
      </Section>
      <Section title={`Штрафы (${state.fines.length})`}>
        {state.fines.length === 0 && <Empty>Штрафов нет</Empty>}
        {state.fines.map((f) => (
          <Tile key={f.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{f.reason}</p>
              <p className="text-xs text-muted-foreground">{fmt(f.amount)}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                act((s) =>
                  s.money < f.amount ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - f.amount, fines: s.fines.filter((x) => x.id !== f.id) }, message: "Штраф оплачен" },
                )
              }
            >
              Оплатить
            </Button>
          </Tile>
        ))}
      </Section>
    </div>
  );
}
