import { GeocoderService } from "../src/application/geocoder-service.js";
import type {
  DirectoryStreet,
  EscalationEntry,
  EscalationSink,
  RankedStreet,
  StreetDirectory,
  StreetSearch,
} from "../src/domain/ports.js";
import { DEFAULT_THRESHOLDS } from "../src/domain/scoring.js";
import type { Locality } from "../src/domain/types.js";

/**
 * Fixtures: ein erfundenes, aber realistisches Straßenverzeichnis.
 * Enthält gezielt die Paare, an denen ein naiver Abgleich scheitert.
 */
export const FIXTURE_POSTAL_CODE = "10115";
export const FIXTURE_LOCALITY = "Berlin";

export const FIXTURE_STREETS: string[] = [
  // Das Kernpaar: fast gleicher Stamm, anderes Grundwort
  "Heinrichstraße",
  "Henrichweg",
  "Heinrichsplatz",
  // Gleicher Stamm, drei Grundwörter
  "Berliner Straße",
  "Berliner Allee",
  "Berliner Ring",
  // Zusammengesetzt, ein Grundwort im Stamm
  "Bahnhofstraße",
  "Bahnhofsplatz",
  // Umlaut
  "Mühlenweg",
  "Mühlenstraße",
  // Bindestriche
  "Ernst-Reuter-Platz",
  // Kurze Namen ohne Grundwort-Suffix
  "Am Markt",
  "Am Wall",
  "Neuer Weg",
  "Neuer Wall",
  // Normale Nachbarn
  "Gartenstraße",
  "Kastanienallee",
  "Invalidenstraße",
  "Ackerstraße",
  "Zionskirchstraße",
  "Torstraße",
  "Chausseestraße",
  "Tieckstraße",
  "Schlegelstraße",
  "Habersaathstraße",
];

export class FixtureDirectory implements StreetDirectory {
  readonly name = "fixture";
  constructor(private readonly streets: string[] = FIXTURE_STREETS) {}

  async listStreets(postalCode: string): Promise<DirectoryStreet[]> {
    if (postalCode !== FIXTURE_POSTAL_CODE) return [];
    return this.streets.map((street) => ({ street, postalCode, locality: FIXTURE_LOCALITY }));
  }

  async listLocalities(postalCode: string): Promise<Locality[]> {
    if (postalCode === FIXTURE_POSTAL_CODE) return [{ postalCode, locality: FIXTURE_LOCALITY }];
    if (postalCode === "99999") return [];
    if (postalCode === "12345") {
      return [
        { postalCode, locality: "Altstadt" },
        { postalCode, locality: "Neustadt" },
      ];
    }
    return [];
  }
}

/** Suche, die nichts findet - erzwingt, dass das Verzeichnis allein trägt. */
export class EmptySearch implements StreetSearch {
  readonly name = "empty-search";
  async search(): Promise<RankedStreet[]> {
    return [];
  }
}

/** Suche, die einen Treffer aus einer anderen PLZ liefert. */
export class ForeignSearch implements StreetSearch {
  readonly name = "foreign-search";
  constructor(private readonly hit: RankedStreet) {}
  async search(): Promise<RankedStreet[]> {
    return [this.hit];
  }
}

export class RecordingEscalations implements EscalationSink {
  readonly entries: EscalationEntry[] = [];
  record(entry: EscalationEntry): void {
    this.entries.push(entry);
  }
}

export function createFixtureService(overrides: Partial<ConstructorParameters<typeof GeocoderService>[0]> = {}) {
  const escalations = new RecordingEscalations();
  const service = new GeocoderService({
    directory: new FixtureDirectory(),
    search: new EmptySearch(),
    escalations,
    thresholds: DEFAULT_THRESHOLDS,
    serviceAreaPostalCodes: [FIXTURE_POSTAL_CODE],
    ...overrides,
  });
  return { service, escalations };
}
