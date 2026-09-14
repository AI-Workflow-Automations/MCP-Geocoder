import { describe, expect, it } from "bun:test";

import {
  expandAbbreviations,
  speakAddress,
  speakChoices,
  speakHouseNumber,
  speakPostalCode,
} from "../src/speech/speech-formatter.js";

describe("Sprachausgabe", () => {
  it("liest die PLZ Ziffer für Ziffer", () => {
    expect(speakPostalCode("10115")).toBe("1 0 1 1 5");
  });

  it("formatiert Hausnummern sprechbar", () => {
    expect(speakHouseNumber("12a")).toBe("12 a");
    expect(speakHouseNumber("3-5")).toBe("3 bis 5");
    expect(speakHouseNumber("120")).toBe("1 2 0");
  });

  it("schreibt Abkürzungen aus", () => {
    expect(expandAbbreviations("Heinrich-Str. Nr. 3")).toBe("Heinrich-Straße Nummer 3");
  });

  it("baut eine vollständig sprechbare Adresse", () => {
    expect(speakAddress("Torstr.", "12a", "10115", "Berlin")).toBe("Torstraße 12 a in 1 0 1 1 5 Berlin");
  });

  it("nummeriert Auswahlmöglichkeiten", () => {
    expect(speakChoices(["A", "B"])).toBe("Erstens: A. Zweitens: B");
  });
});
