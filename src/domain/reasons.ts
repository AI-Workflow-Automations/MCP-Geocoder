import type { Language } from "./types.js";

/**
 * Klartext-Begründungen fürs Call-Log, je Sprache.
 *
 * Die Texte liest kein Anrufer, aber der Agent und später der Mensch, der das
 * Protokoll auswertet. Deshalb folgen sie der Sprache des Agenten.
 */
export interface ReasonTexts {
  bestLabel: (street: string, confidence: string) => string;
  noCandidate: string;
  belowEscalation: (bestLabel: string, threshold: number) => string;
  confirmed: (bestLabel: string, margin: string) => string;
  tooClose: (best: string, second: string, margin: string) => string;
  capped: (bestLabel: string, cappedBy: string) => string;
  belowAuto: (bestLabel: string, threshold: number) => string;
  streetTypeConflict: (heardType: string, candidateType: string) => string;
  postalCodeMissing: string;
  postalCodeUnknown: (postalCode: string) => string;
  postalCodeUnique: (postalCode: string, locality: string) => string;
  postalCodeMultiple: (postalCode: string, count: number) => string;
}

const de: ReasonTexts = {
  bestLabel: (street, confidence) => `"${street}" bei ${confidence}`,
  noCandidate: "Kein Kandidat im Straßenverzeichnis gefunden.",
  belowEscalation: (bestLabel, threshold) =>
    `Bester Treffer ${bestLabel} - unter der Eskalationsschwelle ${threshold}.`,
  confirmed: (bestLabel, margin) => `${bestLabel}, Abstand zum nächsten Treffer ${margin}.`,
  tooClose: (best, second, margin) =>
    `"${best}" und "${second}" liegen mit ${margin} zu dicht beieinander - Auswahl vorlesen.`,
  capped: (bestLabel, cappedBy) => `${bestLabel} - gedeckelt: ${cappedBy}.`,
  belowAuto: (bestLabel, threshold) => `${bestLabel} - unter der Auto-Schwelle ${threshold}.`,
  streetTypeConflict: (heardType, candidateType) => `Grundwort widerspricht sich (${heardType} vs. ${candidateType})`,
  postalCodeMissing: "Keine fünfstellige Postleitzahl im Transkript.",
  postalCodeUnknown: (postalCode) => `Postleitzahl ${postalCode} nicht im Verzeichnis.`,
  postalCodeUnique: (postalCode, locality) => `Postleitzahl ${postalCode} eindeutig: ${locality}.`,
  postalCodeMultiple: (postalCode, count) => `Postleitzahl ${postalCode} gehört zu ${count} Orten.`,
};

const en: ReasonTexts = {
  bestLabel: (street, confidence) => `"${street}" at ${confidence}`,
  noCandidate: "No candidate found in the street directory.",
  belowEscalation: (bestLabel, threshold) => `Best match ${bestLabel} - below the escalation threshold ${threshold}.`,
  confirmed: (bestLabel, margin) => `${bestLabel}, margin to the next candidate ${margin}.`,
  tooClose: (best, second, margin) => `"${best}" and "${second}" are too close at ${margin} - read out the choices.`,
  capped: (bestLabel, cappedBy) => `${bestLabel} - capped: ${cappedBy}.`,
  belowAuto: (bestLabel, threshold) => `${bestLabel} - below the auto-accept threshold ${threshold}.`,
  streetTypeConflict: (heardType, candidateType) => `Street type conflict (${heardType} vs. ${candidateType})`,
  postalCodeMissing: "No five-digit postal code in the transcript.",
  postalCodeUnknown: (postalCode) => `Postal code ${postalCode} is not in the directory.`,
  postalCodeUnique: (postalCode, locality) => `Postal code ${postalCode} is unambiguous: ${locality}.`,
  postalCodeMultiple: (postalCode, count) => `Postal code ${postalCode} belongs to ${count} places.`,
};

export const REASONS: Record<Language, ReasonTexts> = { de, en };
