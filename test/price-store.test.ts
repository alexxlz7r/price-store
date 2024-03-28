import { assert, beforeAll, describe, expect, test } from "vitest";
import { PriceStore, defaultRanges } from "../src/price-store.js";

const randomPrice = () => {
  return Math.floor(Math.random() * (100000 - 1000 + 1) + 1000);
};

describe.skip("test all ranges, full filled store", () => {
  const prices: number[] = [];
  const priceStore = new PriceStore();

  beforeAll(() => {
    const startDate = new Date(2024, 0, 1).getTime();
    const endDate = new Date(2024, 0, 3).getTime();
    const interval = 5000;
    let currentDate = startDate;

    while (currentDate < endDate) {
      const price = randomPrice();
      priceStore.add(currentDate, price);
      prices.push(price);
      currentDate += interval;
    }
  });

  test.each(Array.from(defaultRanges.values()))(
    "range: $id, length: $length",
    ({ id, length }) => {
      const expectedMin = Math.min(...prices.slice(-length));
      const expectedMax = Math.max(...prices.slice(-length));
      const actualMin = priceStore.min(id);
      const actualMax = priceStore.max(id);
      expect(expectedMin).toEqual(actualMin);
      expect(expectedMax).toEqual(actualMax);
    }
  );
});

describe("test client", () => {
  const prices: number[] = [];
  const priceStore = new PriceStore();

  test("", () => {
    const startDate = new Date(2024, 0, 1).getTime();
    const endDate = new Date(2024, 0, 3).getTime();
    const interval = 5000;
    let currentDate = startDate;

    while (currentDate < endDate) {
      const price = randomPrice();
      priceStore.add(currentDate, price);
      prices.push(price); // for test purpose, to compare PriceStore with Math.min/max
      currentDate += interval;

      for (let range of defaultRanges.values()) {
        let pricesLength =
          prices.length < range.length ? prices.length : range.length;
        const expectedMin = Math.min(...prices.slice(-pricesLength));
        const expectedMax = Math.max(...prices.slice(-pricesLength));
        const actualMin = priceStore.min(range.id);
        const actualMax = priceStore.max(range.id);
        expect(
          expectedMin,
          `min is wrong, length = ${pricesLength}, range = ${range.id}`
        ).toBe(actualMin);
        expect(
          expectedMax,
          `max is wrong, length = ${pricesLength}, range = ${range.id}`
        ).toBe(actualMax);
        const maxLength = (24 * 60 * 60 * 1000) / 5000;
        expect(priceStore["prices"].size).toBeLessThanOrEqual(maxLength);
        for (let k = 0; k < Math.floor(Math.log2(maxLength)); k++) {
          expect(priceStore["sparseTableMin"][k].size).toBeLessThanOrEqual(
            maxLength - ((1 << k) - 1)
          );
        }
      }
    }
  });
});
