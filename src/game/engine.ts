import {
  ACCESSORIES,
  BUSINESSES,
  CAR_MODELS,
  CITIES,
  MAX_BUSINESS_LEVEL,
  PROPERTIES,
  STOCKS,
  UPGRADES,
  plateValue,
  randomPlate,
  type CarModel,
} from "./data";

export const CURRENT_YEAR = 2026;
/** Game minutes that pass per real second. A game day lasts 6 real minutes. */
export const GAME_MINUTES_PER_SECOND = 4;

export type Car = {
  id: string;
  modelId: string;
  name: string;
  year: number;
  mileage: number;
  condition: number; // 0..100
  plate?: string | undefined;
  boughtFor?: number | undefined;
  services?: string[] | undefined; // finished workshop services
  inService?: { id: string; endAt: number } | undefined;
};
export type Listing = Car & { price: number; floor?: number | undefined; tries?: number | undefined };
export type OwnedBusiness = { uid: string; typeId: string; level: number };
export type Fine = { id: string; reason: string; amount: number; disputed?: boolean | undefined };

export type Stats = {
  carsBought: number;
  carsSold: number;
  profit: number;
  deliveries: number;
  shifts: number;
  casinoWins: number;
  repairs: number;
};

export type GameState = {
  version: 1;
  money: number;
  minutes: number;
  cityId: string;
  garage: Car[];
  listings: Listing[];
  deposit: number;
  loan: number;
  stocks: Record<string, number>;
  stockPrices: Record<string, number>;
  properties: string[];
  businesses: OwnedBusiness[];
  plates: string[];
  upgrades: Record<string, number>;
  accessories: string[];
  wallpaper: string;
  stats: Stats;
  questsClaimed: string[];
  license: boolean;
  fines: Fine[];
  taxDue: number;
  xp: number;
  vipUntilDay: number;
  appliedGrants: string[];
  job?: Job | undefined;
  lastBonusDay: number;
  adUntilDay: number;
  renovated: string[];
  stockHistory: Record<string, number[]>;
};

export type Job = { kind: "delivery" | "shift"; id: string; name: string; endAt: number; pay: number };

export type Result = { state: GameState; error?: string; message?: string };

const uid = () => Math.random().toString(36).slice(2, 10);

export function newGame(): GameState {
  const s: GameState = {
    version: 1,
    money: 500_000,
    minutes: 9 * 60,
    cityId: "msk",
    garage: [],
    listings: [],
    deposit: 0,
    loan: 0,
    stocks: {},
    stockPrices: Object.fromEntries(STOCKS.map((s) => [s.id, s.start])),
    properties: [],
    businesses: [],
    plates: [],
    upgrades: {},
    accessories: [],
    wallpaper: "default",
    stats: { carsBought: 0, carsSold: 0, profit: 0, deliveries: 0, shifts: 0, casinoWins: 0, repairs: 0 },
    questsClaimed: [],
    license: false,
    fines: [],
    taxDue: 0,
    xp: 0,
    vipUntilDay: 0,
    appliedGrants: [],
    lastBonusDay: 0,
    adUntilDay: 0,
    renovated: [],
    stockHistory: {},
  };
  s.listings = generateListings(s);
  return s;
}

/** Fill in fields that older saves may be missing. */
export function migrate(raw: unknown): GameState {
  const base = newGame();
  if (!raw || typeof raw !== "object") return base;
  const s = { ...base, ...(raw as Partial<GameState>) };
  s.stats = { ...base.stats, ...(s.stats ?? {}) };
  s.stockPrices = { ...base.stockPrices, ...(s.stockPrices ?? {}) };
  return s;
}

export const gameDay = (s: GameState) => Math.floor(s.minutes / 1440) + 1;
export const level = (s: GameState) => Math.floor(Math.sqrt(s.xp / 1000)) + 1;
export const isVip = (s: GameState) => s.vipUntilDay >= gameDay(s);
export const upg = (s: GameState, id: string) => s.upgrades[id] ?? 0;
export const cityOf = (s: GameState) => CITIES.find((c) => c.id === s.cityId) ?? CITIES[0]!;
export const modelOf = (id: string): CarModel => CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0]!;

export function carValue(car: Car): number {
  const m = modelOf(car.modelId);
  const age = Math.max(0, CURRENT_YEAR - car.year);
  const ageF = m.rare ? Math.max(0.6, 1 - age * 0.01) : Math.max(0.2, Math.pow(0.93, age));
  const condF = 0.35 + 0.65 * (car.condition / 100);
  const mileF = Math.max(0.5, 1 - car.mileage / 600_000);
  const bonus = (car.services ?? []).reduce((a, id) => a + (SERVICES.find((x) => x.id === id)?.bonus ?? 0), 0);
  return Math.round(m.base * ageF * condF * mileF * (1 + bonus)) + (car.plate ? plateValue(car.plate) : 0);
}

