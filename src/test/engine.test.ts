import { describe, expect, it } from "vitest";
import { applyGrant, dailyUpdate, newGame } from "@/game/engine";

describe("shop delivery", () => {
  it("credits 10 000 000 ₽ for the money case", () => {
    const s = newGame();
    expect(applyGrant(s, "g1", "pack-case").state.money).toBe(s.money + 10_000_000);
  });
  it("delivers each purchase only once", () => {
    const once = applyGrant(newGame(), "g1", "pack-start").state;
    expect(applyGrant(once, "g1", "pack-start").state.money).toBe(once.money);
  });
});

describe("business day", () => {
  it("«Островок в ТЦ» pays 26 000 ₽ minus 3 600 ₽ expenses per day", () => {
    const s = { ...newGame(), businesses: [{ uid: "b", typeId: "island", level: 1 }] };
    expect(dailyUpdate(s, () => 0.99).state.money - s.money).toBe(26_000 - 3_600);
  });
});

describe("admin deliveries", () => {
  it("admin money adds the exact amount", () => {
    const s = newGame();
    expect(applyGrant(s, "a1", "admin-money", 1_000_000_000_000).state.money).toBe(s.money + 1_000_000_000_000);
  });
  it("admin take-away never goes below zero", () => {
    expect(applyGrant(newGame(), "a2", "admin-money", -1e15).state.money).toBe(0);
  });
  it("admin reset restores a new game but remembers the grant", () => {
    const rich = { ...newGame(), money: 5e9 };
    const r = applyGrant(rich, "a3", "admin-reset").state;
    expect(r.money).toBe(newGame().money);
    expect(r.appliedGrants).toContain("a3");
  });
});
