import type { Locality } from "./types.js";

/**
 * Ports zu den Datenquellen (Dependency Inversion).
 *
 * Die Anwendungsschicht kennt nur diese Schnittstellen. Ob dahinter OpenPLZ,
 * Photon oder im Test ein Fixture steht, ist ihr gleichgültig. Genau deshalb
 * laufen die Tests zu den schwierigen Fällen ohne Netz.
 */

/** Eine Straße, wie eine Datenquelle sie liefert - noch ohne Bewertung. */
export interface DirectoryStreet {
  street: string;
  postalCode: string;
  locality: string;
  borough?: string;
  suburb?: string;
  federalState?: string;
}

/** Amtliches Verzeichnis: grenzt den Suchraum über die Postleitzahl ein. */
export interface StreetDirectory {
  readonly name: string;
  /** Alle Straßen einer Postleitzahl. */
  listStreets(postalCode: string): Promise<DirectoryStreet[]>;
  /** Alle Orte einer Postleitzahl. */
  listLocalities(postalCode: string): Promise<Locality[]>;
}

/** Ergebnis einer fehlertoleranten Suche, inklusive Rang der Quelle. */
export interface RankedStreet extends DirectoryStreet {
  /** Position im Ranking der Quelle, 0 = bester Treffer */
  rank: number;
}

/** Fehlertolerante Suche: springt ein, wenn die Postleitzahl fehlt oder nicht trägt. */
export interface StreetSearch {
  readonly name: string;
  search(query: string, postalCode?: string, limit?: number): Promise<RankedStreet[]>;
}

/** Senke für Eskalationen - im Betrieb das Call-Log, im Test ein Array. */
export interface EscalationSink {
  record(entry: EscalationEntry): void;
}

export interface EscalationEntry {
  reason: string;
  heardStreet?: string;
  heardPostalCode?: string;
  attempts?: number;
}