export function garageCapacity(s: GameState): number {
  const fromProps = s.properties.reduce((a, id) => a + (PROPERTIES.find((p) => p.id === id)?.garageSlots ?? 0), 0);
  return 2 + upg(s, "garage") + fromProps + (isVip(s) ? 2 : 0);
}

function randomCar(rand: () => number, allowRare: boolean): Car {
  const pool = CAR_MODELS.filter((m) => (allowRare ? m.rare : !m.rare) && m.id !== "wert");
  const m = pool[Math.floor(rand() * pool.length)]!;
  const minYear = m.id === "vaz2107" ? 1985 : m.rare ? 1987 : 1998;
  const year = Math.min(CURRENT_YEAR, minYear + Math.floor(rand() * (CURRENT_YEAR - minYear + 1)));
  const age = CURRENT_YEAR - year;
  return {
    id: uid(),
    modelId: m.id,
    name: m.name,
    year,
    mileage: Math.round((age * 15_000 + rand() * 40_000) / 1000) * 1000,
    condition: Math.round(20 + rand() * 80),
  };
}

export function generateListings(s: GameState, rand = Math.random): Listing[] {
  const city = cityOf(s);
  const discount = 1 - 0.02 * upg(s, "network");
  return Array.from({ length: 8 }, () => {
    const car = randomCar(rand, rand() < 0.06);
    const origin = modelOf(car.modelId).origin;
    const bonus = city.bonus === origin ? 0.85 : 1;
    const spread = 0.7 + rand() * 0.45;
    const price = Math.round((carValue(car) * city.buy * bonus * spread * discount) / 1000) * 1000;
    // Hidden lowest price the seller will accept when haggling (75–95% of asking).
    const floor = Math.round((price * (0.75 + rand() * 0.2)) / 1000) * 1000;
    return { ...car, price, floor, tries: 3 };
  });
}

export function saleOffer(s: GameState, car: Car): number {
  return Math.round((carValue(car) * cityOf(s).sell * 0.92 * (1 + 0.03 * upg(s, "haggle"))) / 1000) * 1000;
}

export function repairCost(s: GameState, car: Car): number {
  const m = modelOf(car.modelId);
  return Math.round(((100 - car.condition) * m.base * 0.0035 * (1 - 0.1 * upg(s, "mechanic"))) / 100) * 100;
}

const addXp = (s: GameState, xp: number): GameState => ({ ...s, xp: s.xp + xp });

export function buyListing(s: GameState, id: string): Result {
  const l = s.listings.find((x) => x.id === id);
  if (!l) return { state: s, error: "Объявление уже снято" };
  if (s.money < l.price) return { state: s, error: "Не хватает денег" };
  if (s.garage.length >= garageCapacity(s)) return { state: s, error: "Гараж заполнен" };
  const { price, floor: _f, tries: _t, ...car } = l;
  return {
    state: addXp(
      {
        ...s,
        money: s.money - price,
        garage: [...s.garage, { ...car, boughtFor: price }],
        listings: s.listings.filter((x) => x.id !== id),
        stats: { ...s.stats, carsBought: s.stats.carsBought + 1 },
      },
      200,
    ),
    message: `Куплено: ${car.name} за ${fmt(price)}`,
  };
}

export function sellCar(s: GameState, carId: string, price?: number): Result {
  const car = s.garage.find((c) => c.id === carId);
  if (!car) return { state: s, error: "Машина не найдена" };
  const offer = price ?? saleOffer(s, car);
  const profit = offer - (car.boughtFor ?? 0);
  return {
    state: addXp(
      {
        ...s,
        money: s.money + offer,
        garage: s.garage.filter((c) => c.id !== carId),
        stats: {
          ...s.stats,
          carsSold: s.stats.carsSold + 1,
          profit: s.stats.profit + Math.max(0, profit),
        },
      },
      300 + Math.max(0, Math.round(profit / 1000)),
    ),
    message: `Продано за ${fmt(offer)} (${profit >= 0 ? "+" : ""}${fmt(profit)})`,
  };
}

export function repairCar(s: GameState, carId: string): Result {
  const car = s.garage.find((c) => c.id === carId);
  if (!car) return { state: s, error: "Машина не найдена" };
  if (car.condition >= 100) return { state: s, error: "Машина уже в идеале" };
  const cost = repairCost(s, car);
  if (s.money < cost) return { state: s, error: "Не хватает денег" };
  return {
    state: addXp(
      {
        ...s,
        money: s.money - cost,
        garage: s.garage.map((c) => (c.id === carId ? { ...c, condition: 100 } : c)),
        stats: { ...s.stats, repairs: s.stats.repairs + 1 },
      },
      100,
    ),
    message: `${car.name} отремонтирована за ${fmt(cost)}`,
  };
}

