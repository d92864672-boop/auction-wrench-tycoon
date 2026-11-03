import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import {
  CURRENT_YEAR,
  buyListing,
  buyoutLot,
  buyoutPrice,
  carValue,
  disputeFine,
  negotiate,
  orderPlate,
  repairAll,
  SERVICES,
  SERVICE_SECONDS,
  finishService,
  serviceCost,
  startService,
  sellerAnswer,
  type Listing,
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
import { carPhotos } from "@/game/photos";
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

function CarPhotos({ car }: { car: Pick<Car, "id" | "modelId" | "name"> }) {
  const photos = carPhotos(car);
  const [idx, setIdx] = useState(0);
  return (
    <div className="relative -mx-3 -mt-3 mb-3 overflow-hidden rounded-t-2xl">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((src, i) => (
          <img key={i} src={src} alt={`${car.name}, фото ${i + 1}`} loading="lazy" width={992} height={672} className="aspect-[3/2] w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      <span className="glass absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">
        📷 {idx + 1}/{photos.length}
      </span>
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {photos.map((_, i) => (
            <span key={i} className={i === idx ? "h-1.5 w-4 rounded-full bg-foreground transition-all" : "h-1.5 w-1.5 rounded-full bg-foreground/50 transition-all"} />
          ))}
        </div>
      )}
    </div>
  );
}

const SELLERS = ["Ашот", "Дядя Витя", "Серёга", "Марина", "Тимур", "Олег Палыч", "Гоша", "Рустам"];
const sellerName = (id: string) => SELLERS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % SELLERS.length]!;

type ChatMsg = { from: "me" | "seller"; text: string };

/** Ready-made haggling phrases: each asks for a different discount. */
const PHRASES = [
  { text: "Можете сбросить цену по-братски?", off: 0.07 },
  { text: "Я начинающий перекуп, сбросьте, пожалуйста, цену.", off: 0.1 },
  { text: "Наличка прямо сейчас, скинете?", off: 0.12 },
  { text: "Заберу сегодня, без лишних вопросов.", off: 0.08 },
  { text: "Там же ремонт нужен, скиньте.", off: 0.15 },
  { text: "На рынке дешевле видел, уступите?", off: 0.18 },
  { text: "Студент, последние деньги, войдите в положение 🙏", off: 0.2 },
  { text: "Дам половину — и разойдёмся.", off: 0.5 },
];

function SellerChat({ listing, log, setLog, onClose }: { listing: Listing; log: ChatMsg[]; setLog: (fn: (m: ChatMsg[]) => ChatMsg[]) => void; onClose: () => void }) {
  const { state, set, act } = useGame();
  const [typing, setTyping] = useState(false);
  const [offer, setOffer] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const name = sellerName(listing.id);
  const tries = listing.tries ?? 3;

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [log, typing]);

  const sellerSays = (text: string) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setLog((m) => [...m, { from: "seller", text }]);
    }, 700 + Math.random() * 600);
  };

  const ask = (label: string, q: "mileage" | "accident" | "owners" | "docs") => {
    setLog((m) => [...m, { from: "me", text: label }]);
    sellerSays(sellerAnswer(listing, q));
  };

  const propose = (amount: number, phrase?: string) => {
    if (!amount) { toast.error("Введите сумму"); return; }
    setLog((m) => [...m, { from: "me", text: phrase ? `${phrase} Отдадите за ${fmt(amount)}?` : `Отдадите за ${fmt(amount)}?` }]);
    const roll = Math.random();
    const r = negotiate(state, listing.id, amount, roll);
    set((s) => negotiate(s, listing.id, amount, roll).state);
    sellerSays(r.reply);
    setOffer("");
  };

  return (
    <div className="anim-app-in flex min-h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Button size="sm" variant="ghost" onClick={onClose}>← Назад</Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground">{name[0]}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{listing.name} · {fmt(listing.price)}</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 py-3">
        <img src={carPhotos(listing)[0]} alt={listing.name} width={992} height={672} className="mx-auto aspect-[3/2] w-2/3 rounded-xl object-cover" />
        {log.map((m, i) => (
          <div key={i} className={m.from === "me" ? "anim-msg flex justify-end" : "anim-msg flex justify-start"}>
            <div className={m.from === "me" ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[80%] rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-sm"}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-card px-3 py-3">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="sticky bottom-0 space-y-2 bg-background pt-2">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <Button size="sm" variant="secondary" onClick={() => ask("Пробег реальный?", "mileage")}>Пробег?</Button>
          <Button size="sm" variant="secondary" onClick={() => ask("Битая? Крашеная?", "accident")}>ДТП?</Button>
          <Button size="sm" variant="secondary" onClick={() => ask("Сколько владельцев?", "owners")}>Владельцы?</Button>
          <Button size="sm" variant="secondary" onClick={() => ask("Документы в порядке?", "docs")}>Документы?</Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">Попыток торга: {tries} · выбери, что написать</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PHRASES.map((p) => (
            <Button
              key={p.text}
              size="sm"
              variant="outline"
              className="h-auto whitespace-normal py-1.5 text-left text-xs leading-tight"
              disabled={tries <= 0 || typing}
              onClick={() => propose(Math.round((listing.price * (1 - p.off)) / 1000) * 1000, p.text)}
            >
              {p.text}
            </Button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); propose(Math.floor(Number(offer.replace(/\s/g, "")))); }}>
          <Input inputMode="numeric" value={offer} disabled={tries <= 0} onChange={(e) => setOffer(e.target.value)} placeholder="Своя цена" />
          <Button type="submit" variant="secondary" disabled={tries <= 0 || typing}>Предложить</Button>
        </form>
        <Button className="w-full" onClick={() => { if (act((s) => buyListing(s, listing.id))) onClose(); }}>Купить за {fmt(listing.price)}</Button>
      </div>
    </div>
  );
}

