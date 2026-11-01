// Static catalogs for wertперекуп. All prices are in in-game rubles.

export type CarModel = {
  id: string;
  name: string;
  base: number; // value of a new car in perfect condition
  rare?: boolean;
  origin: "ru" | "eu" | "jp" | "us";
};

export const CAR_MODELS: CarModel[] = [
  { id: "vaz2107", name: "ВАЗ 2107", base: 180_000, origin: "ru" },
  { id: "priora", name: "Lada Priora", base: 320_000, origin: "ru" },
  { id: "vesta", name: "Lada Vesta", base: 1_100_000, origin: "ru" },
  { id: "solaris", name: "Hyundai Solaris", base: 1_300_000, origin: "jp" },
  { id: "polo", name: "VW Polo", base: 1_250_000, origin: "eu" },
  { id: "camry", name: "Toyota Camry", base: 3_200_000, origin: "jp" },
  { id: "mark2", name: "Toyota Mark II", base: 900_000, origin: "jp" },
  { id: "skyline", name: "Nissan Skyline", base: 2_400_000, origin: "jp" },
  { id: "bmw5", name: "BMW M5", base: 9_500_000, origin: "eu" },
  { id: "e63", name: "Mercedes E63", base: 10_500_000, origin: "eu" },
  { id: "rs6", name: "Audi RS6", base: 12_000_000, origin: "eu" },
  { id: "lc200", name: "Land Cruiser 200", base: 7_500_000, origin: "jp" },
  { id: "mustang", name: "Ford Mustang", base: 5_500_000, origin: "us" },
  { id: "tesla", name: "Tesla Model S", base: 8_000_000, origin: "us" },
  { id: "g63", name: "Mercedes G63", base: 22_000_000, origin: "eu", rare: true },
  { id: "urus", name: "Lamborghini Urus", base: 32_000_000, origin: "eu", rare: true },
  { id: "f40", name: "Ferrari F40", base: 85_000_000, origin: "eu", rare: true },
  { id: "supra", name: "Toyota Supra A80", base: 9_000_000, origin: "jp", rare: true },
  { id: "wert", name: "Lamborghini WERT Edition", base: 60_000_000, origin: "eu", rare: true },
];

export type City = {
  id: string;
  name: string;
  buy: number; // multiplier on listing prices
  sell: number; // multiplier on sale offers
  travel: number; // ticket price
  bonus?: CarModel["origin"]; // cheaper cars of this origin
};

export const CITIES: City[] = [
  { id: "msk", name: "Москва", buy: 1.08, sell: 1.12, travel: 0 },
  { id: "spb", name: "Санкт-Петербург", buy: 1.0, sell: 1.05, travel: 8_000, bonus: "eu" },
  { id: "kzn", name: "Казань", buy: 0.95, sell: 0.98, travel: 6_000 },
  { id: "sochi", name: "Сочи", buy: 1.05, sell: 1.1, travel: 12_000, bonus: "us" },
  { id: "nsk", name: "Новосибирск", buy: 0.9, sell: 0.93, travel: 15_000 },
  { id: "vdk", name: "Владивосток", buy: 0.85, sell: 0.9, travel: 25_000, bonus: "jp" },
];

export type BusinessType = {
  id: string;
  name: string;
  price: number;
  income: number; // per game day at level 1
  expenses: number; // per game day
};

export const BUSINESSES: BusinessType[] = [
  { id: "kiosk", name: "Ларёк с шаурмой", price: 400_000, income: 14_000, expenses: 4_500 },
  { id: "island", name: "Островок в ТЦ", price: 900_000, income: 26_000, expenses: 3_600 },
  { id: "pvz", name: "Пункт выдачи заказов", price: 1_500_000, income: 42_000, expenses: 12_000 },
  { id: "wash", name: "Автомойка", price: 2_500_000, income: 70_000, expenses: 18_000 },
  { id: "barber", name: "Барбершоп", price: 3_200_000, income: 85_000, expenses: 22_000 },
  { id: "coffee", name: "Кофейня", price: 4_000_000, income: 105_000, expenses: 30_000 },
  { id: "sto", name: "СТО", price: 7_000_000, income: 190_000, expenses: 55_000 },
  { id: "restaurant", name: "Ресторан", price: 15_000_000, income: 380_000, expenses: 120_000 },
  { id: "salon", name: "Автосалон", price: 40_000_000, income: 950_000, expenses: 300_000 },
  { id: "factory", name: "Завод", price: 120_000_000, income: 2_800_000, expenses: 900_000 },
];

export const MAX_BUSINESS_LEVEL = 5;

export type Property = {
  id: string;
  name: string;
  price: number;
  rent: number; // per game day
  garageSlots?: number;
};

export const PROPERTIES: Property[] = [
  { id: "garage", name: "Гаражный бокс", price: 350_000, rent: 3_000, garageSlots: 2 },
  { id: "room", name: "Комната в общаге", price: 1_200_000, rent: 9_000 },
  { id: "studio", name: "Студия", price: 4_500_000, rent: 30_000 },
  { id: "flat2", name: "2-к квартира", price: 9_000_000, rent: 55_000 },
  { id: "parking", name: "Подземный паркинг", price: 6_000_000, rent: 20_000, garageSlots: 5 },
  { id: "house", name: "Загородный дом", price: 25_000_000, rent: 140_000, garageSlots: 3 },
  { id: "office", name: "Офис в Москва-Сити", price: 60_000_000, rent: 380_000 },
  { id: "penthouse", name: "Пентхаус", price: 150_000_000, rent: 900_000, garageSlots: 4 },
];