export function businessIncome(s: GameState, b: OwnedBusiness): number {
  const t = BUSINESSES.find((x) => x.id === b.typeId);
  if (!t) return 0;
  const ad = s.adUntilDay >= gameDay(s) ? 1.5 : 1;
  return Math.round(t.income * (1 + 0.3 * (b.level - 1)) * (1 + 0.05 * upg(s, "manager")) * (isVip(s) ? 2 : 1) * ad);
}

export function businessUpgradeCost(b: OwnedBusiness): number {
  const t = BUSINESSES.find((x) => x.id === b.typeId)!;
  return Math.round(t.price * 0.5 * b.level);
}

export function buyBusiness(s: GameState, typeId: string): Result {
  const t = BUSINESSES.find((x) => x.id === typeId);
  if (!t) return { state: s, error: "Нет такого бизнеса" };
  if (s.money < t.price) return { state: s, error: "Не хватает денег" };
  return {
    state: addXp({ ...s, money: s.money - t.price, businesses: [...s.businesses, { uid: uid(), typeId, level: 1 }] }, 500),
    message: `Открыт бизнес: ${t.name}`,
  };
}

export function upgradeBusiness(s: GameState, bid: string): Result {
  const b = s.businesses.find((x) => x.uid === bid);
  if (!b) return { state: s, error: "Бизнес не найден" };
  if (b.level >= MAX_BUSINESS_LEVEL) return { state: s, error: "Максимальный уровень" };
  const cost = businessUpgradeCost(b);
  if (s.money < cost) return { state: s, error: "Не хватает денег" };
  return {
    state: addXp(
      { ...s, money: s.money - cost, businesses: s.businesses.map((x) => (x.uid === bid ? { ...x, level: x.level + 1 } : x)) },
      300,
    ),
    message: "Бизнес улучшен",
  };
}

export function sellBusiness(s: GameState, bid: string): Result {
  const b = s.businesses.find((x) => x.uid === bid);
  if (!b) return { state: s, error: "Бизнес не найден" };
  const value = businessValue(b);
  return { state: { ...s, money: s.money + Math.round(value * 0.7), businesses: s.businesses.filter((x) => x.uid !== bid) }, message: `Бизнес продан за ${fmt(Math.round(value * 0.7))}` };
}

export function businessValue(b: OwnedBusiness): number {
  const t = BUSINESSES.find((x) => x.id === b.typeId);
  if (!t) return 0;
  let v = t.price;
  for (let l = 1; l < b.level; l++) v += t.price * 0.5 * l;
  return v;
}

export function upgradeCost(s: GameState, id: string): number {
  const u = UPGRADES.find((x) => x.id === id)!;
  return Math.round(u.base * Math.pow(1.8, upg(s, id)));
}

export function buyUpgrade(s: GameState, id: string): Result {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return { state: s, error: "Нет улучшения" };
  if (upg(s, id) >= u.max) return { state: s, error: "Максимальный уровень" };
  const cost = upgradeCost(s, id);
  if (s.money < cost) return { state: s, error: "Не хватает денег" };
  return { state: addXp({ ...s, money: s.money - cost, upgrades: { ...s.upgrades, [id]: upg(s, id) + 1 } }, 150), message: `${u.name}: уровень ${upg(s, id) + 1}` };
}

/** City with today's half-price "hot" ticket. */
export function hotCity(s: GameState): string {
  const others = CITIES.filter((c) => c.id !== "msk");
  return others[gameDay(s) % others.length]!.id;
}

export function travelPrice(s: GameState, cityId: string): number {
  const c = CITIES.find((x) => x.id === cityId);
  if (!c) return 0;
  const base = Math.max(c.travel, cityOf(s).travel);
  return hotCity(s) === cityId ? Math.round(base / 2) : base;
}

export function travel(s: GameState, cityId: string): Result {
  const c = CITIES.find((x) => x.id === cityId);
  if (!c || c.id === s.cityId) return { state: s, error: "Вы уже здесь" };
  const price = travelPrice(s, cityId);
  if (s.money < price) return { state: s, error: "Не хватает на билет" };
  const next = { ...s, money: s.money - price, cityId, minutes: s.minutes + 180 };
  return { state: addXp({ ...next, listings: generateListings(next) }, 100), message: `Вы прилетели в ${c.name}` };
}

export function netWorth(s: GameState): number {
  const cars = s.garage.reduce((a, c) => a + carValue(c), 0);
  const props = s.properties.reduce((a, id) => a + (PROPERTIES.find((p) => p.id === id)?.price ?? 0), 0);
  const biz = s.businesses.reduce((a, b) => a + businessValue(b), 0);
  const stocks = Object.entries(s.stocks).reduce((a, [id, q]) => a + q * (s.stockPrices[id] ?? 0), 0);
  const plates = s.plates.reduce((a, p) => a + plateValue(p), 0);
  const acc = s.accessories.reduce((a, id) => a + (ACCESSORIES.find((x) => x.id === id)?.price ?? 0), 0);
  return Math.round(s.money + s.deposit - s.loan + cars + props + biz + stocks + plates + acc * 0.7);
}