export function PerekupApp() {
  const { state, act, set } = useGame();
  const [haggle, setHaggle] = useState<Record<string, number>>({});
  const [chatId, setChatId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, ChatMsg[]>>({});
  const cap = garageCapacity(state);

  const refresh = () =>
    act((s) => (s.money < 5_000 ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - 5_000, listings: generateListings(s) }, message: "Объявления обновлены" }));

  const tryHaggle = (car: Car) => {
    if (haggle[car.id] !== undefined) return;
    const ok = Math.random() < 0.5;
    setHaggle((h) => ({ ...h, [car.id]: ok ? 1.08 : 0.92 }));
    toast(ok ? "Покупатель согласился на +8%" : "Покупатель обиделся: −8%");
  };

  const chatListing = state.listings.find((l) => l.id === chatId);
  if (chatId && chatListing) {
    const log = logs[chatId] ?? [{ from: "seller" as const, text: `Здравствуйте! ${chatListing.name} ещё продаётся. Прошу ${fmt(chatListing.price)}. Торг у капота 😉` }];
    return (
      <SellerChat
        listing={chatListing}
        log={log}
        setLog={(fn) => setLogs((l) => ({ ...l, [chatId]: fn(l[chatId] ?? log) }))}
        onClose={() => setChatId(null)}
      />
    );
  }

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
            <Tile key={l.id} className="overflow-hidden">
              <CarPhotos car={l} />
              <CarInfo car={l} />
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold">{fmt(l.price)}</p>
                  <p className={deal > 0.1 ? "text-xs text-success" : deal < -0.05 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    Оценка {fmt(v)} {deal > 0.1 ? "· Выгодно" : deal < -0.05 ? "· Дорого" : ""}
                    {modelOf(l.modelId).rare ? " · Редкая" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setChatId(l.id)}>
                  <MessageCircle /> Написать {sellerName(l.id)}
                </Button>
                <Button size="sm" className="flex-1" onClick={() => act((s) => buyListing(s, l.id))}>Купить</Button>
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
            <Tile key={c.id} className="overflow-hidden">
              <CarPhotos car={c} />
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
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const broken = state.garage.filter((c) => c.condition < 100);
  return (
    <Tabs defaultValue="repair">
      <TabsList className="w-full">
        <TabsTrigger value="repair" className="flex-1">Ремонт</TabsTrigger>
        <TabsTrigger value="tuning" className="flex-1">Услуги</TabsTrigger>
      </TabsList>
      <TabsContent value="repair" className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">После ремонта машина стоит дороже. Улучшение «Свой механик» снижает цену.</p>
        {broken.length > 1 && (
          <Button className="w-full" onClick={() => act((s) => repairAll(s))}>
            🔧 Отремонтировать все · {fmt(broken.reduce((a, c) => a + repairCost(state, c), 0))}
          </Button>
        )}
        {broken.length === 0 && <Empty>Все машины в идеальном состоянии</Empty>}
        {broken.map((c) => (
          <Tile key={c.id} className="overflow-hidden">
            <CarPhotos car={c} />
            <CarInfo car={c} />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-success">Стоимость вырастет на {fmt(carValue({ ...c, condition: 100 }) - carValue(c))}</p>
              <Button size="sm" onClick={() => act((s) => repairCar(s, c.id))}>Ремонт {fmt(repairCost(state, c))}</Button>
            </div>
          </Tile>
        ))}
      </TabsContent>
      <TabsContent value="tuning" className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">Каждая услуга занимает {SERVICE_SECONDS} секунд и поднимает цену машины.</p>
        {state.garage.length === 0 && <Empty>В гараже нет машин</Empty>}
        {state.garage.map((c) => {
          const job = c.inService;
          const left = job ? Math.max(0, job.endAt - now) : 0;
          const sv = job ? SERVICES.find((x) => x.id === job.id) : undefined;
          return (
            <Tile key={c.id}>
              <CarInfo car={c} />
              {job ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm">🛠 {sv?.name}</p>
                  <Progress value={100 - (left / (SERVICE_SECONDS * 1000)) * 100} />
                  <Button size="sm" className={left > 0 ? "w-full" : "shimmer w-full"} disabled={left > 0} onClick={() => act((s) => finishService(s, c.id))}>
                    {left > 0 ? `Осталось ${Math.ceil(left / 1000)} с` : "Забрать машину"}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {SERVICES.map((x) => {
                    const done = c.services?.includes(x.id);
                    return (
                      <Button key={x.id} size="sm" variant={done ? "ghost" : "outline"} disabled={done} className="h-auto flex-col py-1.5 text-xs" onClick={() => act((s) => startService(s, c.id, x.id))}>
                        <span>{done ? "✓ " : ""}{x.name}</span>
                        <span className="text-[10px] text-muted-foreground">{done ? "сделано" : `${fmt(serviceCost(c, x.id))} · +${Math.round(x.bonus * 100)}%`}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </Tile>
          );
        })}
      </TabsContent>
    </Tabs>
  );
}

type Lot = { car: Car; bid: number; leader: "you" | "bot"; endsAt: number; botMax: number };

function newLot(): Lot {
  const rares = CAR_MODELS.filter((m) => m.rare && m.id !== "wert");
  const m = rares[Math.floor(Math.random() * rares.length)]!;
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
    if (left > 0 || done.current) return undefined;
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
    return undefined;
  }, [left, lot, act]);

  const bid = () => {
    const next = Math.round(lot.bid * 1.05);
    if (state.money < next) { toast.error("Не хватает денег на ставку"); return; }
    setLot((l) => ({ ...l, bid: next, leader: "you", endsAt: Math.max(l.endsAt, Date.now() + 8_000) }));
  };

  return (
    <div className="space-y-3">
      <Tile className="overflow-hidden">
        <CarPhotos car={lot.car} />
        <p className="text-xs uppercase tracking-wider text-warning">Редкий лот</p>
        <div className="mt-1">
          <CarInfo car={lot.car} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Рыночная оценка: {fmt(carValue(lot.car))}</p>
      </Tile>
      <div className="grid grid-cols-2 gap-2">
        <div key={lot.bid} className="anim-land"><Stat label="Текущая ставка" value={fmt(lot.bid)} /></div>
        <Stat label="До конца" value={`${left} с`} tone={left < 8 ? "bad" : undefined} />
      </div>
      <p className="text-center text-sm">{lot.leader === "you" ? "Вы лидируете" : "Лидирует другой участник"}</p>
      {left > 0 ? (
        <Button className="w-full" size="lg" onClick={bid} disabled={lot.leader === "you"}>
          Поднять до {fmt(Math.round(lot.bid * 1.05))}
        </Button>
      ) : null}
      {left > 0 && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => {
            if (act((s) => buyoutLot(s, lot.car))) {
              done.current = true;
              setLot((l) => ({ ...l, endsAt: Date.now() - 1, leader: "bot" }));
            }
          }}
        >
          ⚡ Выкупить сразу за {fmt(buyoutPrice(lot.car))}
        </Button>
      )}
      {left > 0 ? null : (
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
  const [digits, setDigits] = useState("");
  return (
    <Tabs defaultValue="buy">
      <TabsList className="w-full">
        <TabsTrigger value="buy" className="flex-1">Купить</TabsTrigger>
        <TabsTrigger value="mine" className="flex-1">Мои номера {state.plates.length}</TabsTrigger>
      </TabsList>
      <TabsContent value="buy" className="mt-3 space-y-2">
        <Tile className="space-y-2">
          <p className="text-sm font-semibold">Заказать номер со своими цифрами</p>
          <p className="text-xs text-muted-foreground">Стоимость — двойная цена номера. Например, 777 или 001.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (act((s) => orderPlate(s, digits))) setDigits(""); }}>
            <Input inputMode="numeric" maxLength={3} value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))} placeholder="3 цифры" />
            <Button type="submit">Заказать</Button>
          </form>
        </Tile>
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
              <p className="text-xs text-muted-foreground">{fmt(f.amount)}{f.disputed ? " · жалоба отклонена" : ""}</p>
            </div>
            <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={f.disputed} onClick={() => act((s) => disputeFine(s, f.id, Math.random()))}>Обжаловать</Button>
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
            </div>
          </Tile>
        ))}
      </Section>
    </div>
  );
}
