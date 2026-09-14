import { describe, expect, it } from "bun:test";

import {
  extractPostalCode,
  normalizeStreetName,
  significantTokens,
  splitHouseNumber,
  splitStreetName,
} from "../src/domain/normalization.js";

describe("normalizeStreetName", () => {
  it("expandiert Abkürzungen und löst Umlaute auf", () => {
    expect(normalizeStreetName("Mühlen Str.")).toBe("muehlenstrasse");
    expect(normalizeStreetName("MÜHLENSTRASSE")).toBe("muehlenstrasse");
    expect(normalizeStreetName("Mühlen-Straße")).toBe("muehlenstrasse");
  });

  it("entfernt Füllwörter aus dem Transkript", () => {
    expect(normalizeStreetName("ähm also die Torstraße")).toBe("torstrasse");
    expect(normalizeStreetName("ich wohne in der Torstraße")).toBe("torstrasse");
  });

  it("zieht getrennte Grundwörter ans Wort", () => {
    expect(normalizeStreetName("Kastanien Allee")).toBe("kastanienallee");
    expect(normalizeStreetName("Ernst Reuter Platz")).toBe("ernst reuterplatz");
  });
});

describe("splitStreetName", () => {
  it("trennt Stamm und Grundwort", () => {
    expect(splitStreetName("Heinrichstraße")).toEqual({ stem: "heinrich", type: "strasse" });
    expect(splitStreetName("Henrichweg")).toEqual({ stem: "henrich", type: "weg" });
    expect(splitStreetName("Am Markt")).toEqual({ stem: "am", type: "markt" });
  });

  it("lässt Namen ohne Grundwort unangetastet", () => {
    expect(splitStreetName("Bernauer")).toEqual({ stem: "bernauer" });
  });

  it("nimmt nur das letzte Grundwort - Chausseestraße bleibt eine Straße", () => {
    expect(splitStreetName("Chausseestraße")).toEqual({ stem: "chaussee", type: "strasse" });
  });
});

describe("significantTokens", () => {
  it("wirft Grundwörter und Präpositionen aus", () => {
    expect(significantTokens("Heinrichstraße")).toEqual(["heinrich"]);
    expect(significantTokens("Ernst-Reuter-Platz")).toEqual(["ernst", "reuter"]);
  });

  it("fällt auf alle Tokens zurück, wenn sonst nichts bliebe", () => {
    expect(significantTokens("Am Markt")).toEqual(["am", "markt"]);
  });
});

describe("splitHouseNumber", () => {
  it("trennt Hausnummern inklusive Zusatz", () => {
    expect(splitHouseNumber("Invalidenstraße 12a")).toEqual({ street: "Invalidenstraße", houseNumber: "12a" });
    expect(splitHouseNumber("Am Markt 3-5")).toEqual({ street: "Am Markt", houseNumber: "3-5" });
    expect(splitHouseNumber("Torstraße 7 b")).toEqual({ street: "Torstraße", houseNumber: "7b" });
  });

  it("lässt Namen ohne Hausnummer unverändert", () => {
    expect(splitHouseNumber("Bahnhofstraße")).toEqual({ street: "Bahnhofstraße" });
  });
});

describe("extractPostalCode", () => {
  it("findet die PLZ auch in diktierter Form", () => {
    expect(extractPostalCode("10115")).toBe("10115");
    expect(extractPostalCode("1 0 1 1 5")).toBe("10115");
    expect(extractPostalCode("Postleitzahl 10115 bitte")).toBe("10115");
  });

  it("liefert undefined bei Unsinn", () => {
    expect(extractPostalCode("keine Ahnung")).toBeUndefined();
    expect(extractPostalCode("1234")).toBeUndefined();
  });
});
