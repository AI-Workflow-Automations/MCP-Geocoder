import { describe, expect, it } from "bun:test";

import { createFixtureService, FIXTURE_POSTAL_CODE, ForeignSearch } from "./fixtures.js";

describe("GeocoderService", () => {
  const { service, escalations } = createFixtureService();

  describe("resolvePostalCode", () => {
    it("bestätigt eine eindeutige PLZ mit sprechbarem Satz", async () => {
      const result = await service.resolvePostalCode("1 0 1 1 5");
      expect(result.status).toBe("confirmed");
      expect(result.postalCode).toBe("10115");
      expect(result.speech).toBe("1 0 1 1 5, das ist Berlin. Richtig?");
    });

    it("bietet bei mehreren Orten eine Auswahl", async () => {
      const result = await service.resolvePostalCode("12345");
      expect(result.status).toBe("ambiguous");
      expect(result.speech).toContain("Erstens: Altstadt");
    });

    it("meldet unbekannte und unverständliche PLZ ohne Eskalation", async () => {
      expect((await service.resolvePostalCode("99999")).status).toBe("unresolved");
      expect((await service.resolvePostalCode("keine Ahnung")).needsHuman).toBe(false);
    });
  });

  describe("resolveAddress", () => {
    it("liefert einen TTS-fertigen Rückbestätigungssatz", async () => {
      const result = await service.resolveAddress({ street: "Torstraße 12a", postalCode: FIXTURE_POSTAL_CODE });
      expect(result.speech).toBe("Ich habe notiert: Torstraße 12 a in 1 0 1 1 5 Berlin. Stimmt das so?");
      expect(result.heard.houseNumber).toBe("12a");
    });

    it("eskaliert ohne PLZ und ohne Suchtreffer", async () => {
      const result = await service.resolveAddress({ street: "Torstraße" });
      expect(result.status).toBe("unresolved");
      expect(result.needsHuman).toBe(true);
    });

    it("wertet Suchtreffer aus fremder PLZ ab, verwirft sie aber nicht", async () => {
      const { service: withForeign } = createFixtureService({
        search: new ForeignSearch({ street: "Torstraße", postalCode: "10119", locality: "Berlin", rank: 0 }),
      });
      const result = await withForeign.resolveAddress({ street: "Torstraße", postalCode: "99999" });
      const foreign = result.candidates.find((c) => c.source === "photon");
      if (!foreign) throw new Error("Suchtreffer aus fremder PLZ fehlt");
      expect(foreign.confidence).toBeLessThan(1);
      expect(foreign.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("selectCandidate", () => {
    it("formatiert die erfasste Adresse", () => {
      const result = service.selectCandidate({
        street: "Torstraße",
        postalCode: "10115",
        locality: "Berlin",
        houseNumber: "12a",
      });
      expect(result.formatted).toBe("Torstraße 12a, 10115 Berlin");
      expect(result.speech).toContain("Torstraße 12 a in 1 0 1 1 5 Berlin");
    });
  });

  describe("flagForHuman", () => {
    it("protokolliert die Eskalation und liefert den Übergabesatz", () => {
      const result = service.flagForHuman({
        reason: "alle Vorschläge abgelehnt",
        heardStreet: "Zwitscherweg",
        attempts: 3,
      });
      expect(result.needsHuman).toBe(true);
      expect(escalations.entries.at(-1)?.reason).toBe("alle Vorschläge abgelehnt");
      expect(result.speech).toContain("weiter");
    });
  });

  describe("buildKeyterms", () => {
    it("priorisiert Ortsnamen und fehleranfällige Straßen", async () => {
      const list = await service.buildKeyterms([FIXTURE_POSTAL_CODE], 5);
      expect(list.keyterms[0]).toBe("Berlin");
      expect(list.keyterms).toHaveLength(5);
      expect(list.transcriberConfig.language).toBe("de");
    });

    it("verweigert ohne Einzugsgebiet", async () => {
      const { service: bare } = createFixtureService({ serviceAreaPostalCodes: [] });
      await expect(bare.buildKeyterms([])).rejects.toThrow("Keine Postleitzahlen");
    });
  });
});
