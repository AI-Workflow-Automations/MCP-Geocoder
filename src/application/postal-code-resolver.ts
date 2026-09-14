import { extractPostalCode } from "../domain/normalization.js";
import type { StreetDirectory } from "../domain/ports.js";
import type { PostalCodeResolution } from "../domain/types.js";
import { phrases, speakChoices, speakPostalCode } from "../speech/speech-formatter.js";

/**
 * PLZ-First-Dialog: erst die fünf Ziffern, dann alles andere.
 *
 * Ziffern überstehen Schmalband-Telefonie deutlich besser als Ortsnamen -
 * und eine bestätigte Postleitzahl schrumpft den Suchraum von hunderttausenden
 * Straßen auf ein paar Hundert.
 */
export class PostalCodeResolver {
  constructor(private readonly directory: StreetDirectory) {}

  async resolve(spoken: string): Promise<PostalCodeResolution> {
    const postalCode = extractPostalCode(spoken);
    if (!postalCode) {
      return {
        status: "unresolved",
        needsHuman: false,
        localities: [],
        speech: phrases.postalCodeNotUnderstood,
        reason: "Keine fünfstellige Postleitzahl im Transkript.",
      };
    }

    const localities = await this.directory.listLocalities(postalCode);
    const spokenCode = speakPostalCode(postalCode);

    if (localities.length === 0) {
      return {
        status: "unresolved",
        needsHuman: false,
        postalCode,
        localities,
        speech: phrases.postalCodeUnknown(spokenCode),
        reason: `Postleitzahl ${postalCode} nicht im Verzeichnis.`,
      };
    }

    if (localities.length === 1) {
      return {
        status: "confirmed",
        needsHuman: false,
        postalCode,
        localities,
        speech: phrases.postalCodeConfirm(spokenCode, localities[0].locality),
        reason: `Postleitzahl ${postalCode} eindeutig: ${localities[0].locality}.`,
      };
    }

    return {
      status: "ambiguous",
      needsHuman: false,
      postalCode,
      localities,
      speech: phrases.postalCodeChoose(spokenCode, speakChoices(localities.slice(0, 3).map((l) => l.locality))),
      reason: `Postleitzahl ${postalCode} gehört zu ${localities.length} Orten.`,
    };
  }
}
