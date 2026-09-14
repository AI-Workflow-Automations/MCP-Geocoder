/**
 * Fachliche Typen der Adresserfassung.
 *
 * Diese Datei kennt weder HTTP noch MCP noch eine Datenquelle. Alles, was
 * hier steht, beschreibt das Problem - nicht seine technische Umsetzung.
 */

/** Wie sicher ist die Zuordnung - und was soll der Telefonagent damit tun? */
export type MatchStatus =
  /** Eindeutig. Übernehmen, einmal rückbestätigen. */
  | "confirmed"
  /** Mehrere plausible Treffer. Auswahl vorlesen. */
  | "ambiguous"
  /** Kein tragfähiger Treffer. An einen Menschen übergeben. */
  | "unresolved";

/** Sprache, in der der Agent spricht - gilt für speech, reason und cappedBy. */
export type Language = "de" | "en";

/** Einzelscores einer Bewertung - macht Fehltreffer im Call-Log nachvollziehbar. */
export interface ScoreBreakdown {
  /** Zeichenähnlichkeit des Wortstamms */
  lexical: number;
  /** Klangähnlichkeit des Wortstamms (Kölner Phonetik) */
  phonetic: number;
  /** Fehlertoleranter Tokenvergleich */
  token: number;
  /** Übereinstimmung des Grundworts (Straße, Weg, Platz, ...) */
  streetType: number;
  /** Gewichtete Gesamtbewertung, 0..1 */
  total: number;
  /** Gesetzt, wenn ein Regelwerk die Bewertung gedeckelt hat */
  cappedBy?: string;
}

/** Ein Straßenkandidat mit Bewertung. */
export interface StreetCandidate {
  /** Amtliche Schreibweise */
  street: string;
  postalCode: string;
  locality: string;
  borough?: string;
  suburb?: string;
  federalState?: string;
  /** 0..1 */
  confidence: number;
  /** Herkunft des Kandidaten */
  source: DataSource;
  breakdown?: ScoreBreakdown;
}

export type DataSource = "openplz" | "photon";

export interface Locality {
  postalCode: string;
  locality: string;
  municipality?: string;
  district?: string;
  federalState?: string;
}

/** Was im Gespräch verstanden wurde - unverändert, fürs Protokoll. */
export interface HeardAddress {
  postalCode?: string;
  street?: string;
  houseNumber?: string;
}

/** Antwort auf eine Adressanfrage. */
export interface AddressResolution {
  status: MatchStatus;
  /** true => Call flaggen und an einen Menschen geben, nichts raten */
  needsHuman: boolean;
  /** Bester Treffer, fehlt bei status "unresolved" */
  best?: StreetCandidate;
  /** Maximal drei, absteigend nach confidence */
  candidates: StreetCandidate[];
  /** Fertiger Satz für die Sprachausgabe, in der angeforderten Sprache */
  speech: string;
  heard: HeardAddress;
  /** Klartext-Begründung fürs Call-Log */
  reason: string;
}

/** Antwort auf eine Postleitzahlanfrage. */
export interface PostalCodeResolution {
  status: MatchStatus;
  needsHuman: boolean;
  postalCode?: string;
  localities: Locality[];
  speech: string;
  reason: string;
}

/** Entscheidung des Regelwerks über eine Kandidatenliste. */
export interface MatchDecision {
  status: MatchStatus;
  needsHuman: boolean;
  reason: string;
}
