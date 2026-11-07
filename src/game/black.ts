// WERTOOS BLACK: premium shop, dealer chats, black-series cars and the deals leaderboard.
// Everything here is a pure function over GameState, like the rest of the engine.

import { BLACK_ITEMS, BLACK_SELLERS, BOTS, randomPlate, type BlackItem, type BlackSeller, type BotPlayer } from "./data";
import {
  CURRENT_YEAR,
  blackOf,
  dealsCount,
  gameDay,
  garageCapacity,
  modelOf,
  pushDeal,
  type BlackChatMsg,
  type BlackSellerState,
  type Car,
  type GameState,
  type Result,
} from "./engine";

export const blackItem = (id: string): BlackItem | undefined => BLACK_ITEMS.find((i) => i.id === id);
export const blackSeller = (id: string): BlackSeller | undefined => BLACK_SELLERS.find((s) => s.id === id);
export const sellerChat = (s: GameState, sellerId: string): BlackSellerState | null =>
  blackOf(s).sellers[sellerId] ?? null;

/** Asking price for a black-series car at a given dealer. */
export function blackCarPrice(sellerId: string, carId: string): number {
  const seller = blackSeller(sellerId);
  const discount = seller?.discount ?? 0.15;
  return Math.round((modelOf(carId).base * (1 - discount)) / 1000) * 1000;
}

/** Lowest price a dealer will ever accept (never revealed to the player). */
const sellerFloor = (sellerId: string, carId: string): number =>
  Math.round((blackCarPrice(sellerId, carId) * 0.93) / 1000) * 1000;

/** Fresh black-series car handed over after a successful deal. */
export function makeBlackCar(carId: string, rand: () => number = Math.random): Car {
  const m = modelOf(carId);
  return {
    id: `bk${Math.floor(rand() * 1e9).toString(36)}`,
    modelId: m.id,
    name: m.name,
    year: CURRENT_YEAR - Math.floor(rand() * 3),
    mileage: Math.round((2_000 + rand() * 18_000) / 100) * 100,
    condition: 92 + Math.round(rand() * 8),
    plate: randomPlate(rand),
  };
}

/** Numbers from a free-form message: «5 000 000», «5млн», «900 тыс». */
export function parseOffer(text: string): number | null {
  // «5 000 000» and «18 млн» both collapse to a single number.
  const t = text.toLowerCase().replace(/\u00a0/g, " ").replace(/\s+/g, "");
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  let n = Number.parseFloat(m[1]!.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/млн|лям/.test(t)) n *= 1_000_000;
  else if (/тыс/.test(t)) n *= 1_000;
  return Math.round(n);
}

const appendMsg = (
  s: GameState,
  sellerId: string,
  from: BlackChatMsg["from"],
  text: string,
  patch: Partial<BlackSellerState> = {},
): GameState => {
  const b = blackOf(s);
  const prev = b.sellers[sellerId]!;
  return {
    ...s,
    black: {
      ...b,
      sellers: {
        ...b.sellers,
        [sellerId]: { ...prev, ...patch, messages: [...prev.messages, { from, text, at: s.minutes }] },
      },
    },
  };
};

/** Start (or reopen) a chat with a dealer about one of his cars. */
export function openSellerChat(s: GameState, sellerId: string, carId: string): GameState {
  const seller = blackSeller(sellerId);
  if (!seller || !seller.cars.includes(carId)) return s;
  const b = blackOf(s);
  const existing = b.sellers[sellerId];
  if (existing && existing.carId === carId) return s;
  const fresh: BlackSellerState = {
    sellerId,
    carId,
    messages: [...(existing?.messages ?? []), { from: "seller", text: seller.greeting, at: s.minutes }],
    offer: null,
    tries: 3,
    agreed: false,
  };
  return { ...s, black: { ...b, sellers: { ...b.sellers, [sellerId]: fresh } } };
}

export type ChatOutcome = "deal" | "counter" | "angry" | "info" | "closed";
export type ChatTurn = { state: GameState; reply: string; outcome: ChatOutcome };

