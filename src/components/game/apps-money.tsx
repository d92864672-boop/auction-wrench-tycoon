import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import {
  DAILY_BONUS_PER_LEVEL,
  WHEEL,
  CURRENCIES,
  buyCurrency,
  sellCurrency,
  getRates,
  getWallet,
  fmtRate,
  adCampaign,
  adCampaignCost,
  claimDailyBonus,
  gameDay,
  level,
  propertyRent,
  renovate,
  renovationCost,
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
  const bonusReady = state.lastBonusDay < gameDay(state);
  return (
    <div className="space-y-4">
      <Tile className="icon-navy border-0 p-4">
        <p className="text-xs opacity-80">wert Банк · карта</p>
        <p className="mt-4 font-display text-2xl font-semibold">{fmt(state.money)}</p>
        <p className="mt-1 text-xs opacity-80">Капитал: {fmtShort(netWorth(state))}</p>
      </Tile>
      <Tile className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">🎁 Ежедневный бонус</p>
          <p className="text-xs text-muted-foreground">{fmt(DAILY_BONUS_PER_LEVEL * level(state))} · растёт с уровнем</p>
        </div>
        <Button size="sm" className={bonusReady ? "shimmer" : undefined} disabled={!bonusReady} onClick={() => act((s) => claimDailyBonus(s))}>
          {bonusReady ? "Забрать" : "Завтра"}
        </Button>
      </Tile>
      <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
      <Section title="Вклад · 1% в день">
        <Stat label="На вкладе" value={fmt(state.deposit)} />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => act((s) => (s.money < a || !a ? { state: s, error: "Не хватает денег" } : { state: { ...s, money: s.money - a, deposit: s.deposit + a }, message: "Положено на вклад" }))}>Положить</Button>
          <Button className="flex-1" variant="secondary" onClick={() => act((s) => (s.deposit < a || !a ? { state: s, error: "На вкладе меньше" } : { state: { ...s, money: s.money + a, deposit: s.deposit - a }, message: "Снято со вклада" }))}>Снять</Button>
        </div>
      </Section>
      <Section title="💱 Обмен валюты">
        {CURRENCIES.map((c) => (
          <Tile key={c.id} className="space-y-2">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">{c.flag} {c.name} · {fmtRate(getRates(state)[c.id])}</p>
              <p className="text-xs text-muted-foreground">У тебя: {getWallet(state)[c.id].toLocaleString("ru-RU")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => act((s) => buyCurrency(s, c.id, a))}>Купить на {fmtShort(a)}</Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => act((s) => sellCurrency(s, c.id))}>Продать всё</Button>
            </div>
          </Tile>
        ))}
        <p className="text-center text-[11px] text-muted-foreground">Каждый день курс меняется: до +10 коп. или до −27 коп.</p>
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

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="mt-2 text-[11px] text-muted-foreground">График появится через пару игровых часов</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const w = 280;
  const h = 40;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / (max - min || 1)) * (h - 4) - 2}`).join(" ");
  const up = points[points.length - 1]! >= points[0]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={up ? "mt-2 h-10 w-full text-success" : "mt-2 h-10 w-full text-destructive"} preserveAspectRatio="none" aria-label="График цены за сутки">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ strokeDasharray: 1000, strokeDashoffset: 0, transition: "all .4s" }} />
    </svg>
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
            <Sparkline points={state.stockHistory?.[st.id] ?? []} />
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
const pick = () => SLOT[Math.floor(Math.random() * SLOT.length)]!;

function Confetti({ burst }: { burst: number }) {
  if (!burst) return null;
  const colors = ["var(--warning)", "var(--primary)", "var(--success)", "var(--destructive)", "var(--chart-4)"];
  return (
    <div key={burst} className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const r = 90 + Math.random() * 70;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{ background: colors[i % colors.length], ["--dx" as string]: `${Math.cos(a) * r}px`, ["--dy" as string]: `${Math.sin(a) * r + 40}px`, animationDelay: `${Math.random() * 120}ms` }}
          />
        );
      })}
    </div>
  );
}

function ResultBadge({ result }: { result: { win: boolean; text: string; k: number } | null }) {
  if (!result) return null;
  return (
    <p key={result.k} className={result.win ? "anim-land text-center font-display text-lg font-semibold text-warning" : "anim-shake text-center font-display text-lg font-semibold text-destructive"}>
      {result.text}
    </p>
  );
}

export function CasinoApp() {
  const { state, act } = useGame();
  const [bet, setBet] = useState("10000");
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<{ win: boolean; text: string; k: number } | null>(null);
  // slots
  const [slots, setSlots] = useState(["7️⃣", "7️⃣", "7️⃣"]);
  const [spinning, setSpinning] = useState([false, false, false]);
  // coin
  const [coinDeg, setCoinDeg] = useState(0);
  // roulette
  const [rouletteDeg, setRouletteDeg] = useState(0);
  // wheel of fortune
  const [wheelDeg, setWheelDeg] = useState(0);
  const b = parseAmount(bet);

  const settle = (win: boolean, mult: number, label: string) => {
    const ok = act((s) => {
      if (!b || s.money < b) return { state: s, error: "Не хватает денег" };
      const delta = win ? Math.round(b * (mult - 1)) : -b;
      return {
        state: { ...s, money: s.money + delta, stats: { ...s.stats, casinoWins: s.stats.casinoWins + (win && mult > 1 ? 1 : 0) } },
      };
    });
    if (!ok) return;
    const k = Date.now();
    if (win && mult > 1) {
      setBurst(k);
      setResult({ win: true, text: `${label}: +${fmt(Math.round(b * (mult - 1)))}`, k });
    } else if (win) {
      setResult({ win: false, text: `${label}: возврат ${fmt(Math.round(b * mult))}`, k });
    } else {
      setResult({ win: false, text: `${label}: −${fmt(b)}`, k });
    }
  };

  const guard = () => {
    if (busy) return false;
    if (!b || state.money < b) { toast.error("Не хватает денег"); return false; }
    return true;
  };

  const flip = (side: "Орёл" | "Решка") => {
    if (!guard()) return;
    setBusy(true);
    setResult(null);
    const win = Math.random() < 0.49;
    const landsHeads = side === "Орёл" ? win : !win;
    setCoinDeg((d) => d - (d % 360) + 360 * 5 + (landsHeads ? 0 : 180));
    setTimeout(() => { settle(win, 2, side); setBusy(false); }, 1450);
  };

  const roulette = (kind: "red" | "black" | "zero") => {
    if (!guard()) return;
    setBusy(true);
    setResult(null);
    const n = Math.floor(Math.random() * 37); // 0 = zero, odd = red, even = black
    const win = kind === "zero" ? n === 0 : n !== 0 && (kind === "red" ? n % 2 === 1 : n % 2 === 0);
    const pocket = (360 / 37) * n + 360 / 74;
    setRouletteDeg((d) => d - (d % 360) + 360 * 6 + (360 - pocket));
    setTimeout(() => { settle(win, kind === "zero" ? 36 : 2, n === 0 ? "Зеро" : `${n} ${n % 2 ? "красное" : "чёрное"}`); setBusy(false); }, 3250);
  };

  const spin = () => {
    if (!guard()) return;
    setBusy(true);
    setResult(null);
    const r = [pick(), pick(), pick()];
    setSpinning([true, true, true]);
    const spinningRef = { current: [true, true, true] };
    const tick = setInterval(() => setSlots((cur) => cur.map((c, i) => (spinningRef.current[i] ? pick() : c))), 80);
    [600, 1000, 1400].forEach((ms, i) =>
      setTimeout(() => {
        spinningRef.current[i] = false;
        setSlots((cur) => cur.map((c, j) => (j === i ? r[i]! : c)));
        setSpinning((sp) => sp.map((v, j) => (j === i ? false : v)));
        if (i === 2) {
          clearInterval(tick);
          const three = r[0] === r[1] && r[1] === r[2];
          const two = !three && (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]);
          settle(three || two, three ? (r[0] === "7️⃣" ? 20 : 8) : 1.5, three ? "Джекпот" : "Слоты");
          setBusy(false);
        }
      }, ms),
    );
  };

  const wheel = () => {
    if (!guard()) return;
    setBusy(true);
    setResult(null);
    const i = Math.floor(Math.random() * WHEEL.length);
    const seg = 360 / WHEEL.length;
    setWheelDeg((d) => d - (d % 360) + 360 * 5 + (360 - (i * seg + seg / 2)));
    setTimeout(() => {
      const m = WHEEL[i]!;
      settle(m > 0, m, `Колесо ×${m}`);
      setBusy(false);
    }, 3300);
  };

  const wheelColors = ["var(--primary)", "var(--chart-4)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--chart-2)"];
  const seg = 360 / WHEEL.length;
  const wheelBg = `conic-gradient(${WHEEL.map((_, i) => `${wheelColors[i % wheelColors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;

  return (
    <div className="relative space-y-4">
      <Confetti burst={burst} />
      <Tile className={result?.win ? "casino-felt anim-win" : "casino-felt"}>
        <p className="text-[11px] text-muted-foreground">Баланс</p>
        <p key={state.money} className="anim-land font-display text-xl font-semibold">{fmt(state.money)}</p>
        <ResultBadge result={result} />
      </Tile>
      <div className="flex gap-2">
        <Input inputMode="numeric" value={bet} onChange={(e) => setBet(e.target.value)} placeholder="Ставка" />
        <Button variant="secondary" onClick={() => setBet(String(Math.max(1, Math.floor(Number(bet) / 2 || 0))))}>½</Button>
        <Button variant="secondary" onClick={() => setBet(String(Math.min(state.money, (Number(bet) || 0) * 2)))}>×2</Button>
        <Button variant="secondary" onClick={() => setBet(String(Math.floor(state.money)))}>Всё</Button>
      </div>

      <Section title="Слоты">
        <Tile className="casino-felt">
          <div className="flex justify-center gap-3">
            {slots.map((sym, i) => (
              <div key={i} className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-5xl">
                <span key={spinning[i] ? `s${i}` : `${sym}${i}${result?.k ?? 0}`} className={spinning[i] ? "anim-reel" : "anim-land"}>{sym}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">3 одинаковых ×8 · три 7️⃣ ×20 · пара ×1.5</p>
        </Tile>
        <Button className="w-full" size="lg" disabled={busy} onClick={spin}>🎰 Крутить</Button>
      </Section>

      <Section title="Колесо фортуны">
        <Tile className="casino-felt flex flex-col items-center gap-3 py-5">
          <div className="relative h-52 w-52">
            <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-foreground" />
            <div className="wheel-spin relative h-full w-full rounded-full border-4 border-foreground/80 shadow-2xl" style={{ background: wheelBg, transform: `rotate(${wheelDeg}deg)` }}>
              {WHEEL.map((m, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 font-display text-xs font-semibold text-primary-foreground"
                  style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-82px) translateX(-50%)`, transformOrigin: "0 0" }}
                >
                  ×{m}
                </span>
              ))}
              <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-foreground/80 bg-background" />
            </div>
          </div>
        </Tile>
        <Button className="w-full" size="lg" disabled={busy} onClick={wheel}>🎡 Крутить колесо</Button>
      </Section>

      <Section title="Рулетка">
        <Tile className="casino-felt flex flex-col items-center gap-3 py-5">
          <div className="relative h-44 w-44">
            <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[14px] border-x-transparent border-t-warning" />
            <div className="roulette-wheel wheel-spin h-full w-full rounded-full border-[6px] border-warning/70 shadow-2xl" style={{ transform: `rotate(${rouletteDeg}deg)` }}>
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-warning/70 bg-card" />
            </div>
          </div>
        </Tile>
        <div className="flex gap-2">
          <Button className="flex-1" variant="destructive" disabled={busy} onClick={() => roulette("red")}>Красное ×2</Button>
          <Button className="flex-1" variant="secondary" disabled={busy} onClick={() => roulette("black")}>Чёрное ×2</Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => roulette("zero")}>Зеро ×36</Button>
        </div>
      </Section>

      <Section title="Монетка · ×2">
        <Tile className="casino-felt flex justify-center py-5" >
          <div style={{ perspective: 600 }}>
            <div className="coin-3d relative h-24 w-24" style={{ transform: `rotateY(${coinDeg}deg)` }}>
              <div className="coin-face icon-gold absolute inset-0 flex items-center justify-center rounded-full border-4 border-warning font-display text-sm font-semibold">ОРЁЛ</div>
              <div className="coin-face icon-amber absolute inset-0 flex items-center justify-center rounded-full border-4 border-warning font-display text-sm font-semibold" style={{ transform: "rotateY(180deg)" }}>РЕШКА</div>
            </div>
          </div>
        </Tile>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => flip("Орёл")}>Орёл</Button>
          <Button className="flex-1" disabled={busy} onClick={() => flip("Решка")}>Решка</Button>
        </div>
      </Section>
      <p className="text-center text-xs text-muted-foreground">Игровые деньги. Казино всегда в плюсе — играй с умом.</p>
    </div>
  );
}

