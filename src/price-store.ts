/**
 *
 */
export type RangeId = "5m" | "15m" | "1h" | "4h" | "24h";

/**
 *
 */
export class Range {
  public readonly length: number;

  constructor(
    public readonly id: RangeId,
    private readonly duration: number,
    private readonly interval: number
  ) {
    this.length = this.duration / this.interval;
  }
}

/**
 *
 */
export const defaultRanges: Map<RangeId, Range> = new Map(
  Object.entries({
    "5m": new Range("5m", 5 * 60 * 1000, 5000),
    "15m": new Range("15m", 15 * 60 * 1000, 5000),
    "1h": new Range("1h", 60 * 60 * 1000, 5000),
    "4h": new Range("4h", 4 * 60 * 60 * 1000, 5000),
    "24h": new Range("24h", 24 * 60 * 60 * 1000, 5000),
  }) as [RangeId, Range][]
);

/**
 *
 */
export class PriceStore {
  private prices = new Map<number, number>();
  private sparseTableMin: Array<Map<number, number>>;
  private sparseTableMax: Array<Map<number, number>>;

  private zeroIdxTs = 0;

  private readonly maxSparseRows: number;

  /**
   *
   * @param capacity max time range for that store items, default is 24h, in milliseconds
   * @param interval expected interval in milliseconds, default is 5s
   */
  constructor(
    private readonly capacity: number = 24 * 60 * 60 * 1000,
    private readonly interval: number = 5000,
    private readonly ranges: Map<RangeId, Range> = defaultRanges
  ) {
    this.maxSparseRows = Math.floor(Math.log2(this.capacity / this.interval));
    this.sparseTableMin = new Array<Map<number, number>>(this.maxSparseRows);
    this.sparseTableMax = new Array<Map<number, number>>(this.maxSparseRows);
    for (let r = 0; r < this.maxSparseRows; r++) {
      this.sparseTableMin[r] = new Map();
      this.sparseTableMax[r] = new Map();
    }
  }

  /**
   * Adds price
   */
  public add(timestamp: number, value: number): void {
    this.prices.set(timestamp, value);
    this.zeroIdxTs = timestamp;

    for (let r = 0; r < this.maxSparseRows; r++) {
      let minValue1 = 0;
      let minValue2 = 0;
      let maxValue1 = 0;
      let maxValue2 = 0;
      const nextIdx = this.zeroIdxTs - (1 << r) * this.interval;
      if (r === 0) {
        maxValue1 = minValue1 = this.prices.get(this.zeroIdxTs)!;
        maxValue2 = minValue2 = this.prices.get(nextIdx)!;
      } else {
        minValue1 = this.sparseTableMin[r - 1].get(this.zeroIdxTs)!;
        minValue2 = this.sparseTableMin[r - 1].get(nextIdx)!;
        maxValue1 = this.sparseTableMax[r - 1].get(this.zeroIdxTs)!;
        maxValue2 = this.sparseTableMax[r - 1].get(nextIdx)!;
      }

      if (minValue1 && minValue2 && maxValue1 && maxValue2) {
        this.sparseTableMin[r].set(timestamp, Math.min(minValue1!, minValue2!));
        this.sparseTableMax[r].set(timestamp, Math.max(maxValue1!, maxValue2!));
      } else {
        break;
      }
    }

    const lastKey = timestamp + this.capacity;
    if (this.prices.has(lastKey)) {
      this.prices.delete(lastKey);
    }
    [this.sparseTableMin, this.sparseTableMax].forEach((table) => {
      table.forEach((rowMap) => {
        if (rowMap.has(lastKey)) {
          rowMap.delete(lastKey);
        }
      });
    });
  }

  /**
   *
   * @param rangeId 5m | 15m | 1h | 4h | 24h
   * @returns min value
   */
  public min(rangeId: RangeId): number {
    return this.query(rangeId, this.sparseTableMin, Math.min);
  }

  /**
   *
   * @param rangeId
   * @returns max value
   */
  public max(rangeId: RangeId): number {
    return this.query(rangeId, this.sparseTableMax, Math.max);
  }

  /**
   *
   * @param rangeId
   * @param sparseTable
   * @param compareFunc
   * @returns min/max value depending on sparseTable and compareFunc
   */
  private query(
    rangeId: RangeId,
    sparseTable: Array<Map<number, number>>,
    compareFunc: (...values: number[]) => number
  ): number {
    let length = this.ranges.get(rangeId)?.length!;
    if (length > this.prices.size) {
      length = this.prices.size;
    }
    if (!length) {
      throw new Error("Unsupported range");
    }
    const r = Math.floor(Math.log2(length)) - 1;
    let value1 = 0;
    let value2 = 0;
    if (r < 0) {
      const offset = length - (1 << (r + 1));
      const rightIdx = this.zeroIdxTs - offset * this.interval;
      value1 = this.prices.get(this.zeroIdxTs)!;
      value2 = this.prices.get(rightIdx)!;
    } else {
      const offset = length - (1 << (r + 1));
      const rightIdx = this.zeroIdxTs - offset * this.interval;
      value1 = sparseTable[r].get(this.zeroIdxTs)!;
      value2 = sparseTable[r].get(rightIdx)!;
    }

    return compareFunc(value1!, value2!);
  }
}