/** Talk to a dealer: small talk, questions about the car, or a price offer. */
function talkTurn(
  s: GameState,
  sellerId: string,
  carId: string,
  text: string,
  roll = Math.random,
): ChatTurn {
  const seller = blackSeller(sellerId);
  const body = text.trim();
  if (!seller || !seller.cars.includes(carId)) {
    return { state: s, reply: "Такой тачки у меня нет.", outcome: "closed" };
  }
  let state = openSellerChat(s, sellerId, carId);
  if (!body) return { state, reply: "Напиши сообщение.", outcome: "info" };

  const st = blackOf(state).sellers[sellerId]!;
  const price = blackCarPrice(sellerId, carId);
  const floor = sellerFloor(sellerId, carId);
  const ask = parseOffer(body);
  void roll;

  if (ask === null) {
    const t = body.toLowerCase();
    const last = st.tries <= 0 || st.agreed;
    if (/привет|здоров|салам|йо|хай/.test(t)) {
      const reply = `И тебе. По ${modelOf(carId).name} — ${price.toLocaleString("ru-RU")} ₽. Торг есть.`;
      return { state: appendMsg(state, sellerId, "me", body), reply, outcome: "info" };
    }
    if (/документ|птс|гарант|чист|оформ/.test(t)) {
      const reply = "ПТС оригинал, ограничений нет. Договор оформляем у нотариуса, всё официально.";
      return { state: appendMsg(state, sellerId, "me", body), reply, outcome: "info" };
    }
    if (/состоян|пробег|фото|бит|краш/.test(t)) {
      const reply = `Состояние живое, пробег честный, фото скину в личку. Цена — ${price.toLocaleString("ru-RU")} ₽.`;
      return { state: appendMsg(state, sellerId, "me", body), reply, outcome: "info" };
    }
    if (/скидк|дешев|торг|сойд|уступ/.test(t)) {
      if (last) {
        const reply = st.agreed ? "Мы уже ударили по рукам, цена зафиксирована." : "Торг закончен, цена финальная.";
        return { state: appendMsg(state, sellerId, "me", body), reply, outcome: st.agreed ? "deal" : "closed" };
      }
      const counter = Math.max(floor, Math.round((price * 0.97) / 1000) * 1000);
      const tries = st.tries - 1;
      const reply =
        tries > 0
          ? `Скину до ${counter.toLocaleString("ru-RU")} ₽, но это уже предел.`
          : `Последняя цена — ${counter.toLocaleString("ru-RU")} ₽. Больше не уступлю.`;
      return {
        state: appendMsg(state, sellerId, "me", body, { tries, offer: counter, agreed: false }),
        reply,
        outcome: "counter",
      };
    }
    if (/цена|сколько|стоит/.test(t)) {
      const reply = `Прошу ${price.toLocaleString("ru-RU")} ₽. Назови свою — обсудим.`;
      return { state: appendMsg(state, sellerId, "me", body), reply, outcome: "info" };
    }
    const flavour =
      seller.style === "rude"
        ? "Ближе к делу. Называй сумму или не занимай линию."
        : seller.style === "street"
          ? "Слушаю. Только давай по делу, время — деньги."
          : "Извините, не совсем понял. Назовите сумму, и обсудим.";
    return { state: appendMsg(state, sellerId, "me", body), reply: flavour, outcome: "info" };
  }

  if (st.agreed) {
    return {
      state: appendMsg(state, sellerId, "me", body),
      reply: "Мы уже договорились — забирай по согласованной цене.",
      outcome: "deal",
    };
  }
  if (st.tries <= 0) {
    return {
      state: appendMsg(state, sellerId, "me", body),
      reply: "Я назвал финальную цену. Либо берёшь, либо я продаю другому.",
      outcome: "closed",
    };
  }
  if (ask >= price) {
    const reply = `По рукам! Забирай за ${price.toLocaleString("ru-RU")} ₽.`;
    return {
      state: appendMsg(state, sellerId, "me", body, { offer: price, agreed: true, tries: 0 }),
      reply,
      outcome: "deal",
    };
  }
  if (ask >= floor) {
    const reply = `Договорились, ${ask.toLocaleString("ru-RU")} ₽ — и она твоя.`;
    return {
      state: appendMsg(state, sellerId, "me", body, { offer: ask, agreed: true, tries: 0 }),
      reply,
      outcome: "deal",
    };
  }
  if (ask < floor * 0.75) {
    const tries = st.tries - 1;
    const reply =
      seller.style === "rude"
        ? `За ${ask.toLocaleString("ru-RU")} ₽? Ты серьёзно? Цена ${price.toLocaleString("ru-RU")} ₽.`
        : `Это слишком мало. За ${ask.toLocaleString("ru-RU")} ₽ я даже капот не открою.`;
    return { state: appendMsg(state, sellerId, "me", body, { tries }), reply, outcome: "angry" };
  }
  const counter = Math.max(floor, Math.round(((price + ask) / 2) / 1000) * 1000);
  const tries = st.tries - 1;
  const reply =
    tries > 0
      ? `Мало. Могу отдать за ${counter.toLocaleString("ru-RU")} ₽.`
      : `Последнее слово — ${counter.toLocaleString("ru-RU")} ₽.`;
  return { state: appendMsg(state, sellerId, "me", body, { tries, offer: counter }), reply, outcome: "counter" };
}

/** Public entry: sends the player's message and stores the dealer's answer in the log. */
export function talkToSeller(
  s: GameState,
  sellerId: string,
  carId: string,
  text: string,
  roll = Math.random,
): ChatTurn {
  const turn = talkTurn(s, sellerId, carId, text, roll);
  if (!text.trim() || !sellerChat(turn.state, sellerId)) return turn;
  return { ...turn, state: appendMsg(turn.state, sellerId, "seller", turn.reply) };
}

