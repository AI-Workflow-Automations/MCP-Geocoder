import { describe, expect, it } from "bun:test";

import type { AddressResolution, MatchStatus } from "../src/domain/types.js";
import { createFixtureService, FIXTURE_POSTAL_CODE } from "./fixtures.js";

/**
 * Schwierige Fälle - so kommen Straßennamen aus einem Telefon-Transcriber.
 *
 * Jeder Fall beschreibt: was gesagt wurde, was der Server tun MUSS, und
 * welche Straße dabei nie bestätigt werden darf. Die Liste ist das eigentliche
 * Abnahmekriterium des Abgleichs - wer die Gewichte ändert, muss hier durch.
 */
interface HardCase {
  heard: string;
  why: string;
  expectStatus: MatchStatus | MatchStatus[];
  /** Muss der beste Treffer sein (bei confirmed) bzw. unter den Kandidaten (bei ambiguous) */
  expectBest?: string;
  /** Darf niemals als confirmed zurückkommen */
  forbidConfirmed?: string;
}

const CASES: HardCase[] = [
  // --- Das Kernpaar -----------------------------------------------------
  {
    heard: "Heinrichstr. 24",
    why: "Abkürzung; Henrichweg ist nur ein Buchstabe entfernt",
    expectStatus: "confirmed",
    expectBest: "Heinrichstraße",
    forbidConfirmed: "Henrichweg",
  },
  {
    heard: "Henrichweg 24",
    why: "Anrufer meint wirklich den Henrichweg",
    expectStatus: "confirmed",
    expectBest: "Henrichweg",
    forbidConfirmed: "Heinrichstraße",
  },
  {
    heard: "Henrichstraße 24",
    why: "STT lässt das i weg - Grundwort sagt trotzdem Straße",
    expectStatus: "confirmed",
    expectBest: "Heinrichstraße",
    forbidConfirmed: "Henrichweg",
  },
  {
    heard: "Heinrichweg 24",
    why: "STT fügt ein i ein - Grundwort sagt trotzdem Weg",
    expectStatus: "confirmed",
    expectBest: "Henrichweg",
    forbidConfirmed: "Heinrichstraße",
  },
  {
    heard: "Heinrich 24",
    why: "Grundwort fehlt - drei Kandidaten mit gleichem Stamm",
    expectStatus: "ambiguous",
    forbidConfirmed: "Heinrichstraße",
  },
  // --- Gleicher Stamm, verschiedene Grundwörter --------------------------
  {
    heard: "Berliner Straße",
    why: "Allee und Ring liegen daneben",
    expectStatus: "confirmed",
    expectBest: "Berliner Straße",
  },
  {
    heard: "Berliner",
    why: "Ohne Grundwort ist es nicht entscheidbar",
    expectStatus: "ambiguous",
  },
  {
    heard: "Bahnhofsplatz 2",
    why: "Bahnhofstraße hat den fast gleichen Stamm",
    expectStatus: "confirmed",
    expectBest: "Bahnhofsplatz",
    forbidConfirmed: "Bahnhofstraße",
  },
  // --- Umlaute, Schreibweisen -------------------------------------------
  { heard: "Muehlenweg", why: "Umlaut als ue", expectStatus: "confirmed", expectBest: "Mühlenweg" },
  { heard: "Mülenweg 3", why: "h fehlt", expectStatus: "confirmed", expectBest: "Mühlenweg" },
  { heard: "Mühlen Weg", why: "Getrenntes Grundwort", expectStatus: "confirmed", expectBest: "Mühlenweg" },
  {
    heard: "Ernst Reuter Platz",
    why: "Bindestriche fehlen",
    expectStatus: "confirmed",
    expectBest: "Ernst-Reuter-Platz",
  },
  { heard: "Akkerstraße 3", why: "kk statt ck", expectStatus: "confirmed", expectBest: "Ackerstraße" },
  {
    heard: "Invaliden Str 12a",
    why: "Getrenntes, verkürztes Grundwort",
    expectStatus: "confirmed",
    expectBest: "Invalidenstraße",
  },
  {
    heard: "Zionskirch Straße",
    why: "Getrenntes Grundwort bei langem Stamm",
    expectStatus: "confirmed",
    expectBest: "Zionskirchstraße",
  },
  {
    heard: "Tieck Straße",
    why: "Kurzer Stamm - Schlegelstraße ist ein Nachbar",
    expectStatus: "confirmed",
    expectBest: "Tieckstraße",
  },
  // --- Kurze Namen ------------------------------------------------------
  {
    heard: "Am Wall",
    why: "Am Markt ist zwei Buchstaben entfernt",
    expectStatus: "confirmed",
    expectBest: "Am Wall",
    forbidConfirmed: "Am Markt",
  },
  {
    heard: "Neuer Wall",
    why: "Neuer Weg klingt fast gleich",
    expectStatus: "confirmed",
    expectBest: "Neuer Wall",
    forbidConfirmed: "Neuer Weg",
  },
  // --- Füllwörter -------------------------------------------------------
  {
    heard: "ähm also die Torstraße",
    why: "Transkript mit Füllwörtern",
    expectStatus: "confirmed",
    expectBest: "Torstraße",
  },
  {
    heard: "ich wohne in der Chausseestraße 5",
    why: "Ganzer Satz",
    expectStatus: "confirmed",
    expectBest: "Chausseestraße",
  },
  // --- Existiert nicht --------------------------------------------------
  {
    heard: "Zwitscherweg 7",
    why: "Erfunden - darf nie bestätigt werden",
    expectStatus: ["ambiguous", "unresolved"],
    forbidConfirmed: "*",
  },
  {
    heard: "Xylophonallee",
    why: "Erfunden, klingt wie nichts im Verzeichnis",
    expectStatus: "unresolved",
    forbidConfirmed: "*",
  },
];

