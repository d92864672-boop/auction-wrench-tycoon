import { describe, expect, it } from "vitest";
import { blackOf, migrate, newGame, saleOffer, sellCar, type Car, type GameState } from "@/game/engine";
import {
  acceptSellerOffer,
  blackBoostBonus,
  blackCarPrice,
  buyBlackCar,
  buyBlackItem,
  dealsLeaderboard,
  openSellerChat,
  parseOffer,
  playerRating,
  sellerChat,
  talkToSeller,
} from "@/game/black";
import { BLACK_CARS, BLACK_ITEMS, BLACK_SELLERS, BOTS } from "@/game/data";

const rich = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(), money: 120_000_000, ...extra });

const testCar: Car = {
  id: "c1",
  modelId: "priora",
  name: "Lada Priora",
  year: 2020,
  mileage: 120_000,
  condition: 80,
  boughtFor: 200_000,
};

describe("WERTOOS BLACK state", () => {
  it("starts empty for a new game and is restored by migrate", () => {
    expect(blackOf(newGame())).toEqual({ sellers: {}, boost: 0, deals: [] });

    const legacy = { ...newGame() } as Record<string, unknown>;
    delete legacy.black;
    const migrated = migrate(legacy);
    expect(blackOf(migrated).deals).toEqual([]);
    expect(blackOf(migrated).boost).toBe(0);
  });

  it("ships 8 black cars, 9 shop items, 4 dealers and 8 bots", () => {
    expect(BLACK_CARS).toHaveLength(8);
    expect(BLACK_ITEMS).toHaveLength(9);
    expect(BLACK_SELLERS).toHaveLength(4);
    expect(BOTS).toHaveLength(8);
    // Black-series cars never spawn on the open market.
    const open = newGame().listings.map((l) => l.modelId);
    expect(open.some((id) => BLACK_CARS.some((c) => c.id === id))).toBe(false);
  });
});

describe("black-series cars", () => {
  it("prices a car below its model base and buys it into the garage", () => {
    const s = rich();
    const price = blackCarPrice("soha", "wb-urus");
    const model = BLACK_CARS.find((c) => c.id === "wb-urus")!;
    expect(price).toBeLessThan(model.base);

    const res = buyBlackCar(s, "soha", "wb-urus");
    expect(res.error).toBeUndefined();
    expect(res.state.money).toBe(s.money - price);
    expect(res.state.garage).toHaveLength(1);
    expect(res.state.garage[0]!.modelId).toBe("wb-urus");
    expect(res.state.garage[0]!.boughtFor).toBe(price);
    expect(blackOf(res.state).deals).toHaveLength(1);
    expect(blackOf(res.state).deals[0]!.via).toBe("black");
  });

  it("refuses a deal without money or a free garage slot", () => {
    expect(buyBlackCar({ ...newGame(), money: 1_000 }, "soha", "wb-urus").error).toBe("Не хватает денег");

    const full = rich({ garage: [testCar, { ...testCar, id: "c2" }, { ...testCar, id: "c3" }] });
    expect(buyBlackCar(full, "soha", "wb-urus").error).toBe("Гараж заполнен");
  });
});

