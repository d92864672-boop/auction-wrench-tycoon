import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import {
  businessIncome,
  businessUpgradeCost,
  buyBusiness,
  fmt,
  fmtShort,
  isVip,
  netWorth,
  sellBusiness,
  upgradeBusiness,
} from "@/game/engine";
import { BUSINESSES, MAX_BUSINESS_LEVEL, PROPERTIES, STOCKS } from "@/game/data";
import { Empty, Section, Stat, Tile } from "./ui";

function parseAmount(v: string) {
  const n = Number(v.replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function BankApp() {
  const { state, act } = useGame();
  const [amount, setAmount] = useState("100000");
  const a = parseAmount(amount);
  const limit = Math.max(1_000_000, Math.round(netWorth(state) * 0.5));
  return (
    <div className="space-y-4">
      <Tile className="icon-navy border-0 p-4">
        <p className="text-xs opacity-80">wert Банк · карта</p>
        <p className="mt-4 font-display text-2xl font-semibold">{fmt(state.money)}</p>
        <p className="mt-1 text-xs opacity-80">Капитал: {fmtShort(netWorth(state))}</p>
      </Tile>
      <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
      <Section title="Вклад · 1% в день">
        <Stat label="На вкладе" value={fmt(state.deposit)} />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => act((s) => (s.money < a || !a ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - a, deposit: s.deposit + a }, message: "Положено на вклад" }))}>Положить</Button>
          <Button className="flex-1" variant="secondary" onClick={() => act((s) => (s.deposit < a || !a ? { state: s, error: "На вкладе меньше" } : { state: { ...s, money: s.money + a, deposit: s.deposit - a }, message: "Снято со вклада" }))}>Снять</Button>
        </div>
      </Section>
      <Section title="Кредит · 2% в день">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Долг" value={fmt(state.loan)} tone={state.loan > 0 ? "bad" : undefined} />
          <Stat label="Лимит" value={fmtShort(limit)} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => act((s) => (s.loan + a > limit || !a ? { state: s, error: "Превышен лимит" } : { state: { ...s, money: s.money + a, loan: s.loan + a }, message: "Кредит одобрен" }))}>Взять</Button>
          <Button className="flex-1" onClick={() => act((s) => { const pay = Math.min(a, s.loan); return s.money < pay || !pay ? { state: s, error: "Нечего гасить" } : { state: { ...s, money: s.money - pay, loan: s.loan - pay }, message: "Кредит погашен" }; })}>Погасить</Button>
        </div>
      </Section>
    </div>
  );
}

export function StocksApp() {
  const { state, act } = useGame();
  const prev = useRef<Record<string, number>>({ ...state.stockPrices });
  const [qty, setQty] = useState(1);
  const total = STOCKS.reduce((a, s) => a + (state.stocks[s.id] ?? 0) * (state.stockPrices[s.id] ?? 0), 0);
  return (
    <div className="space-y-3">
      <Stat label="Портфель" value={fmt(total)} />
      <div className="flex gap-1">
        {[1, 10, 100, 1000].map((q) => (
          <Button key={q} size="sm" variant={qty === q ? "default" : "secondary"} className="flex-1" onClick={() => setQty(q)}>×{q}</Button>
        ))}
      </div>
      {STOCKS.map((st) => {
        const p = state.stockPrices[st.id] ?? st.start;
        const change = (p - st.start) / st.start;
        const own = state.stocks[st.id] ?? 0;
        const up = p >= (prev.current[st.id] ?? p);
        prev.current[st.id] = p;
        return (
          <Tile key={st.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-semibold">{st.id}</p>
                <p className="text-xs text-muted-foreground">{st.name} · у вас {own}</p>
              </div>
              <div className="text-right">
                <p className={up ? "font-semibold text-success" : "font-semibold text-destructive"}>{fmt(p)}</p>
                <p className={change >= 0 ? "text-xs text-success" : "text-xs text-destructive"}>{(change * 100).toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => act((s) => { const cost = Math.round(p * qty); return s.money < cost ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - cost, stocks: { ...s.stocks, [st.id]: own + qty } }, message: `Куплено ${qty} ${st.id}` }; })}>Купить</Button>
              <Button size="sm" variant="secondary" className="flex-1" disabled={own === 0} onClick={() => act((s) => { const q = Math.min(qty, s.stocks[st.id] ?? 0); return { state: { ...s, money: s.money + Math.round(p * q), stocks: { ...s.stocks, [st.id]: (s.stocks[st.id] ?? 0) - q } }, message: `Продано ${q} ${st.id}` }; })}>Продать</Button>
            </div>
          </Tile>
        );
      })}
    </div>
  );
}

const SLOT = ["🍒", "🍋", "💎", "7️⃣", "🚗"];