/** Runs once per game day: businesses, rent, bank interest, taxes, fines, fresh listings. */
export function dailyUpdate(s: GameState, rand = Math.random): { state: GameState; messages: string[] } {
  const messages: string[] = [];
  let money = s.money;
  let gross = 0;
  for (const b of s.businesses) {
    const t = BUSINESSES.find((x) => x.id === b.typeId);
    if (!t) continue;
    const inc = businessIncome(s, b);
    gross += inc;
    money += inc - t.expenses;
    messages.push(`Точка «${t.name}»: +${fmt(inc)}, расходы −${fmt(t.expenses)}`);
  }
  for (const id of s.properties) {
    const p = PROPERTIES.find((x) => x.id === id);
    if (p) {
      const rent = propertyRent(s, id);
      gross += rent;
      money += rent;
    }
  }
  const depositInterest = Math.round(s.deposit * 0.01);
  const loan = Math.round(s.loan * 1.02);
  const taxDue = Math.round(s.taxDue * (s.taxDue > 0 ? 1.03 : 1) + gross * 0.04);
  const fines = [...s.fines];
  if (s.garage.length > 0 && rand() < 0.2) {
    const reasons = ["Превышение скорости", "Парковка на газоне", "Не пропустил пешехода", "Тонировка"];
    fines.push({ id: uid(), reason: reasons[Math.floor(rand() * reasons.length)]!, amount: 500 + Math.floor(rand() * 5) * 1000 });
    messages.push("Пришёл новый штраф в Госуслуги");
  }
  const next: GameState = { ...s, money, deposit: s.deposit + depositInterest, loan, taxDue, fines };
  next.listings = generateListings(next, rand);
  return { state: next, messages };
}

/** Moves stock prices by one random step. */
export function hourlyUpdate(s: GameState, rand = Math.random): GameState {
  const stockPrices = { ...s.stockPrices };
  const stockHistory: Record<string, number[]> = {};
  for (const st of STOCKS) {
    const p = stockPrices[st.id] ?? st.start;
    const drift = (st.start - p) / st.start * 0.01; // gentle mean reversion
    const change = (rand() * 2 - 1) * st.vol + drift;
    stockPrices[st.id] = Math.max(1, Math.round(p * (1 + change) * 100) / 100);
    stockHistory[st.id] = [...(s.stockHistory?.[st.id] ?? []), stockPrices[st.id]!].slice(-24);
  }
  return { ...s, stockPrices, stockHistory };
}

export function advance(s: GameState, gameMinutes: number): { state: GameState; messages: string[] } {
  let state = s;
  const messages: string[] = [];
  const target = s.minutes + gameMinutes;
  while (state.minutes < target) {
    const nextHour = (Math.floor(state.minutes / 60) + 1) * 60;
    if (nextHour > target) {
      state = { ...state, minutes: target };
      break;
    }
    state = hourlyUpdate({ ...state, minutes: nextHour });
    if (nextHour % 1440 === 0) {
      const r = dailyUpdate(state);
      state = r.state;
      messages.push(...r.messages);
    }
  }
  return { state, messages };
}

export function startJob(
  s: GameState,
  kind: Job["kind"],
  opt: { id: string; name: string; pay: number; seconds: number },
  now = Date.now(),
): Result {
  if (s.job) return { state: s, error: "Сначала закончи текущую работу" };
  const bonus = kind === "delivery" ? upg(s, "logistics") : upg(s, "charisma");
  const pay = Math.round(opt.pay * (1 + 0.2 * bonus));
  return { state: { ...s, job: { kind, id: opt.id, name: opt.name, pay, endAt: now + opt.seconds * 1000 } }, message: `Начато: ${opt.name}` };
}

export function finishJob(s: GameState, now = Date.now()): Result {
  const j = s.job;
  if (!j) return { state: s, error: "Нет активной работы" };
  if (now < j.endAt) return { state: s, error: "Ещё не готово" };
  const stats = { ...s.stats };
  if (j.kind === "delivery") stats.deliveries += 1;
  else stats.shifts += 1;
  return { state: addXp({ ...s, money: s.money + j.pay, job: undefined, stats }, 80), message: `Получено ${fmt(j.pay)}` };
}

export type Quest = { id: string; title: string; reward: number; progress: (s: GameState) => [number, number] };