export function RealtyApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Аренда приходит каждый игровой день. Гаражи и паркинги дают места для машин. Ремонт поднимает аренду на 25%.</p>
      {PROPERTIES.map((p) => {
        const owned = state.properties.includes(p.id);
        return (
          <Tile key={p.id}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Аренда +{fmt(owned ? propertyRent(state, p.id) : p.rent)}/день{p.garageSlots ? ` · +${p.garageSlots} места в гараже` : ""}
                  {state.renovated.includes(p.id) ? " · ✨ с ремонтом" : ""}
                </p>
              </div>
              {owned ? (
                <div className="flex flex-col gap-1">
                  {!state.renovated.includes(p.id) && (
                    <Button size="sm" onClick={() => act((s) => renovate(s, p.id))}>Ремонт {fmtShort(renovationCost(p.id))}</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => act((s) => ({ state: { ...s, money: s.money + Math.round(p.price * 0.9), properties: s.properties.filter((x) => x !== p.id), renovated: s.renovated.filter((x) => x !== p.id) }, message: `Продано за ${fmt(Math.round(p.price * 0.9))}` }))}>Продать</Button>
                </div>
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
  const adActive = state.adUntilDay > gameDay(state);
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
        {state.businesses.length > 0 && (
          <Tile className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">📣 Рекламная кампания</p>
              <p className="text-xs text-muted-foreground">{adActive ? "Запущена — завтра доход +50%" : "Завтра доход всех бизнесов +50%"}</p>
            </div>
            <Button size="sm" disabled={adActive} onClick={() => act((s) => adCampaign(s))}>{adActive ? "Идёт" : fmtShort(adCampaignCost(state))}</Button>
          </Tile>
        )}
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