export function CasinoApp() {
  const { state, act } = useGame();
  const [bet, setBet] = useState("10000");
  const [slots, setSlots] = useState(["7️⃣", "7️⃣", "7️⃣"]);
  const b = parseAmount(bet);

  const play = (win: boolean, mult: number, label: string) =>
    act((s) => {
      if (!b || s.money < b) return { state: s, error: "Не хватает денег" };
      const delta = win ? Math.round(b * (mult - 1)) : -b;
      return {
        state: { ...s, money: s.money + delta, stats: { ...s.stats, casinoWins: s.stats.casinoWins + (win ? 1 : 0) } },
        message: win ? `${label}: выигрыш ${fmt(b * mult)}` : `${label}: проигрыш ${fmt(b)}`,
      };
    });

  const spin = () => {
    if (!b || state.money < b) return toast.error("Не хватает денег");
    const r = Array.from({ length: 3 }, () => SLOT[Math.floor(Math.random() * SLOT.length)]);
    setSlots(r);
    const three = r[0] === r[1] && r[1] === r[2];
    const two = !three && (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]);
    play(three || two, three ? (r[0] === "7️⃣" ? 20 : 8) : 1.5, "Слоты");
  };

  return (
    <div className="space-y-4">
      <Stat label="Баланс" value={fmt(state.money)} />
      <div className="flex gap-2">
        <Input inputMode="numeric" value={bet} onChange={(e) => setBet(e.target.value)} placeholder="Ставка" />
        <Button variant="secondary" onClick={() => setBet(String(Math.floor(state.money / 2)))}>½</Button>
      </div>
      <Section title="Монетка · ×2">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => play(Math.random() < 0.49, 2, "Орёл")}>Орёл</Button>
          <Button className="flex-1" onClick={() => play(Math.random() < 0.49, 2, "Решка")}>Решка</Button>
        </div>
      </Section>
      <Section title="Рулетка">
        <div className="flex gap-2">
          <Button className="flex-1" variant="destructive" onClick={() => play(Math.random() < 18 / 37, 2, "Красное")}>Красное ×2</Button>
          <Button className="flex-1" variant="secondary" onClick={() => play(Math.random() < 18 / 37, 2, "Чёрное")}>Чёрное ×2</Button>
          <Button className="flex-1" variant="outline" onClick={() => play(Math.random() < 1 / 37, 36, "Зеро")}>Зеро ×36</Button>
        </div>
      </Section>
      <Section title="Слоты">
        <Tile className="flex justify-center gap-4 py-5 text-4xl">
          {slots.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </Tile>
        <Button className="w-full" size="lg" onClick={spin}>Крутить</Button>
      </Section>
      <p className="text-center text-xs text-muted-foreground">Игровые деньги. Казино всегда в плюсе — играй с умом.</p>
    </div>
  );
}

export function RealtyApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Аренда приходит каждый игровой день. Гаражи и паркинги дают места для машин.</p>
      {PROPERTIES.map((p) => {
        const owned = state.properties.includes(p.id);
        return (
          <Tile key={p.id}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Аренда +{fmt(p.rent)}/день{p.garageSlots ? ` · +${p.garageSlots} места в гараже` : ""}
                </p>
              </div>
              {owned ? (
                <Button size="sm" variant="secondary" onClick={() => act((s) => ({ state: { ...s, money: s.money + Math.round(p.price * 0.9), properties: s.properties.filter((x) => x !== p.id) }, message: `Продано за ${fmt(Math.round(p.price * 0.9))}` }))}>Продать</Button>
              ) : (
                <Button size="sm" onClick={() => act((s) => (s.money < p.price ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - p.price, properties: [...s.properties, p.id], xp: s.xp + 400 }, message: `Куплено: ${p.name}` }))}>{fmtShort(p.price)}</Button>
              )}
            </div>
          </Tile>
        );
      })}
    </div>
  );
}

export function BusinessApp() {
  const { state, act } = useGame();
  const daily = state.businesses.reduce((a, b) => {
    const t = BUSINESSES.find((x) => x.id === b.typeId);
    return a + businessIncome(state, b) - (t?.expenses ?? 0);
  }, 0);
  return (
    <Tabs defaultValue="mine">
      <TabsList className="w-full">
        <TabsTrigger value="mine" className="flex-1">Мои ({state.businesses.length})</TabsTrigger>
        <TabsTrigger value="buy" className="flex-1">Открыть</TabsTrigger>
      </TabsList>
      <TabsContent value="mine" className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Прибыль в день" value={fmt(daily)} tone={daily >= 0 ? "good" : "bad"} />
          <Stat label="Бонус" value={isVip(state) ? "VIP ×2" : "—"} />
        </div>
        {state.businesses.length === 0 && <Empty>Открой первый бизнес — он приносит деньги каждый день</Empty>}
        {state.businesses.map((b) => {
          const t = BUSINESSES.find((x) => x.id === b.typeId)!;
          const inc = businessIncome(state, b);
          return (
            <Tile key={b.uid}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t.name}</p>
                <span className="text-xs text-warning">{"★".repeat(b.level)}{"☆".repeat(MAX_BUSINESS_LEVEL - b.level)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Доход <span className="text-success">+{fmt(inc)}</span> · Расходы <span className="text-destructive">−{fmt(t.expenses)}</span>
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1" disabled={b.level >= MAX_BUSINESS_LEVEL} onClick={() => act((s) => upgradeBusiness(s, b.uid))}>
                  {b.level >= MAX_BUSINESS_LEVEL ? "Макс. уровень" : `Улучшить · ${fmtShort(businessUpgradeCost(b))}`}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => act((s) => sellBusiness(s, b.uid))}>Продать</Button>
              </div>
            </Tile>
          );
        })}
      </TabsContent>
      <TabsContent value="buy" className="mt-3 space-y-2">
        {BUSINESSES.map((t) => (
          <Tile key={t.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">+{fmtShort(t.income)} / −{fmtShort(t.expenses)} в день</p>
            </div>
            <Button size="sm" onClick={() => act((s) => buyBusiness(s, t.id))}>{fmtShort(t.price)}</Button>
          </Tile>
        ))}
      </TabsContent>
    </Tabs>
  );
}