export const QUESTS: Quest[] = [
  { id: "q-buy1", title: "Купи первую машину", reward: 50_000, progress: (s) => [s.stats.carsBought, 1] },
  { id: "q-sell3", title: "Перепродай 3 машины", reward: 150_000, progress: (s) => [s.stats.carsSold, 3] },
  { id: "q-repair5", title: "Отремонтируй 5 машин", reward: 200_000, progress: (s) => [s.stats.repairs, 5] },
  { id: "q-deliv10", title: "Выполни 10 доставок", reward: 100_000, progress: (s) => [s.stats.deliveries, 10] },
  { id: "q-shift10", title: "Отработай 10 смен", reward: 120_000, progress: (s) => [s.stats.shifts, 10] },
  { id: "q-biz1", title: "Открой первый бизнес", reward: 200_000, progress: (s) => [s.businesses.length, 1] },
  { id: "q-biz5", title: "Владей 5 бизнесами", reward: 2_000_000, progress: (s) => [s.businesses.length, 5] },
  { id: "q-profit1m", title: "Заработай 1 000 000 ₽ на перепродаже", reward: 300_000, progress: (s) => [s.stats.profit, 1_000_000] },
  { id: "q-license", title: "Получи права", reward: 30_000, progress: (s) => [s.license ? 1 : 0, 1] },
  { id: "q-home", title: "Купи недвижимость", reward: 250_000, progress: (s) => [s.properties.length, 1] },
  { id: "q-rich", title: "Капитал 100 млн ₽", reward: 5_000_000, progress: (s) => [netWorth(s), 100_000_000] },
];

export function claimQuest(s: GameState, id: string): Result {
  const q = QUESTS.find((x) => x.id === id);
  if (!q || s.questsClaimed.includes(id)) return { state: s, error: "Награда уже получена" };
  const [p, t] = q.progress(s);
  if (p < t) return { state: s, error: "Задание ещё не выполнено" };
  return { state: addXp({ ...s, money: s.money + q.reward, questsClaimed: [...s.questsClaimed, id] }, 500), message: `Награда: ${fmt(q.reward)}` };
}

/** Delivers a purchased shop item (or admin action) into the game. Each grant id is applied once. */
export function applyGrant(s: GameState, grantId: string, itemId: string, amount?: number | null): Result {
  if (s.appliedGrants.includes(grantId)) return { state: s };
  let next: GameState = { ...s, appliedGrants: [...s.appliedGrants, grantId] };
  let message = "";
  switch (itemId) {
    case "admin-money": {
      const a = Math.round(Number(amount ?? 0));
      next.money = Math.max(0, next.money + a);
      message = a >= 0 ? `Администрация начислила ${fmt(a)}` : `Администрация списала ${fmt(-a)}`;
      break;
    }
    case "admin-vip": {
      const days = Math.max(1, Math.round(Number(amount ?? 30)));
      next.vipUntilDay = Math.max(next.vipUntilDay, gameDay(next)) + days;
      message = `Администрация выдала VIP на ${days} дн.`;
      break;
    }
    case "admin-xp": {
      const xp = Math.max(0, Math.round(Number(amount ?? 0)));
      next.xp += xp;
      message = `Администрация выдала ${xp.toLocaleString("ru-RU")} опыта`;
      break;
    }
    case "admin-clear-debts":
      next.fines = [];
      next.taxDue = 0;
      next.loan = 0;
      message = "Администрация списала штрафы, налоги и кредит";
      break;
    case "admin-reset":
      next = { ...newGame(), appliedGrants: [...s.appliedGrants, grantId] };
      message = "Администрация сбросила ваш прогресс";
      break;
    case "pack-start":
      next.money += 1_000_000;
      message = "Зачислено 1 000 000 ₽";
      break;
    case "pack-case":
      next.money += 10_000_000;
      message = "Зачислено 10 000 000 ₽";
      break;
    case "pack-safe":
      next.money += 100_000_000;
      message = "Зачислено 100 000 000 ₽";
      break;
    case "vip-30":
      next.vipUntilDay = Math.max(next.vipUntilDay, gameDay(next)) + 30;
      message = "VIP активирован на 30 дней";
      break;
    case "car-wert":
      next.garage = [
        ...next.garage,
        { id: uid(), modelId: "wert", name: "Lamborghini WERT Edition", year: CURRENT_YEAR, mileage: 0, condition: 100 },
      ];
      message = "Lamborghini WERT Edition в гараже";
      break;
    case "plate-wert":
      next.plates = [...next.plates, "W777RT"];
      message = "Номер W777RT добавлен";
      break;
    case "wp-gold":
      if (!next.accessories.includes("wp-gold")) next.accessories = [...next.accessories, "wp-gold"];
      next.wallpaper = "wp-gold";
      message = "Золотые обои установлены";
      break;
    default:
      if (itemId.startsWith("admin-car:")) {
        const m = CAR_MODELS.find((x) => x.id === itemId.slice("admin-car:".length));
        if (m) {
          next.garage = [...next.garage, { id: uid(), modelId: m.id, name: m.name, year: CURRENT_YEAR, mileage: 0, condition: 100 }];
          message = `Администрация выдала машину: ${m.name}`;
          break;
        }
      }
      next = { ...s, appliedGrants: [...s.appliedGrants, grantId] };
  }
  return { state: next, message };
}

