/**
 * Textaufbereitung vor der Sprachausgabe.
 *
 * Viele TTS-Pipelines normalisieren Zahlen nach englischem Muster oder gar
 * nicht. "10115" als Zahl gelesen wird zu "zehntausendeinhundertfünfzehn" -
 * am Telefon unbrauchbar. Deshalb kommt jeder Satz hier fertig formatiert
 * heraus, statt sich auf die Normalisierung der Sprachausgabe zu verlassen.
 *
 * Die Sprache bestimmt Satzbau und Ordnungswörter. Abkürzungen in Straßennamen
 * werden immer deutsch ausgeschrieben - die Namen selbst sind deutsch, auch
 * wenn der Agent Englisch spricht.
 */

import type { Language } from "../domain/types.js";
import { DEFAULT_LANGUAGE } from "./language.js";
import { PHRASES, type Phrases } from "./phrases.js";

const SPOKEN_ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // Ohne \b: "Torstr." hat keine Wortgrenze vor dem "str"
  [/Str\.(?=\s|$)/g, "Straße"],
  [/str\.(?=\s|$)/g, "straße"],
  [/\bNr\./g, "Nummer"],
  [/\bDr\./g, "Doktor"],
  [/\bProf\./g, "Professor"],
  [/\bSt\./g, "Sankt"],
  [/\bz\.B\./g, "zum Beispiel"],
  [/\bca\./g, "circa"],
  [/\bggf\./g, "gegebenenfalls"],
  [/\bbzw\./g, "beziehungsweise"],
  [/\bu\.a\./g, "unter anderem"],
];

/** Satzsammlung der Sprache. */
export function phrasesFor(language: Language = DEFAULT_LANGUAGE): Phrases {
  return PHRASES[language];
}

/** Postleitzahl immer ziffernweise: "1 0 1 1 5". */
export function speakPostalCode(postalCode: string): string {
  return postalCode.replace(/\D/g, "").split("").join(" ");
}

/** Hausnummer sprechbar: zweistellig als Zahl, ab drei Stellen ziffernweise, Zusatz getrennt. */
export function speakHouseNumber(houseNumber: string, language: Language = DEFAULT_LANGUAGE): string {
  const match = houseNumber.match(/^(\d+)\s*([a-zA-Z])?(?:\s*[-/]\s*(\d+)\s*([a-zA-Z])?)?$/);
  if (!match) return houseNumber;
  const [, first, firstSuffix, second, secondSuffix] = match;
  const parts = [speakNumber(first)];
  if (firstSuffix) parts.push(firstSuffix.toLowerCase());
  if (second) {
    parts.push(phrasesFor(language).rangeWord, speakNumber(second));
    if (secondSuffix) parts.push(secondSuffix.toLowerCase());
  }
  return parts.join(" ");
}

function speakNumber(value: string): string {
  const digits = value.replace(/^0+/, "") || "0";
  return digits.length >= 3 ? digits.split("").join(" ") : digits;
}

export function expandAbbreviations(text: string): string {
  return SPOKEN_ABBREVIATIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

/** Vollständig sprechbare Adresse. "in" steht in beiden Sprachen gleich. */
export function speakAddress(
  street: string,
  houseNumber?: string,
  postalCode?: string,
  locality?: string,
  language: Language = DEFAULT_LANGUAGE,
): string {
  const parts = [expandAbbreviations(street)];
  if (houseNumber) parts.push(speakHouseNumber(houseNumber, language));
  if (postalCode) parts.push(`in ${speakPostalCode(postalCode)}`);
  if (locality) parts.push(expandAbbreviations(locality));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Nummerierte Aufzählung: "die erste" kommt am Telefon zuverlässiger an als ein wiederholter Name. */
export function speakChoices(options: string[], language: Language = DEFAULT_LANGUAGE): string {
  const { ordinals } = phrasesFor(language);
  return options.map((option, index) => `${ordinals[index] ?? `${index + 1}.`}: ${option}`).join(". ");
}
