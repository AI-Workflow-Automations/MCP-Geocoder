import type { Language } from "../domain/types.js";

/**
 * Sätze, die der Agent wortwörtlich vorliest - je Sprache ein vollständiger Satz.
 * Zentral, damit Tonfall und Anrede einheitlich bleiben und keine Sprache
 * einen Satz vergisst: das Interface zwingt beide Sammlungen auf denselben Umfang.
 */
export interface Phrases {
  /** Ordnungswörter für Auswahlfragen: "die erste" kommt am Telefon sicherer an als ein Name. */
  ordinals: readonly string[];
  /** Verbindungswort in Hausnummernbereichen: "3 bis 5" / "3 to 5". */
  rangeWord: string;
  confirmAddress: (spokenAddress: string) => string;
  chooseAddress: (spokenChoices: string) => string;
  addressUnresolved: string;
  addressRecorded: (spokenAddress: string) => string;
  postalCodeNotUnderstood: string;
  postalCodeUnknown: (spokenCode: string) => string;
  postalCodeConfirm: (spokenCode: string, locality: string) => string;
  postalCodeChoose: (spokenCode: string, spokenChoices: string) => string;
  handoverToHuman: string;
}

const de: Phrases = {
  ordinals: ["Erstens", "Zweitens", "Drittens", "Viertens", "Fünftens"],
  rangeWord: "bis",
  confirmAddress: (spokenAddress) => `Ich habe notiert: ${spokenAddress}. Stimmt das so?`,
  chooseAddress: (spokenChoices) => `Da habe ich mehrere Möglichkeiten. ${spokenChoices}. Welche davon ist richtig?`,
  addressUnresolved:
    "Die Adresse habe ich nicht sicher verstanden. Ich gebe das an eine Kollegin oder einen Kollegen weiter, damit nichts Falsches im System landet.",
  addressRecorded: (spokenAddress) => `Gut, ich notiere ${spokenAddress}.`,
  postalCodeNotUnderstood: "Die Postleitzahl habe ich nicht verstanden. Nennen Sie mir bitte die fünf Ziffern einzeln.",
  postalCodeUnknown: (spokenCode) =>
    `Zu der Postleitzahl ${spokenCode} finde ich keinen Ort. Nennen Sie mir bitte die Postleitzahl noch einmal, Ziffer für Ziffer.`,
  postalCodeConfirm: (spokenCode, locality) => `${spokenCode}, das ist ${locality}. Richtig?`,
  postalCodeChoose: (spokenCode, spokenChoices) =>
    `Zu ${spokenCode} gehören mehrere Orte. ${spokenChoices}. Welcher ist es?`,
  handoverToHuman:
    "Damit da nichts Falsches im System landet, gebe ich Sie an eine Kollegin oder einen Kollegen weiter. Einen Moment bitte.",
};

const en: Phrases = {
  ordinals: ["First", "Second", "Third", "Fourth", "Fifth"],
  rangeWord: "to",
  confirmAddress: (spokenAddress) => `I have noted: ${spokenAddress}. Is that correct?`,
  chooseAddress: (spokenChoices) => `I have several possibilities here. ${spokenChoices}. Which one is right?`,
  addressUnresolved:
    "I did not understand the address with certainty. I will pass this on to a colleague so that nothing incorrect ends up in the system.",
  addressRecorded: (spokenAddress) => `Alright, I am noting ${spokenAddress}.`,
  postalCodeNotUnderstood: "I did not understand the postal code. Please tell me the five digits one by one.",
  postalCodeUnknown: (spokenCode) =>
    `I cannot find a place for the postal code ${spokenCode}. Please tell me the postal code once more, digit by digit.`,
  postalCodeConfirm: (spokenCode, locality) => `${spokenCode}, that is ${locality}. Correct?`,
  postalCodeChoose: (spokenCode, spokenChoices) =>
    `Several places belong to ${spokenCode}. ${spokenChoices}. Which one is it?`,
  handoverToHuman:
    "So that nothing incorrect ends up in the system, I will pass you on to a colleague. One moment, please.",
};

export const PHRASES: Record<Language, Phrases> = { de, en };