export function newPlateOffers(rand = Math.random) {
  return Array.from({ length: 6 }, () => {
    const p = randomPlate(rand);
    return { plate: p, price: Math.round(plateValue(p) * (0.9 + rand() * 0.3)) };
  });
}

export function fmt(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("ru-RU").replace(/,/g, " ")} ₽`;
}

export function fmtShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1)} млрд ₽`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)} млн ₽`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)} тыс ₽`;
  return `${sign}${Math.round(a)} ₽`;
}


// ============= Extra app features =============

export type Negotiation = { state: GameState; reply: string; outcome: "deal" | "counter" | "angry" | "closed" };

/** Haggle with the seller of a listing. `roll` (0..1) adds a bit of luck to the seller's mood. */
export function negotiate(s: GameState, listingId: string, offer: number, roll: number): Negotiation {
  const l = s.listings.find((x) => x.id === listingId);
  if (!l) return { state: s, reply: "Объявление уже снято.", outcome: "closed" };
  const tries = l.tries ?? 3;
  const floor = l.floor ?? l.price;
  const update = (patch: Partial<Listing>): GameState => ({
    ...s,
    listings: s.listings.map((x) => (x.id === listingId ? { ...x, ...patch } : x)),
  });
  if (tries <= 0) return { state: s, reply: "Я сказал своё последнее слово. Цена окончательная.", outcome: "closed" };
  if (!offer || offer <= 0) return { state: s, reply: "Назовите сумму.", outcome: "counter" };
  if (offer >= l.price) return { state: update({ tries: 0 }), reply: `Так это и есть моя цена — ${fmt(l.price)}. Приезжай, забирай!`, outcome: "deal" };
  // Lucky roll lets a slightly-low offer through
  const effectiveFloor = roll > 0.85 ? Math.round(floor * 0.97) : floor;
  if (offer >= effectiveFloor) {
    return { state: update({ price: offer, tries: 0 }), reply: `Эх, ладно, договорились! Отдаю за ${fmt(offer)}.`, outcome: "deal" };
  }
  if (offer < floor * 0.7) {
    const price = Math.round((l.price * 1.05) / 1000) * 1000;
    return { state: update({ price, tries: 0 }), reply: `Ты издеваешься? За ${fmt(offer)}? Теперь цена ${fmt(price)}, и торга не будет.`, outcome: "angry" };
  }
  const counter = Math.max(floor, Math.round(((l.price + Math.max(offer, floor)) / 2) / 1000) * 1000);
  const left = tries - 1;
  return {
    state: update({ price: counter, tries: left }),
    reply: left > 0 ? `Мало. Могу отдать за ${fmt(counter)}, не меньше.` : `Последнее предложение — ${fmt(counter)}. Дальше не торгуюсь.`,
    outcome: "counter",
  };
}

/** Canned seller answers to common buyer questions. */
export function sellerAnswer(l: Listing, q: "mileage" | "accident" | "owners" | "docs"): string {
  const seed = l.id.charCodeAt(0) + l.id.charCodeAt(1);
  switch (q) {
    case "mileage":
      return seed % 3 === 0 ? `По одометру ${l.mileage.toLocaleString("ru-RU")} км, но честно — может, и больше.` : `Пробег родной, ${l.mileage.toLocaleString("ru-RU")} км. Не скручен!`;
    case "accident":
      return l.condition < 50 ? "Была небольшая авария, крыло крашено. Но едет отлично!" : "Не бита, не крашена. Сам на ней ездил.";
    case "owners":
      return `${1 + (seed % 4)} владельца по ПТС.`;
    case "docs":
      return seed % 5 === 0 ? "ПТС дубликат, но всё чисто, без ограничений." : "Оригинал ПТС, ограничений нет, можно проверить.";
  }
}

export const DAILY_BONUS_PER_LEVEL = 10_000;

export function claimDailyBonus(s: GameState): Result {
  const day = gameDay(s);
  if (s.lastBonusDay >= day) return { state: s, error: "Бонус уже получен сегодня" };
  const amount = DAILY_BONUS_PER_LEVEL * level(s);
  return { state: { ...s, money: s.money + amount, lastBonusDay: day }, message: `Ежедневный бонус: +${fmt(amount)}` };
}