/** Erwarteter Status - eine Liste, weil "existiert nicht" zwei richtige Antworten hat. */
function assertStatus(result: AddressResolution, testCase: HardCase): void {
  const expected = Array.isArray(testCase.expectStatus) ? testCase.expectStatus : [testCase.expectStatus];
  expect(expected, `status war ${result.status}: ${result.reason}`).toContain(result.status);
  expect(result.needsHuman).toBe(result.status === "unresolved");
}

/** Bei confirmed muss es der beste Treffer sein, bei ambiguous reicht: unter den Kandidaten. */
function assertBest(result: AddressResolution, testCase: HardCase): void {
  if (!testCase.expectBest) return;
  if (result.status === "confirmed") {
    expect(result.best?.street).toBe(testCase.expectBest);
  } else {
    expect(result.candidates.map((c) => c.street)).toContain(testCase.expectBest);
  }
}

/** Die eigentliche Schutzregel: diese Straße darf nie still übernommen werden. */
function assertNotForbidden(result: AddressResolution, testCase: HardCase): void {
  if (!testCase.forbidConfirmed || result.status !== "confirmed") return;
  if (testCase.forbidConfirmed === "*") {
    throw new Error(`"${testCase.heard}" wurde als "${result.best?.street}" bestätigt - darf nicht sein.`);
  }
  expect(result.best?.street).not.toBe(testCase.forbidConfirmed);
}

describe("Schwierige Fälle aus dem Telefon-Transcriber", () => {
  const { service } = createFixtureService();

  for (const testCase of CASES) {
    it(`${testCase.heard}  —  ${testCase.why}`, async () => {
      const result = await service.resolveAddress({ street: testCase.heard, postalCode: FIXTURE_POSTAL_CODE });
      assertStatus(result, testCase);
      assertBest(result, testCase);
      assertNotForbidden(result, testCase);
    });
  }

  it("liest bei ambiguous höchstens drei Kandidaten vor", async () => {
    const result = await service.resolveAddress({ street: "Heinrich", postalCode: FIXTURE_POSTAL_CODE });
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.speech).toContain("Erstens");
  });

  it("deckelt den Kandidaten mit widersprüchlichem Grundwort sichtbar", async () => {
    const result = await service.resolveAddress({ street: "Henrichstraße", postalCode: FIXTURE_POSTAL_CODE });
    const henrichweg = result.candidates.find((c) => c.street === "Henrichweg");
    // Kann durch das Vorschlagsband herausfallen - falls vorhanden, muss der Deckel greifen
    if (henrichweg) {
      expect(henrichweg.breakdown?.cappedBy).toContain("Grundwort");
      expect(henrichweg.confidence).toBeLessThanOrEqual(0.84);
    }
  });
});
