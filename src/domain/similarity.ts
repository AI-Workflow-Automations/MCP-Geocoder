/**
 * Ähnlichkeitsmaße. Bewusst ohne Abhängigkeiten - der Server soll klein bleiben
 * und die Maße sollen im Test einzeln nachrechenbar sein.
 */

/** Damerau-Levenshtein mit Vertauschungen: Spracherkennung dreht Buchstaben gern um. */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      const isTransposition = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (isTransposition) matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
    }
  }
  return matrix[a.length][b.length];
}

/** Damerau-Levenshtein auf 0..1 normiert, 1 = identisch. */
export function editSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - damerauLevenshtein(a, b) / longest;
}

interface MatchTable {
  matches: number;
  matchedInA: boolean[];
  matchedInB: boolean[];
}

/** Zeichen, die innerhalb des Suchfensters in beiden Wörtern vorkommen. */
function findMatches(a: string, b: string): MatchTable {
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const matchedInA = new Array<boolean>(a.length).fill(false);
  const matchedInB = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j++) {
      if (matchedInB[j] || a[i] !== b[j]) continue;
      matchedInA[i] = true;
      matchedInB[j] = true;
      matches++;
      break;
    }
  }
  return { matches, matchedInA, matchedInB };
}

/** Halbe Anzahl der Zeichen, die passen, aber in anderer Reihenfolge stehen. */
function countTranspositions(a: string, b: string, table: MatchTable): number {
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!table.matchedInA[i]) continue;
    while (!table.matchedInB[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  return transpositions / 2;
}

/** Gemeinsamer Wortanfang, maximal vier Zeichen - der Winkler-Bonus. */
function commonPrefixLength(a: string, b: string): number {
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }
  return prefix;
}

/** Jaro-Winkler. Belohnt gleiche Wortanfänge - bei Straßennamen das stärkste Signal. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!(a.length && b.length)) return 0;

  const table = findMatches(a, b);
  if (table.matches === 0) return 0;

  const { matches } = table;
  const transpositions = countTranspositions(a, b, table);
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
  return jaro + commonPrefixLength(a, b) * 0.1 * (1 - jaro);
}

/**
 * Fehlertoleranter Tokenvergleich.
 *
 * Ein exakter Mengenvergleich reicht nicht: "henrich" und "heinrich" sind
 * zwei verschiedene Tokens und damit null Überlappung - obwohl genau das der
 * Fehler ist, den das Telefon produziert. Deshalb je Token der beste
 * Jaro-Winkler-Treffer der Gegenseite, in beide Richtungen gemittelt.
 */
export function fuzzyTokenSimilarity(a: string[], b: string[]): number {
  if (!(a.length && b.length)) return 0;
  const bestAverage = (tokens: string[], others: string[]): number =>
    tokens.reduce((sum, token) => sum + Math.max(...others.map((other) => jaroWinkler(token, other))), 0) /
    tokens.length;
  return (bestAverage(a, b) + bestAverage(b, a)) / 2;
}
