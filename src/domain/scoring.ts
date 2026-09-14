import { normalizeStreetName, significantTokens, splitStreetName } from "./normalization.js";
import { encodePhrase } from "./phonetics.js";
import { REASONS } from "./reasons.js";
import { editSimilarity, fuzzyTokenSimilarity, jaroWinkler } from "./similarity.js";
import type { Language, ScoreBreakdown, StreetCandidate } from "./types.js";

/**
 * Schwellwerte und Gewichte des Abgleichs. Werden injiziert, nicht importiert -
 * so lassen sie sich im Test festnageln und im Betrieb aus der Umgebung lesen.
 */
export interface MatchingThresholds {
  /** Ab hier wird ohne Auswahlfrage übernommen (mit Rückbestätigung). */
  autoAccept: number;
  /** Ab hier wird eine Auswahl vorgelesen. Darunter: Übergabe an einen Menschen. */
  ambiguous: number;
  /** Mindestabstand zum Zweitplatzierten für eine automatische Übernahme. */
  minimumMargin: number;
  /** Kandidaten weiter als dieser Abstand hinter dem Besten werden nicht vorgelesen. */
  suggestionBand: number;
}

export const DEFAULT_THRESHOLDS: MatchingThresholds = {
  autoAccept: 0.85,
  ambiguous: 0.7,
  minimumMargin: 0.08,
  suggestionBand: 0.08,
};

/**
 * Gewichtung. Der Stamm entscheidet, das Grundwort bestätigt nur.
 * Schreibweise und Klangbild zählen fast gleich viel - am Telefon ist die
 * Schreibweise das Unzuverlässigere von beiden.
 */
const WEIGHTS = { lexical: 0.45, phonetic: 0.35, token: 0.1, streetType: 0.1 } as const;

/**
 * Deckel bei widersprüchlichem Grundwort.
 *
 * "Henrichweg" und "Heinrichstraße" haben praktisch denselben Stamm und
 * denselben Klang - additiv gewichtet käme das über die Auto-Schwelle und
 * der Agent würde still die falsche Straße übernehmen. Ein anderes Grundwort
 * ist aber ein hartes Signal: im amtlichen Verzeichnis sind das zwei Straßen.
 * Deshalb wird so ein Kandidat nie automatisch bestätigt, sondern höchstens
 * zur Auswahl vorgelesen.
 */
const STREET_TYPE_CONFLICT_CAP = 0.84;

export function scoreStreetName(heard: string, candidate: string, language: Language = "de"): ScoreBreakdown {
  const heardParts = splitStreetName(heard);
  const candidateParts = splitStreetName(candidate);

  const lexical = Math.max(
    jaroWinkler(heardParts.stem, candidateParts.stem),
    editSimilarity(heardParts.stem, candidateParts.stem),
  );
  const phonetic = jaroWinkler(encodePhrase(heardParts.stem), encodePhrase(candidateParts.stem));
  const token = fuzzyTokenSimilarity(significantTokens(heard), significantTokens(candidate));

  const bothTyped = Boolean(heardParts.type && candidateParts.type);
  const typesConflict = bothTyped && heardParts.type !== candidateParts.type;
  // Gleiches Grundwort bestätigt, fehlendes auf einer Seite ist neutral
  const streetType = typesConflict ? 0 : bothTyped ? 1 : 0.5;

  let total =
    WEIGHTS.lexical * lexical + WEIGHTS.phonetic * phonetic + WEIGHTS.token * token + WEIGHTS.streetType * streetType;
  let cappedBy: string | undefined;
  if (typesConflict && total > STREET_TYPE_CONFLICT_CAP) {
    total = STREET_TYPE_CONFLICT_CAP;
    cappedBy = REASONS[language].streetTypeConflict(heardParts.type ?? "", candidateParts.type ?? "");
  }

  return { lexical, phonetic, token, streetType, total: roundScore(total), cappedBy };
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Absteigend sortieren, Schreibvarianten zusammenführen, Vorschlagsband beschneiden.
 *
 * Drei Optionen vorzulesen, von denen zwei offensichtlich danebenliegen,
 * kostet Gesprächszeit und verleitet den Anrufer, irgendetwas zu bestätigen.
 */
export function rankCandidates(
  candidates: StreetCandidate[],
  thresholds: MatchingThresholds,
  limit = 3,
): StreetCandidate[] {
  const byIdentity = new Map<string, StreetCandidate>();
  for (const candidate of candidates) {
    const identity = `${normalizeStreetName(candidate.street)}|${candidate.postalCode}|${candidate.locality.toLowerCase()}`;
    const existing = byIdentity.get(identity);
    if (!existing || candidate.confidence > existing.confidence) byIdentity.set(identity, candidate);
  }
  const sorted = [...byIdentity.values()].sort((a, b) => b.confidence - a.confidence);
  if (sorted.length === 0) return sorted;
  const cutoff = sorted[0].confidence - thresholds.suggestionBand;
  return sorted.filter((candidate) => candidate.confidence >= cutoff).slice(0, limit);
}