/** Finish the current delivery right now, paying 25% of the reward for the rush. */
export function rushJob(s: GameState): Result {
  const j = s.job;
  if (!j) return { state: s, error: "Нет активной работы" };
  const fee = Math.round(j.pay * 0.25);
  const stats = { ...s.stats };
  if (j.kind === "delivery") stats.deliveries += 1;
  else stats.shifts += 1;
  return { state: addXp({ ...s, money: s.money + j.pay - fee, job: undefined, stats }, 40), message: `Срочно выполнено: +${fmt(j.pay - fee)}` };
}

export const TAP_PAY_PER_LEVEL = 150;

/** Side gig: each tap pays a small amount that grows with level. */
export function tapWork(s: GameState): GameState {
  return { ...s, money: s.money + TAP_PAY_PER_LEVEL * level(s), xp: s.xp + 2 };
}

export function buyoutPrice(car: Car): number {
  return Math.round((carValue(car) * 1.3) / 1000) * 1000;
}

export function buyoutLot(s: GameState, car: Car): Result {
  const price = buyoutPrice(car);
  if (s.money < price) return { state: s, error: "Не хватает денег на выкуп" };
  if (s.garage.length >= garageCapacity(s)) return { state: s, error: "Гараж заполнен" };
  return {
    state: addXp({ ...s, money: s.money - price, garage: [...s.garage, { ...car, boughtFor: price }], stats: { ...s.stats, carsBought: s.stats.carsBought + 1 } }, 200),
    message: `Выкуплено: ${car.name} за ${fmt(price)}`,
  };
}

export function repairAll(s: GameState): Result {
  let state = s;
  let count = 0;
  let spent = 0;
  for (const c of s.garage) {
    if (c.condition >= 100) continue;
    const cost = repairCost(state, c);
    const r = repairCar(state, c.id);
    if (r.error) continue;
    state = r.state;
    spent += cost;
    count++;
  }
  if (count === 0) return { state: s, error: "Нечего ремонтировать или не хватает денег" };
  return { state, message: `Отремонтировано машин: ${count} за ${fmt(spent)}` };
}

/** Appeal a fine: 50% it's cancelled, otherwise it grows by half. Each fine can be appealed once. */
export function disputeFine(s: GameState, fineId: string, roll: number): Result {
  const f = s.fines.find((x) => x.id === fineId);
  if (!f) return { state: s, error: "Штраф не найден" };
  if (f.disputed) return { state: s, error: "Этот штраф уже обжалован" };
  if (roll < 0.5) return { state: { ...s, fines: s.fines.filter((x) => x.id !== fineId) }, message: "Суд на вашей стороне — штраф отменён!" };
  return {
    state: { ...s, fines: s.fines.map((x) => (x.id === fineId ? { ...x, amount: Math.round(x.amount * 1.5), disputed: true } : x)) },
    message: "Жалобу отклонили — штраф вырос на 50%",
  };
}

/** Buy the cheapest affordable upgrade levels until money runs out. */
export function buyAllUpgrades(s: GameState): Result {
  let state = s;
  let bought = 0;
  for (;;) {
    const options = UPGRADES.filter((u) => upg(state, u.id) < u.max).map((u) => ({ u, cost: upgradeCost(state, u.id) }));
    options.sort((a, b) => a.cost - b.cost);
    const next = options[0];
    if (!next || next.cost > state.money) break;
    state = buyUpgrade(state, next.u.id).state;
    bought++;
  }
  if (bought === 0) return { state: s, error: "Не хватает денег ни на одно улучшение" };
  return { state, message: `Куплено уровней улучшений: ${bought}` };
}

export function sellAccessory(s: GameState, id: string): Result {
  const a = ACCESSORIES.find((x) => x.id === id);
  if (!a || !s.accessories.includes(id)) return { state: s, error: "У вас нет этой вещи" };
  const price = Math.round(a.price * 0.7);
  return {
    state: { ...s, money: s.money + price, accessories: s.accessories.filter((x) => x !== id), wallpaper: s.wallpaper === id ? "default" : s.wallpaper },
    message: `${a.name} продан за ${fmt(price)}`,
  };
}

export function claimAllQuests(s: GameState): Result {
  let state = s;
  let total = 0;
  for (const q of QUESTS) {
    const r = claimQuest(state, q.id);
    if (r.error) continue;
    total += q.reward;
    state = r.state;
  }
  if (total === 0) return { state: s, error: "Нет готовых наград" };
  return { state, message: `Получено наград: ${fmt(total)}` };
}

/** Order a plate with the chosen 3 digits. Costs double its value. */
export function orderPlate(s: GameState, digits: string, rand = Math.random): Result {
  if (!/^\d{3}$/.test(digits)) return { state: s, error: "Введите 3 цифры" };
  const base = randomPlate(rand);
  const plate = `${base[0]}${digits}${base.slice(4)}`;
  const price = plateValue(plate) * 2;
  if (s.money < price) return { state: s, error: `Нужно ${fmt(price)}` };
  return { state: { ...s, money: s.money - price, plates: [...s.plates, plate] }, message: `Изготовлен номер ${plate} за ${fmt(price)}` };
}

