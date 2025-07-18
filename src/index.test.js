import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityDB } from "./index.js";

// Mock dependencies
vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    transaction: vi.fn().mockReturnValue({
      objectStore: vi.fn().mockReturnValue({
        add: vi.fn().mockResolvedValue(1),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([
          { id: 1, vector: new Float32Array([1, 2, 3]) },
          { id: 2, vector: new Float32Array([4, 5, 6]) },
        ]),
        keyPath: "id",
      }),
    }),
    objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
    createObjectStore: vi.fn(),
  }),
}));

vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(async () => ({
    data: [0.1, 0.2, 0.3],
  })),
  env: {},
}));

// Helper for binary vectors
function makeBinaryVector(arr) {
  const packed = new BigUint64Array(new ArrayBuffer(Math.ceil(arr.length / 64) * 8));
  for (let i = 0; i < arr.length; i++) {
    const bitIndex = i % 64;
    const arrayIndex = Math.floor(i / 64);
    if (arr[i] === 1) {
      packed[arrayIndex] |= 1n << BigInt(bitIndex);
    }
  }
  return packed;
}

describe("EntityDB", () => {
  let db;

  beforeEach(() => {
    db = new EntityDB({ vectorPath: "vector" });
  });

  it("should insert data", async () => {
    const key = await db.insert({ text: "hello" });
    expect(key).toBe(1);
  });

  it("should insert binary data", async () => {
    const key = await db.insertBinary({ text: "hello" });
    expect(key).toBe(1);
  });

  it("should insert manual vectors", async () => {
    const key = await db.insertManualVectors({ vector: [1, 2, 3] });
    expect(key).toBe(1);
  });

  it("should update a vector", async () => {
    await expect(db.update(1, { vector: [1, 2, 3] })).resolves.toBeUndefined();
  });

  it("should delete a vector", async () => {
    await expect(db.delete(1)).resolves.toBeUndefined();
  });

  it("should query vectors by cosine similarity", async () => {
    const results = await db.query("hello", { limit: 1 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty("similarity");
  });

  it("should query binary vectors by Hamming distance", async () => {
    // Patch binarizeVector and hammingDistance for deterministic output
    db.dbPromise = Promise.resolve({
      transaction: () => ({
        objectStore: () => ({
          getAll: () => [
            { id: 1, vector: makeBinaryVector([1, 0, 1, 0, 1, 0, 1, 0]) },
            { id: 2, vector: makeBinaryVector([0, 1, 0, 1, 0, 1, 0, 1]) },
          ],
        }),
      }),
    });
    const results = await db.queryBinary("hello", { limit: 1 });
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty("distance");
  });

  it("should query manual vectors", async () => {
    const results = await db.queryManualVectors([1, 2, 3], { limit: 1 });
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty("similarity");
  });

  it("should throw on error in insert", async () => {
    db.dbPromise = Promise.reject(new Error("fail"));
    await expect(db.insert({ text: "fail" })).rejects.toThrow();
  });
});