describe("dealer chat", () => {
  it("greets the player when a chat opens", () => {
    const s = openSellerChat(rich(), "soha", "wb-g63");
    const chat = sellerChat(s, "soha")!;
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]!.from).toBe("seller");
    expect(chat.tries).toBe(3);
  });

  it("answers questions about documents and keeps both sides in the log", () => {
    const s = talkToSeller(openSellerChat(rich(), "soha", "wb-g63"), "soha", "wb-g63", "ПТС чистый?").state;
    const chat = sellerChat(s, "soha")!;
    expect(chat.messages.map((m) => m.from)).toEqual(["seller", "me", "seller"]);
    expect(chat.messages.at(-1)!.text).toMatch(/ПТС/i);
    expect(chat.agreed).toBe(false);
  });

  it("accepts a serious offer and closes the deal at the agreed price", () => {
    const price = blackCarPrice("soha", "wb-g63");
    const start = openSellerChat(rich(), "soha", "wb-g63");
    const turn = talkToSeller(start, "soha", "wb-g63", `${Math.round(price * 0.95)}`);
    expect(turn.outcome).toBe("deal");
    const chat = sellerChat(turn.state, "soha")!;
    expect(chat.agreed).toBe(true);

    const deal = acceptSellerOffer(turn.state, "soha");
    expect(deal.error).toBeUndefined();
    expect(deal.state.money).toBe(rich().money - chat.offer!);
    expect(blackOf(deal.state).deals[0]!.price).toBe(chat.offer);
    expect(sellerChat(deal.state, "soha")!.agreed).toBe(false);
    expect(sellerChat(deal.state, "soha")!.tries).toBe(3);
  });

  it("counters a lowball offer and burns a haggle attempt", () => {
    const price = blackCarPrice("soha", "wb-urus");
    const start = openSellerChat(rich(), "soha", "wb-urus");
    const turn = talkToSeller(start, "soha", "wb-urus", `${Math.round(price * 0.5)}`);
    expect(turn.outcome).toBe("angry");
    const chat = sellerChat(turn.state, "soha")!;
    expect(chat.tries).toBe(2);
    expect(chat.agreed).toBe(false);
  });

  it("parses free-form prices", () => {
    expect(parseOffer("18млн")).toBe(18_000_000);
    expect(parseOffer("900 тыс")).toBe(900_000);
    expect(parseOffer("5 000 000")).toBe(5_000_000);
    expect(parseOffer("дорого")).toBeNull();
  });
});

describe("BLACK shop items", () => {
  it("sells accessories only once", () => {
    const s = rich();
    const bought = buyBlackItem(s, "bk-chain").state;
    expect(bought.accessories).toContain("bk-chain");
    expect(buyBlackItem(bought, "bk-chain").error).toBe("Уже куплено");
  });

  it("extends VIP and grants a plate", () => {
    const vip = buyBlackItem(rich(), "bk-vip7").state;
    expect(vip.vipUntilDay).toBeGreaterThan(0);
    expect(buyBlackItem(rich(), "bk-plate").state.plates).toHaveLength(1);
  });

  it("boosts every sale price by 2% per stack", () => {
    const s = rich({ garage: [testCar] });
    const plain = sellCar(s, "c1").state.money - s.money;

    const boosted = buyBlackItem(buyBlackItem(s, "bk-notebook").state, "bk-lift").state;
    expect(blackBoostBonus(boosted)).toBe(4);
    const withBoost = sellCar(boosted, "c1").state.money - boosted.money;

    expect(plain).toBe(saleOffer(s, testCar));
    expect(withBoost).toBe(Math.round(saleOffer(s, testCar) * 1.04));
    expect(withBoost).toBeGreaterThan(plain);
    // Market sales also count towards the deals rating.
    expect(blackOf(sellCar(s, "c1").state).deals).toHaveLength(1);
  });
});

describe("deals rating", () => {
  it("ranks bots and the player by successful deals", () => {
    const s = rich();
    const board = dealsLeaderboard(s, "  ");
    expect(board).toHaveLength(BOTS.length + 1);
    expect(board.find((p) => p.me)!.name).toBe("Ты");
    expect(board.find((p) => p.me)!.deals).toBe(0);
    for (let i = 1; i < board.length; i += 1) {
      expect(board[i - 1]!.deals).toBeGreaterThanOrEqual(board[i]!.deals);
    }
    expect(board.some((p) => p.online)).toBe(true);
    expect(board.some((p) => !p.online)).toBe(true);
  });

  it("moves the player up after real deals and grows the star rating", () => {
    const s = rich();
    let played = s;
    for (let i = 0; i < 3; i += 1) {
      played = buyBlackCar({ ...played, money: 120_000_000, garage: [] }, "soha", "wb-urus").state;
    }
    const me = dealsLeaderboard(played, "Wert").find((p) => p.me)!;
    expect(me.deals).toBe(3);
    expect(me.name).toBe("Wert");
    expect(me.rating).toBe(playerRating(3));
    expect(playerRating(3)).toBeGreaterThan(playerRating(0));
    expect(playerRating(500)).toBe(5);
  });
});
