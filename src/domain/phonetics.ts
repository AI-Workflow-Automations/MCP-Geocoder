import { foldDiacritics } from "./normalization.js";

/**
 * Kölner Phonetik (Postel 1969).
 *
 * Warum nicht Soundex: Soundex ist auf englische Aussprache gebaut. Genau die
 * Verwechslungen, die am deutschen Telefon entstehen - "Meier"/"Mayer",
 * "Heinrich"/"Henrich" - fängt die Kölner Phonetik ab, Soundex nicht.
 */

/** Kontextfreie Codes. Buchstaben mit Kontextregeln (P, D, T, C, X) stehen in encodeLetter. */
const SIMPLE_CODES: Readonly<Record<string, string>> = {
  A: "0",
  E: "0",
  I: "0",
  J: "0",
  O: "0",
  U: "0",
  Y: "0",
  H: "",
  B: "1",
  F: "3",
  V: "3",
  W: "3",
  G: "4",
  K: "4",
  Q: "4",
  L: "5",
  M: "6",
  N: "6",
  R: "7",
  S: "8",
  Z: "8",
};

const C_HARD_AFTER_START = new Set(["A", "H", "K", "L", "O", "Q", "R", "U", "X"]);
const C_HARD_INSIDE = new Set(["A", "H", "K", "O", "Q", "U", "X"]);
const SIBILANTS = new Set(["S", "Z"]);
const BEFORE_SIBILANT = new Set(["C", "S", "Z"]);
const BEFORE_X_AS_8 = new Set(["C", "K", "Q"]);

/** Regelwerk für ein einzelnes Zeichen. Kontext: Vorgänger, Nachfolger, Wortanfang. */
function encodeLetter(char: string, previous: string | undefined, next: string | undefined, isFirst: boolean): string {
  const simple = SIMPLE_CODES[char];
  if (simple !== undefined) return simple;
  switch (char) {
    case "P":
      return next === "H" ? "3" : "1";
    case "D":
    case "T":
      return next && BEFORE_SIBILANT.has(next) ? "8" : "2";
    case "C":
      return encodeC(previous, next, isFirst);
    case "X":
      return previous && BEFORE_X_AS_8.has(previous) ? "8" : "48";
    default:
      return "";
  }
}

/** C ist der einzige Buchstabe mit drei Kontextregeln - deshalb eigene Funktion. */
function encodeC(previous: string | undefined, next: string | undefined, isFirst: boolean): string {
  if (isFirst) return next && C_HARD_AFTER_START.has(next) ? "4" : "8";
  if (previous && SIBILANTS.has(previous)) return "8";
  return next && C_HARD_INSIDE.has(next) ? "4" : "8";
}

/** Phonetischer Code eines Wortes. Gleicher Code bedeutet: klingt am Telefon gleich. */
export function encodeWord(word: string): string {
  const letters = foldDiacritics(word)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!letters) return "";

  let raw = "";
  for (let i = 0; i < letters.length; i++) {
    raw += encodeLetter(letters[i], letters[i - 1], letters[i + 1], i === 0);
  }

  let collapsed = "";
  for (const digit of raw) {
    if (digit !== collapsed.at(-1)) collapsed += digit;
  }
  // Nullen stehen für Vokale: nur die führende bleibt erhalten
  return collapsed[0] + collapsed.slice(1).replace(/0/g, "");
}

/** Phonetischer Code einer Wortfolge, Wort für Wort. */
export function encodePhrase(phrase: string): string {
  return phrase.split(/\s+/).filter(Boolean).map(encodeWord).join(" ").trim();
}
