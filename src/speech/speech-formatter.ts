/**
 * Textaufbereitung vor der Sprachausgabe.
 *
 * Viele TTS-Pipelines normalisieren Zahlen nach englischem Muster oder gar
 * nicht. "10115" als Zahl gelesen wird zu "zehntausendeinhundertfünfzehn" -
 * am Telefon unbrauchbar. Deshalb kommt jeder Satz hier fertig formatiert
 * heraus, statt sich auf die Normalisierung der Sprachausgabe zu verlassen.
 */

const ORDINALS = ["Erstens", "Zweitens", "Drittens", "Viertens", "Fünftens"];

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

/** Postleitzahl immer ziffernweise: "1 0 1 1 5". */
export function speakPostalCode(postalCode: string): string {
  return postalCode.replace(/\D/g, "").split("").join(" ");
}

/** Hausnummer sprechbar: zweistellig als Zahl, ab drei Stellen ziffernweise, Zusatz getrennt. */
export function speakHouseNumber(houseNumber: string): string {
  const match = houseNumber.match(/^(\d+)\s*([a-zA-Z])?(?:\s*[-/]\s*(\d+)\s*([a-zA-Z])?)?$/);
  if (!match) return houseNumber;
  const [, first, firstSuffix, second, secondSuffix] = match;
  const parts = [speakNumber(first)];
  if (firstSuffix) parts.push(firstSuffix.toLowerCase());
  if (second) {
    parts.push("bis", speakNumber(second));
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

/** Vollständig sprechbare Adresse. */
export function speakAddress(street: string, houseNumber?: string, postalCode?: string, locality?: string): string {
  const parts = [expandAbbreviations(street)];
  if (houseNumber) parts.push(speakHouseNumber(houseNumber));
  if (postalCode) parts.push(`in ${speakPostalCode(postalCode)}`);
  if (locality) parts.push(expandAbbreviations(locality));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Nummerierte Aufzählung: "die erste" kommt am Telefon zuverlässiger an als ein wiederholter Name. */
export function speakChoices(options: string[]): string {
  return options.map((option, index) => `${ORDINALS[index] ?? `${index + 1}.`}: ${option}`).join(". ");
}

/** Sätze, die der Agent wortwörtlich vorliest. Zentral, damit Tonfall und Anrede einheitlich bleiben. */
export const phrases = {
  confirmAddress: (spokenAddress: string) => `Ich habe notiert: ${spokenAddress}. Stimmt das so?`,
  chooseAddress: (spokenChoices: string) =>
    `Da habe ich mehrere Möglichkeiten. ${spokenChoices}. Welche davon ist richtig?`,
  addressUnresolved:
    "Die Adresse habe ich nicht sicher verstanden. Ich gebe das an eine Kollegin oder einen Kollegen weiter, damit nichts Falsches im System landet.",
  addressRecorded: (spokenAddress: string) => `Gut, ich notiere ${spokenAddress}.`,
  postalCodeNotUnderstood: "Die Postleitzahl habe ich nicht verstanden. Nennen Sie mir bitte die fünf Ziffern einzeln.",
  postalCodeUnknown: (spokenCode: string) =>
    `Zu der Postleitzahl ${spokenCode} finde ich keinen Ort. Nennen Sie mir bitte die Postleitzahl noch einmal, Ziffer für Ziffer.`,
  postalCodeConfirm: (spokenCode: string, locality: string) => `${spokenCode}, das ist ${locality}. Richtig?`,
  postalCodeChoose: (spokenCode: string, spokenChoices: string) =>
    `Zu ${spokenCode} gehören mehrere Orte. ${spokenChoices}. Welcher ist es?`,
  handoverToHuman:
    "Damit da nichts Falsches im System landet, gebe ich Sie an eine Kollegin oder einen Kollegen weiter. Einen Moment bitte.",
} as const;
