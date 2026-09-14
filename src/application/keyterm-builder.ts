import type { StreetDirectory } from "../domain/ports.js";

/**
 * Keyterm-Liste für den Transcriber (Deepgram Nova-3).
 *
 * Statt zu raten, welche Straßennamen im Einzugsgebiet vorkommen, wird die
 * Liste aus dem amtlichen Verzeichnis erzeugt und nach Fehleranfälligkeit
 * priorisiert: lange, seltene oder umlauthaltige Namen zuerst.
 *
 * Deepgram-Limits: maximal 100 Terme, je maximal 50 Zeichen, keine Intensifier.
 */

export const DEEPGRAM_MAX_TERMS = 100;
const DEEPGRAM_MAX_TERM_LENGTH = 50;

/** Namen, die jedes Modell ohnehin kennt - die verschwenden nur Plätze. */
const COMMON_STREET_NAMES = new Set([
  "hauptstraße",
  "bahnhofstraße",
  "schulstraße",
  "gartenstraße",
  "dorfstraße",
  "kirchstraße",
  "bergstraße",
  "lindenstraße",
  "waldstraße",
  "ringstraße",
  "poststraße",
  "mühlenweg",
  "am markt",
]);

const STREET_TYPE_SUFFIX = /\s?(Straße|Str\.|Weg|Platz|Allee|Ring|Damm|Gasse)$/i;

export interface KeytermList {
  keyterms: string[];
  /** Fertiger Block für die transcriber-Konfiguration */
  transcriberConfig: { provider: "deepgram"; model: "nova-3"; language: "de"; keyterm: string[] };
  stats: { postalCodes: string[]; streetsScanned: number; localitiesIncluded: number; truncatedTo: number };
}

/** Heuristik: wie wahrscheinlich verhört sich ein Telefon-Transcriber an diesem Namen? */
export function estimateDifficulty(name: string): number {
  let score = 0;
  if (/[äöüßÄÖÜ]/.test(name)) score += 3;
  const stem = name.replace(STREET_TYPE_SUFFIX, "").trim();
  if (/[- ]/.test(stem)) score += 2;
  score += Math.min(4, Math.floor(stem.length / 5));
  if (/^[A-ZÄÖÜ][a-zäöüß]+er\s/.test(name)) score += 1; // Herkunftsnamen: "Berliner", "Kölner"
  return score;
}

export class KeytermBuilder {
  constructor(private readonly directory: StreetDirectory) {}

  async build(postalCodes: string[], limit = DEEPGRAM_MAX_TERMS): Promise<KeytermList> {
    if (postalCodes.length === 0) {
      throw new Error(
        "Keine Postleitzahlen angegeben. Ohne Einzugsgebiet lässt sich keine sinnvolle Keyterm-Liste bauen.",
      );
    }

    const localityNames = new Set<string>();
    const streetNames = new Set<string>();
    for (const code of postalCodes) {
      const [localities, streets] = await Promise.all([
        this.directory.listLocalities(code).catch(() => []),
        this.directory.listStreets(code).catch(() => []),
      ]);
      for (const entry of localities) localityNames.add(entry.locality);
      for (const entry of streets) streetNames.add(entry.street);
    }

    // Ortsnamen zuerst: die fallen im Gespräch häufiger als jede einzelne Straße
    const ranked = [
      ...[...localityNames].map((name) => ({ name, score: 100 })),
      ...[...streetNames]
        .filter((name) => !COMMON_STREET_NAMES.has(name.toLowerCase()))
        .map((name) => ({ name, score: estimateDifficulty(name) })),
    ]
      .filter((entry) => entry.name.length > 0 && entry.name.length <= DEEPGRAM_MAX_TERM_LENGTH)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"));

    const keyterms = [...new Set(ranked.map((entry) => entry.name))].slice(0, Math.min(limit, DEEPGRAM_MAX_TERMS));

    return {
      keyterms,
      transcriberConfig: { provider: "deepgram", model: "nova-3", language: "de", keyterm: keyterms },
      stats: {
        postalCodes,
        streetsScanned: streetNames.size,
        localitiesIncluded: localityNames.size,
        truncatedTo: keyterms.length,
      },
    };
  }
}