export type Stock = { id: string; name: string; start: number; vol: number };

export const STOCKS: Stock[] = [
  { id: "WERT", name: "wert Holding", start: 1_000, vol: 0.05 },
  { id: "GZPR", name: "Газпрум", start: 160, vol: 0.025 },
  { id: "SBRB", name: "Сбербанкъ", start: 300, vol: 0.02 },
  { id: "YNDX", name: "Яндекс-Тачки", start: 4_000, vol: 0.035 },
  { id: "AVTO", name: "АвтоВАЗ", start: 70, vol: 0.04 },
  { id: "BTC", name: "Биткоин", start: 6_000_000, vol: 0.07 },
];

export type Upgrade = { id: string; name: string; desc: string; base: number; max: number };

export const UPGRADES: Upgrade[] = [
  { id: "haggle", name: "Торг", desc: "+3% к цене продажи за уровень", base: 150_000, max: 10 },
  { id: "network", name: "Связи", desc: "−2% к ценам объявлений за уровень", base: 200_000, max: 10 },
  { id: "mechanic", name: "Свой механик", desc: "−10% к стоимости ремонта за уровень", base: 120_000, max: 5 },
  { id: "logistics", name: "Логистика", desc: "+20% к оплате доставки за уровень", base: 80_000, max: 10 },
  { id: "charisma", name: "Харизма", desc: "+20% к зарплате за смену", base: 80_000, max: 10 },
  { id: "manager", name: "Управляющий", desc: "+5% к доходу бизнесов за уровень", base: 1_000_000, max: 10 },
  { id: "garage", name: "Расширение гаража", desc: "+1 место в гараже", base: 250_000, max: 10 },
];

export type Accessory = { id: string; name: string; price: number; kind: "item" | "wallpaper" };

export const ACCESSORIES: Accessory[] = [
  { id: "case", name: "Чехол wert", price: 3_000, kind: "item" },
  { id: "airpods", name: "Наушники", price: 25_000, kind: "item" },
  { id: "glasses", name: "Очки Ray-Ban", price: 40_000, kind: "item" },
  { id: "chain", name: "Золотая цепь", price: 350_000, kind: "item" },
  { id: "rolex", name: "Часы Rolex", price: 2_500_000, kind: "item" },
  { id: "jacket", name: "Куртка Stone Island", price: 120_000, kind: "item" },
  { id: "wp-neon", name: "Обои «Неон»", price: 15_000, kind: "wallpaper" },
  { id: "wp-ocean", name: "Обои «Океан»", price: 15_000, kind: "wallpaper" },
  { id: "wp-sunset", name: "Обои «Закат»", price: 15_000, kind: "wallpaper" },
];

export const WALLPAPERS: Record<string, string> = {
  default: "wp-default",
  "wp-neon": "wp-neon",
  "wp-ocean": "wp-ocean",
  "wp-sunset": "wp-sunset",
  "wp-gold": "wp-gold",
};

export const JOBS = [
  { id: "courier", name: "Курьер", pay: 6_000, seconds: 10 },
  { id: "washer", name: "Мойщик на автомойке", pay: 9_000, seconds: 15 },
  { id: "mechanic", name: "Автомеханик", pay: 18_000, seconds: 25, minLevel: 3 },
  { id: "manager", name: "Менеджер автосалона", pay: 40_000, seconds: 40, minLevel: 6 },
];

export const DELIVERIES = [
  { id: "short", name: "По району", pay: 4_000, seconds: 8 },
  { id: "city", name: "Через весь город", pay: 11_000, seconds: 18 },
  { id: "region", name: "В область", pay: 28_000, seconds: 35, needsLicense: true },
  { id: "intercity", name: "Межгород на фуре", pay: 70_000, seconds: 60, needsLicense: true },
];

const LETTERS = "АВЕКМНОРСТУХ";
export function randomPlate(rand = Math.random): string {
  const l = () => LETTERS[Math.floor(rand() * LETTERS.length)];
  const d = () => Math.floor(rand() * 10);
  return `${l()}${d()}${d()}${d()}${l()}${l()}`;
}

/** Plate value grows with repeated digits/letters (e.g. А777АА). */
export function plateValue(plate: string): number {
  const digits = plate.slice(1, 4);
  const letters = plate[0] + plate.slice(4, 6);
  let v = 15_000;
  if (digits[0] === digits[1] && digits[1] === digits[2]) v *= 12;
  else if (digits[0] === digits[1] || digits[1] === digits[2]) v *= 2;
  if (digits === "777" || digits === "001" || digits === "007") v *= 3;
  if (letters[0] === letters[1] && letters[1] === letters[2]) v *= 6;
  if (plate.includes("W")) v *= 10;
  return v;
}
