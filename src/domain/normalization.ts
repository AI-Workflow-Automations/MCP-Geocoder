/**
 * Normalisierung gesprochener Adressen.
 *
 * Transkripte sind unsauber: Füllwörter, Abkürzungen, Umlaute in jeder
 * denkbaren Schreibweise. Was hier nicht geglättet wird, kostet später
 * Konfidenz und damit eine unnötige Rückfrage.
 */

/** Grundwörter deutscher Straßennamen. Reihenfolge egal, es wird auf Suffix geprüft. */
export const STREET_TYPES = [
  "strasse",
  "platz",
  "weg",
  "gasse",
  "allee",
  "ring",
  "damm",
  "ufer",
  "chaussee",
  "steig",
  "graben",
  "markt",
  "wall",
] as const;

export type StreetType = (typeof STREET_TYPES)[number];

/** Wörter ohne eigene Aussage - sie dürfen den Vergleich nicht dominieren. */
const STOP_WORDS = new Set<string>([
  ...STREET_TYPES,
  "str",
  "an",
  "der",
  "den",
  "am",
  "zum",
  "zur",
  "auf",
  "im",
  "in",
  "bei",
  "vor",
]);

const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // "Heinrichstr." - angehängt, ohne Wortgrenze davor. \b würde hier nicht greifen.
  [/str\.?(?=\s|$)/gi, "strasse"],
  [/\bstrasze\b/gi, "strasse"],
  [/\bpl\.?\b/gi, "platz"],
  [/\bwg\.?\b/gi, "weg"],
  [/\bgs\.?\b/gi, "gasse"],
  [/\bst\.\s/gi, "sankt "],
  [/\ba\.\s?d\.\s?/gi, "an der "],
  [/\ba\.\s?m\.\s?/gi, "am "],
  [/\bgr\.\s/gi, "grosse "],
  [/\bkl\.\s/gi, "kleine "],
  [/\bdr\.\s/gi, "doktor "],
  [/\bprof\.\s/gi, "professor "],
];

/**
 * Füllwörter, ASCII-gefaltet notiert.
 * \b greift in JavaScript nur auf ASCII-Wortzeichen: gegen "ähm" würde
 * /\bähm\b/ nie matchen, gegen das gefaltete "aehm" schon. Deshalb wird
 * erst gefaltet und dann gefiltert.
 */
const FILLER_WORDS =
  /\b(aehm?|oehm?|hm+|also|genau|halt|ja|nee|ne|bitte|danke|ich wohne in( der)?|ich wohne|meine adresse ist|das ist( die)?|in der|in dem|die|der|das|dem|den|eine?)\b/gi;

/** Umlaute und ß auflösen, übrige Diakritika entfernen. */
export function foldDiacritics(input: string): string {
  return input
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vergleichsform eines Straßennamens: klein, gefaltet, ohne Abkürzungen,
 * ohne Füllwörter, Grundwort direkt angehängt.
 *
 * "Kastanien Allee", "Kastanienallee" und "Kastanien-Allee" ergeben denselben Wert.
 */
export function normalizeStreetName(input: string): string {
  let value = foldDiacritics(` ${input.toLowerCase()} `);
  value = value.replace(FILLER_WORDS, " ");
  for (const [pattern, replacement] of ABBREVIATIONS) {
    value = value.replace(pattern, replacement);
  }
  value = value.replace(/[^a-z0-9]+/g, " ").trim();
  // Grundwort ans vorangehende Wort ziehen - getrennte Schreibweisen vereinheitlichen
  const typePattern = new RegExp(`\\s+(${STREET_TYPES.join("|")})\\b`, "g");
  return value.replace(typePattern, "$1").replace(/\s+/g, " ").trim();
}

/** Zerlegt einen Namen in Wortstamm und Grundwort. */
export interface StreetNameParts {
  /** Der bedeutungstragende Teil, z.B. "kastanien" */
  stem: string;
  /** Das Grundwort, z.B. "allee" - fehlt, wenn keines erkennbar ist */
  type?: StreetType;
}

/**
 * Trennt Stamm und Grundwort.
 *
 * Der Stamm trägt praktisch die gesamte Information. Würde man ganze Namen
 * vergleichen, käme jede "-straße" allein durch das gemeinsame Grundwort
 * über die Eskalationsschwelle.
 */
export function splitStreetName(input: string): StreetNameParts {
  const normalized = normalizeStreetName(input);
  for (const type of STREET_TYPES) {
    if (normalized.endsWith(type) && normalized.length > type.length) {
      return { stem: normalized.slice(0, -type.length).trim(), type };
    }
  }
  return { stem: normalized };
}

/** Tokens eines Namens, Grundwort als eigenes Token. */
export function tokenize(input: string): string[] {
  const { stem, type } = splitStreetName(input);
  const tokens = stem.split(" ").filter(Boolean);
  if (type) tokens.push(type);
  return tokens;
}

/** Nur die bedeutungstragenden Tokens. Fällt auf alle zurück, wenn sonst nichts bliebe. */
export function significantTokens(input: string): string[] {
  const tokens = tokenize(input);
  const significant = tokens.filter((token) => !STOP_WORDS.has(token));
  return significant.length > 0 ? significant : tokens;
}

export interface StreetAndNumber {
  street: string;
  houseNumber?: string;
}

/** Trennt die Hausnummer ab, inklusive Zusatz ("12a", "3-5", "7 b"). */
export function splitHouseNumber(input: string): StreetAndNumber {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.*?)[\s,]+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)\.?$/);
  if (!match) return { street: trimmed };
  const street = match[1].trim();
  if (!street) return { street: trimmed };
  return { street, houseNumber: match[2].replace(/\s+/g, "") };
}

/** Deutsche Postleitzahl aus freiem Text - auch diktiert ("1 0 1 1 5"). */
export function extractPostalCode(input: string): string | undefined {
  const direct = input.match(/\b(\d{5})\b/);
  if (direct) return direct[1];
  const digitsOnly = input.replace(/\D/g, "");
  return digitsOnly.length === 5 ? digitsOnly : undefined;
}
