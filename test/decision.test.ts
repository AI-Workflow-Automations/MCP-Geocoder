import { describe, expect, it } from "bun:test";

import { decide } from "../src/domain/decision.js";
import { DEFAULT_THRESHOLDS, rankCandidates, scoreStreetName } from "../src/domain/scoring.js";
import type { StreetCandidate } from "../src/domain/types.js";

const candidate = (street: string, confidence: number): StreetCandidate => ({
  street,
  postalCode: "10115",
  locality: "Berlin",
  confidence,
  source: "openplz",
});

describe("scoreStreetName", () => {
  it("bewertet typische Verhörer hoch", () => {
    expect(scoreStreetName("Henrichstraße", "Heinrichstraße").total).toBeGreaterThan(0.9);
    expect(scoreStreetName("Muehlenweg", "Mühlenweg").total).toBe(1);
  });

  it("hält unähnliche Straßen unter der Eskalationsschwelle", () => {
    expect(scoreStreetName("Heinrichstraße", "Gartenstraße").total).toBeLessThan(DEFAULT_THRESHOLDS.ambiguous);
  });

  it("deckelt bei widersprüchlichem Grundwort unter die Auto-Schwelle", () => {
    const score = scoreStreetName("Henrichweg", "Heinrichstraße");
    expect(score.total).toBeLessThan(DEFAULT_THRESHOLDS.autoAccept);
    expect(score.cappedBy).toContain("weg");
    expect(score.streetType).toBe(0);
  });

  it("ist neutral, wenn nur eine Seite ein Grundwort hat", () => {
    expect(scoreStreetName("Heinrich", "Heinrichstraße").streetType).toBe(0.5);
  });
});

describe("decide", () => {
  it("übernimmt nur bei klarem Abstand zum Zweitplatzierten", () => {
    const decision = decide([candidate("Heinrichstraße", 0.95), candidate("Gartenstraße", 0.4)], DEFAULT_THRESHOLDS);
    expect(decision.status).toBe("confirmed");
    expect(decision.needsHuman).toBe(false);
  });

  it("fragt zurück, wenn zwei Treffer dicht beieinander liegen", () => {
    const decision = decide([candidate("Berliner Straße", 0.93), candidate("Berliner Ring", 0.91)], DEFAULT_THRESHOLDS);
    expect(decision.status).toBe("ambiguous");
    expect(decision.reason).toContain("zu dicht");
  });

  it("eskaliert statt zu raten", () => {
    const decision = decide([candidate("Irgendwas", 0.3)], DEFAULT_THRESHOLDS);
    expect(decision.status).toBe("unresolved");
    expect(decision.needsHuman).toBe(true);
  });

  it("eskaliert bei leerer Kandidatenliste", () => {
    expect(decide([], DEFAULT_THRESHOLDS).needsHuman).toBe(true);
  });
});

describe("rankCandidates", () => {
  it("führt Schreibvarianten derselben Straße zusammen", () => {
    const ranked = rankCandidates(
      [candidate("Heinrichstraße", 0.7), candidate("Heinrichstr.", 0.9)],
      DEFAULT_THRESHOLDS,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBe(0.9);
  });

  it("liest nur Kandidaten im Vorschlagsband vor", () => {
    const ranked = rankCandidates(
      [candidate("A-Straße", 0.9), candidate("B-Straße", 0.87), candidate("C-Straße", 0.6), candidate("D-Straße", 0.5)],
      DEFAULT_THRESHOLDS,
    );
    expect(ranked.map((c) => c.street)).toEqual(["A-Straße", "B-Straße"]);
  });

  it("kürzt auf maximal drei Vorschläge", () => {
    const ranked = rankCandidates(
      [candidate("A", 0.9), candidate("B", 0.89), candidate("C", 0.88), candidate("D", 0.87)],
      DEFAULT_THRESHOLDS,
    );
    expect(ranked).toHaveLength(3);
  });
});
