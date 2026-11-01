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
  plate?: string;
  boughtFor?: number;
};
export type Listing = Car & { price: number };
export type OwnedBusiness = { uid: string; typeId: string; level: number };
export type Fine = { id: string; reason: string; amount: number };

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
  job?: Job;
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
export const cityOf = (s: GameState) => CITIES.find((c) => c.id === s.cityId) ?? CITIES[0];
export const modelOf = (id: string): CarModel => CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0];

export function carValue(car: Car): number {
  const m = modelOf(car.modelId);
  const age = Math.max(0, CURRENT_YEAR - car.year);
  const ageF = m.rare ? Math.max(0.6, 1 - age * 0.01) : Math.max(0.2, Math.pow(0.93, age));
  const condF = 0.35 + 0.65 * (car.condition / 100);
  const mileF = Math.max(0.5, 1 - car.mileage / 600_000);
  return Math.round(m.base * ageF * condF * mileF) + (car.plate ? plateValue(car.plate) : 0);
}

export function garageCapacity(s: GameState): number {
  const fromProps = s.properties.reduce((a, id) => a + (PROPERTIES.find((p) => p.id === id)?.garageSlots ?? 0), 0);
  return 2 + upg(s, "garage") + fromProps + (isVip(s) ? 2 : 0);
}

function randomCar(rand: () => number, allowRare: boolean): Car {
  const pool = CAR_MODELS.filter((m) => (allowRare ? m.rare : !m.rare) && m.id !== "wert");
  const m = pool[Math.floor(rand() * pool.length)];
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
    return { ...car, price: Math.round((carValue(car) * city.buy * bonus * spread * discount) / 1000) * 1000 };
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
  const { price, ...car } = l;
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
  return Math.round(t.income * (1 + 0.3 * (b.level - 1)) * (1 + 0.05 * upg(s, "manager")) * (isVip(s) ? 2 : 1));
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

export function travel(s: GameState, cityId: string): Result {
  const c = CITIES.find((x) => x.id === cityId);
  if (!c || c.id === s.cityId) return { state: s, error: "Вы уже здесь" };
  const price = Math.max(c.travel, cityOf(s).travel);
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
      gross += p.rent;
      money += p.rent;
    }
  }
  const depositInterest = Math.round(s.deposit * 0.01);
  const loan = Math.round(s.loan * 1.02);
  const taxDue = Math.round(s.taxDue * (s.taxDue > 0 ? 1.03 : 1) + gross * 0.04);
  const fines = [...s.fines];
  if (s.garage.length > 0 && rand() < 0.2) {
    const reasons = ["Превышение скорости", "Парковка на газоне", "Не пропустил пешехода", "Тонировка"];
    fines.push({ id: uid(), reason: reasons[Math.floor(rand() * reasons.length)], amount: 500 + Math.floor(rand() * 5) * 1000 });
    messages.push("Пришёл новый штраф в Госуслуги");
  }
  const next: GameState = { ...s, money, deposit: s.deposit + depositInterest, loan, taxDue, fines };
  next.listings = generateListings(next, rand);
  return { state: next, messages };
}

/** Moves stock prices by one random step. */
export function hourlyUpdate(s: GameState, rand = Math.random): GameState {
  const stockPrices = { ...s.stockPrices };
  for (const st of STOCKS) {
    const p = stockPrices[st.id] ?? st.start;
    const drift = (st.start - p) / st.start * 0.01; // gentle mean reversion
    const change = (rand() * 2 - 1) * st.vol + drift;
    stockPrices[st.id] = Math.max(1, Math.round(p * (1 + change) * 100) / 100);
  }
  return { ...s, stockPrices };
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

/** Delivers a purchased shop item into the game. Each grant id is applied once. */
export function applyGrant(s: GameState, grantId: string, itemId: string): Result {
  if (s.appliedGrants.includes(grantId)) return { state: s };
  let next: GameState = { ...s, appliedGrants: [...s.appliedGrants, grantId] };
  let message = "";
  switch (itemId) {
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
