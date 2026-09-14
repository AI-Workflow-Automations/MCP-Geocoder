import { describe, expect, it } from "bun:test";

import { damerauLevenshtein, editSimilarity, fuzzyTokenSimilarity, jaroWinkler } from "../src/domain/similarity.js";

describe("damerauLevenshtein", () => {
  it("zählt eine Vertauschung als einen Schritt", () => {
    expect(damerauLevenshtein("heinrich", "hienrich")).toBe(1);
  });
  it("normiert auf 0..1", () => {
    expect(editSimilarity("abc", "abc")).toBe(1);
    expect(editSimilarity("", "")).toBe(1);
  });
});

describe("jaroWinkler", () => {
  it("belohnt gleiche Wortanfänge", () => {
    expect(jaroWinkler("heinrich", "henrich")).toBeGreaterThan(0.9);
    expect(jaroWinkler("heinrich", "gartenweg")).toBeLessThan(0.6);
  });
});

describe("fuzzyTokenSimilarity", () => {
  it("gibt fast identischen Tokens eine hohe Ähnlichkeit", () => {
    expect(fuzzyTokenSimilarity(["henrich"], ["heinrich"])).toBeGreaterThan(0.9);
  });
  it("bleibt bei fremden Tokens niedrig", () => {
    expect(fuzzyTokenSimilarity(["zwitscher"], ["garten"])).toBeLessThan(0.6);
  });
});
