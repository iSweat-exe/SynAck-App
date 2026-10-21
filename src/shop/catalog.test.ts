import { describe, expect, it } from "vitest";
import { CATEGORIES, ITEMS, missingCoins, type ShopItem } from "./catalog";

describe("the shop catalog", () => {
  it("should give every item its own id", () => {
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
  });

  it("should give every item its own drawing", () => {
    expect(new Set(ITEMS.map((item) => item.art)).size).toBe(ITEMS.length);
  });

  it("should price every item with a positive whole number of coins", () => {
    for (const item of ITEMS) expect(Number.isInteger(item.price) && item.price > 0).toBe(true);
  });

  it("should put every item on a shelf that is shown", () => {
    for (const item of ITEMS) expect(CATEGORIES).toContain(item.category);
  });

  it("should have something on every shelf", () => {
    for (const category of CATEGORIES) {
      expect(ITEMS.some((item) => item.category === category)).toBe(true);
    }
  });
});

describe("missingCoins", () => {
  const item: ShopItem = {
    id: "test",
    category: "bonus",
    art: "freeze",
    name: "Test",
    description: "Un article de test.",
    price: 100,
  };

  it("should be zero when the balance is enough", () => {
    expect(missingCoins(item, 100)).toBe(0);
  });

  it("should say how many coins are missing", () => {
    expect(missingCoins(item, 35)).toBe(65);
  });

  it("should never be negative", () => {
    expect(missingCoins(item, 500)).toBe(0);
  });
});