/** Hand the money over after the dealer agreed on a price. */
export function acceptSellerOffer(s: GameState, sellerId: string): Result {
  const seller = blackSeller(sellerId);
  const st = sellerChat(s, sellerId);
  if (!seller || !st || !st.carId) return { state: s, error: "Сделка ещё не открыта" };
  if (!st.agreed || st.offer === null) return { state: s, error: "Дилер ещё не согласился на цену" };
  return closeBlackDeal(s, seller, st.carId, st.offer);
}

/** Buy a black-series car straight from the dealer at the asking price. */
export function buyBlackCar(s: GameState, sellerId: string, carId: string): Result {
  const seller = blackSeller(sellerId);
  if (!seller || !seller.cars.includes(carId)) return { state: s, error: "Машина недоступна" };
  return closeBlackDeal(s, seller, carId, blackCarPrice(sellerId, carId));
}

function closeBlackDeal(s: GameState, seller: BlackSeller, carId: string, price: number): Result {
  if (s.money < price) return { state: s, error: "Не хватает денег" };
  if (s.garage.length >= garageCapacity(s)) return { state: s, error: "Гараж заполнен" };
  const car = makeBlackCar(carId);
  const b = blackOf(s);
  const prev = b.sellers[seller.id];
  const withCar: GameState = {
    ...s,
    money: s.money - price,
    garage: [...s.garage, { ...car, boughtFor: price }],
    xp: s.xp + 600,
    stats: { ...s.stats, carsBought: s.stats.carsBought + 1 },
  };
  const closed = pushDeal(withCar, { car: car.name, price, seller: seller.name, via: "black" });
  if (!prev) return { state: closed, message: `Сделка закрыта: ${car.name} за ${price.toLocaleString("ru-RU")} ₽` };
  const cb = blackOf(closed);
  return {
    state: {
      ...closed,
      black: {
        ...cb,
        sellers: {
          ...cb.sellers,
          [seller.id]: {
            ...prev,
            offer: null,
            agreed: false,
            tries: 3,
            messages: [
              ...prev.messages,
              { from: "seller", text: "Сделка закрыта. Тачка твоя, был рад иметь дело!", at: closed.minutes },
            ],
          },
        },
      },
    },
    message: `Сделка закрыта: ${car.name} за ${price.toLocaleString("ru-RU")} ₽`,
  };
}

/** Buy an item from the WERTOOS BLACK assortment. */
export function buyBlackItem(s: GameState, itemId: string, rand = Math.random): Result {
  const item = blackItem(itemId);
  if (!item) return { state: s, error: "Товар не найден" };
  if (s.money < item.price) return { state: s, error: "Не хватает денег" };
  if (item.kind === "acc" && s.accessories.includes(item.id)) return { state: s, error: "Уже куплено" };
  const paid: GameState = { ...s, money: s.money - item.price };
  switch (item.kind) {
    case "acc":
      return {
        state: { ...paid, accessories: [...paid.accessories, item.id] },
        message: `Куплено: ${item.name}`,
      };
    case "vip": {
      const days = item.value ?? 7;
      const from = Math.max(paid.vipUntilDay, gameDay(paid));
      return { state: { ...paid, vipUntilDay: from + days }, message: `Активирован ${item.name}` };
    }
    case "plate": {
      const plate = randomPlate(rand);
      return { state: { ...paid, plates: [...paid.plates, plate] }, message: `Номер ${plate} в гараже` };
    }
    case "boost": {
      const b = blackOf(paid);
      return {
        state: { ...paid, black: { ...b, boost: b.boost + 1 } },
        message: `${item.name}: +2% к цене продажи`,
      };
    }
  }
}

export type RatedPlayer = {
  id: string;
  name: string;
  deals: number;
  rating: number;
  online: boolean;
  me?: boolean;
  tag?: string;
};

/** Dealer-style rating: 3.0 stars for a newcomer, 5.0 for a legend. */
export const playerRating = (deals: number): number => Math.min(5, Math.round((3 + deals * 0.05) * 10) / 10);

/** Bots plus the player, ranked by successful deals. */
export function dealsLeaderboard(s: GameState, nickname: string): RatedPlayer[] {
  const mine = dealsCount(s);
  const me: RatedPlayer = {
    id: "me",
    name: nickname.trim() || "Ты",
    deals: mine,
    rating: playerRating(mine),
    online: true,
    me: true,
    tag: "Ты",
  };
  const bots: RatedPlayer[] = BOTS.map((b: BotPlayer) => ({ ...b }));
  return [...bots, me].sort((a, b) => b.deals - a.deals || b.rating - a.rating);
}

export const blackBoostBonus = (s: GameState): number => blackOf(s).boost * 2;
