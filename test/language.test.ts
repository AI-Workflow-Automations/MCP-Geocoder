import { describe, expect, it } from "bun:test";

import { buildOpenApiDocument } from "../src/api/openapi.js";
import { loadConfig } from "../src/config.js";
import { decide } from "../src/domain/decision.js";
import { DEFAULT_THRESHOLDS, scoreStreetName } from "../src/domain/scoring.js";
import type { StreetCandidate } from "../src/domain/types.js";
import { apiGuideMarkdown } from "../src/mcp/api-guide.js";
import { mcpTexts } from "../src/mcp/tool-texts.js";
import { parseLanguage } from "../src/speech/language.js";
import { phrasesFor, speakChoices, speakHouseNumber } from "../src/speech/speech-formatter.js";
import { createFixtureService, FIXTURE_POSTAL_CODE } from "./fixtures.js";

const candidate = (street: string, confidence: number): StreetCandidate => ({
  street,
  postalCode: "10115",
  locality: "Berlin",
  confidence,
  source: "openplz",
});

describe("Sprache: Konfiguration", () => {
  it("liest LANGUAGE aus der Umgebung, Standard ist Deutsch", () => {
    expect(loadConfig({ LANGUAGE: "en" }).language).toBe("en");
    expect(loadConfig({}).language).toBe("de");
  });

  it("fällt bei unbekannter Sprache auf den Standard zurück", () => {
    expect(parseLanguage("fr", "de")).toBe("de");
    expect(parseLanguage("EN", "de")).toBe("en");
    expect(parseLanguage(undefined, "en")).toBe("en");
  });
});

describe("Sprache: Sprachausgabe", () => {
  it("nummeriert Auswahlmöglichkeiten auf Englisch", () => {
    expect(speakChoices(["A", "B"], "en")).toBe("First: A. Second: B");
    expect(speakChoices(["A", "B"], "de")).toBe("Erstens: A. Zweitens: B");
  });

  it("spricht Hausnummernbereiche in der Zielsprache", () => {
    expect(speakHouseNumber("3-5", "en")).toBe("3 to 5");
    expect(speakHouseNumber("3-5", "de")).toBe("3 bis 5");
  });

  it("hält beide Satzsammlungen vollständig", () => {
    const de = phrasesFor("de");
    const en = phrasesFor("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    expect(en.confirmAddress("X")).toBe("I have noted: X. Is that correct?");
  });
});

describe("Sprache: Begründungen", () => {
  it("formuliert Entscheidungsgründe auf Englisch", () => {
    const close = decide([candidate("Berliner Straße", 0.93), candidate("Berliner Ring", 0.91)], DEFAULT_THRESHOLDS, "en");
    expect(close.reason).toContain("too close");
    expect(decide([], DEFAULT_THRESHOLDS, "en").reason).toBe("No candidate found in the street directory.");
    expect(decide([], DEFAULT_THRESHOLDS).reason).toBe("Kein Kandidat im Straßenverzeichnis gefunden.");
  });

  it("benennt den Grundwort-Deckel in der Zielsprache", () => {
    expect(scoreStreetName("Henrichweg", "Heinrichstraße", "en").cappedBy).toBe(
      "Street type conflict (weg vs. strasse)",
    );
    expect(scoreStreetName("Henrichweg", "Heinrichstraße").cappedBy).toContain("Grundwort");
  });
});

describe("Sprache: Service", () => {
  const { service } = createFixtureService();

  it("liefert speech pro Anfrage auf Englisch", async () => {
    const result = await service.resolveAddress({
      street: "Torstraße 12a",
      postalCode: FIXTURE_POSTAL_CODE,
      language: "en",
    });
    expect(result.speech).toBe("I have noted: Torstraße 12 a in 1 0 1 1 5 Berlin. Is that correct?");
    expect(result.reason).toContain("margin");
  });

  it("prüft Postleitzahlen auf Englisch", async () => {
    const confirmed = await service.resolvePostalCode("10115", "en");
    expect(confirmed.speech).toBe("1 0 1 1 5, that is Berlin. Correct?");
    expect(confirmed.reason).toBe("Postal code 10115 is unambiguous: Berlin.");
    const choice = await service.resolvePostalCode("12345", "en");
    expect(choice.speech).toContain("First: Altstadt");
  });

  it("bestätigt und übergibt auf Englisch", () => {
    const selected = service.selectCandidate({
      street: "Torstraße",
      postalCode: "10115",
      locality: "Berlin",
      language: "en",
    });
    expect(selected.speech).toBe("Alright, I am noting Torstraße in 1 0 1 1 5 Berlin.");
    expect(service.flagForHuman({ reason: "rejected" }, "en").speech).toContain("colleague");
  });

  it("nutzt die Server-Sprache als Standard", async () => {
    const { service: english } = createFixtureService({ language: "en" });
    const result = await english.resolveAddress({ street: "Torstraße", postalCode: FIXTURE_POSTAL_CODE });
    expect(result.speech).toStartWith("I have noted");
    const { service: german } = createFixtureService();
    expect((await german.resolveAddress({ street: "Torstraße", postalCode: FIXTURE_POSTAL_CODE })).speech).toStartWith(
      "Ich habe notiert",
    );
  });
});

describe("Sprache: Prompts unter der Haube", () => {
  it("liefert MCP-Instructions und Tool-Texte in beiden Sprachen", () => {
    expect(mcpTexts("en").instructions).toContain("Conversation flow");
    expect(mcpTexts("de").instructions).toContain("Ablauf im Gespräch");
    expect(mcpTexts("en").tools.resolve_postal_code.title).toBe("Check postal code");
    expect(Object.keys(mcpTexts("en").tools).sort()).toEqual(Object.keys(mcpTexts("de").tools).sort());
  });

  it("rendert den API-Leitfaden in der Zielsprache", () => {
    expect(apiGuideMarkdown(DEFAULT_THRESHOLDS, "en")).toContain("## Conversation flow");
    expect(apiGuideMarkdown(DEFAULT_THRESHOLDS, "de")).toContain("## Gesprächsablauf");
  });

  it("baut die OpenAPI-Beschreibung in der Zielsprache, Struktur bleibt gleich", () => {
    const en = buildOpenApiDocument("en");
    const de = buildOpenApiDocument("de");
    expect(en.info.description).toContain("phone agents");
    expect(de.info.description).toContain("Telefonagenten");
    expect(Object.keys(en.paths)).toEqual(Object.keys(de.paths));
    expect(en.paths["/api/address"].post.requestBody.content["application/json"].schema.properties.language).toBeDefined();
  });
});