export function propertyRent(s: GameState, id: string): number {
  const p = PROPERTIES.find((x) => x.id === id);
  if (!p) return 0;
  return Math.round(p.rent * (s.renovated?.includes(id) ? 1.25 : 1));
}

export function renovationCost(id: string): number {
  return Math.round((PROPERTIES.find((x) => x.id === id)?.price ?? 0) * 0.3);
}

/** Renovation raises a property's rent by 25%. */
export function renovate(s: GameState, id: string): Result {
  if (!s.properties.includes(id)) return { state: s, error: "Сначала купите объект" };
  if (s.renovated.includes(id)) return { state: s, error: "Ремонт уже сделан" };
  const cost = renovationCost(id);
  if (s.money < cost) return { state: s, error: "Не хватает денег" };
  return { state: addXp({ ...s, money: s.money - cost, renovated: [...s.renovated, id] }, 200), message: "Ремонт готов: аренда +25%" };
}

export function adCampaignCost(s: GameState): number {
  const base = s.businesses.reduce((a, b) => {
    const t = BUSINESSES.find((x) => x.id === b.typeId);
    return a + (t ? t.income * (1 + 0.3 * (b.level - 1)) : 0);
  }, 0);
  return Math.round((base * 0.4) / 1000) * 1000;
}

/** Advertising: +50% business income at the next daily payout. */
export function adCampaign(s: GameState): Result {
  if (s.businesses.length === 0) return { state: s, error: "Нет бизнесов для рекламы" };
  if (s.adUntilDay > gameDay(s)) return { state: s, error: "Реклама уже запущена" };
  const cost = adCampaignCost(s);
  if (s.money < cost) return { state: s, error: "Не хватает денег на рекламу" };
  return { state: { ...s, money: s.money - cost, adUntilDay: gameDay(s) + 1 }, message: "Реклама запущена: завтра доход бизнесов +50%" };
}

export const WHEEL = [0, 1.5, 0, 2, 0, 0.5, 0, 1.5, 0, 5, 0, 0.5];


// ============= Workshop services (30 s each) =============
export const SERVICE_SECONDS = 30;
export const SERVICES = [
  { id: "paint", name: "Перекраска", cost: 0.03, bonus: 0.08 },
  { id: "polish", name: "Полировка", cost: 0.01, bonus: 0.03 },
  { id: "engine", name: "Замена двигателя", cost: 0.08, bonus: 0.15 },
  { id: "interior", name: "Химчистка салона", cost: 0.01, bonus: 0.03 },
  { id: "tint", name: "Тонировка", cost: 0.005, bonus: 0.02 },
  { id: "wheels", name: "Новые диски", cost: 0.03, bonus: 0.06 },
];

export function serviceCost(car: Car, serviceId: string): number {
  const sv = SERVICES.find((x) => x.id === serviceId);
  return sv ? Math.round((modelOf(car.modelId).base * sv.cost) / 100) * 100 : 0;
}

export function startService(s: GameState, carId: string, serviceId: string, now = Date.now()): Result {
  const car = s.garage.find((c) => c.id === carId);
  const sv = SERVICES.find((x) => x.id === serviceId);
  if (!car || !sv) return { state: s, error: "Не найдено" };
  if (car.inService) return { state: s, error: "Машина уже в работе" };
  if (car.services?.includes(serviceId)) return { state: s, error: "Уже сделано" };
  const cost = serviceCost(car, serviceId);
  if (s.money < cost) return { state: s, error: "Не хватает денег" };
  return {
    state: { ...s, money: s.money - cost, garage: s.garage.map((c) => (c.id === carId ? { ...c, inService: { id: serviceId, endAt: now + SERVICE_SECONDS * 1000 } } : c)) },
    message: `${sv.name}: машина в работе ${SERVICE_SECONDS} с`,
  };
}

export function finishService(s: GameState, carId: string, now = Date.now()): Result {
  const car = s.garage.find((c) => c.id === carId);
  if (!car?.inService) return { state: s, error: "Нет работы" };
  if (now < car.inService.endAt) return { state: s, error: "Ещё не готово" };
  const sv = SERVICES.find((x) => x.id === car.inService!.id)!;
  const condition = sv.id === "engine" ? Math.min(100, car.condition + 20) : car.condition;
  return {
    state: addXp({ ...s, garage: s.garage.map((c) => (c.id === carId ? { ...c, condition, inService: undefined, services: [...(c.services ?? []), sv.id] } : c)) }, 80),
    message: `${sv.name} готова: ${car.name} подорожала на ${Math.round(sv.bonus * 100)}%`,
  };
}
