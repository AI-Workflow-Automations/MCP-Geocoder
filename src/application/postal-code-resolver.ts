import { extractPostalCode } from "../domain/normalization.js";
import type { StreetDirectory } from "../domain/ports.js";
import { REASONS } from "../domain/reasons.js";
import type { Language, PostalCodeResolution } from "../domain/types.js";
import { DEFAULT_LANGUAGE } from "../speech/language.js";
import { phrasesFor, speakChoices, speakPostalCode } from "../speech/speech-formatter.js";

/**
 * PLZ-First-Dialog: erst die fünf Ziffern, dann alles andere.
 *
 * Ziffern überstehen Schmalband-Telefonie deutlich besser als Ortsnamen -
 * und eine bestätigte Postleitzahl schrumpft den Suchraum von hunderttausenden
 * Straßen auf ein paar Hundert.
 */
export class PostalCodeResolver {
  constructor(private readonly directory: StreetDirectory) {}

  async resolve(spoken: string, language: Language = DEFAULT_LANGUAGE): Promise<PostalCodeResolution> {
    const phrases = phrasesFor(language);
    const reasons = REASONS[language];
    const postalCode = extractPostalCode(spoken);
    if (!postalCode) {
      return {
        status: "unresolved",
        needsHuman: false,
        localities: [],
        speech: phrases.postalCodeNotUnderstood,
        reason: reasons.postalCodeMissing,
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
        reason: reasons.postalCodeUnknown(postalCode),
      };
    }

    if (localities.length === 1) {
      return {
        status: "confirmed",
        needsHuman: false,
        postalCode,
        localities,
        speech: phrases.postalCodeConfirm(spokenCode, localities[0].locality),
        reason: reasons.postalCodeUnique(postalCode, localities[0].locality),
      };
    }

    const choices = speakChoices(
      localities.slice(0, 3).map((l) => l.locality),
      language,
    );
    return {
      status: "ambiguous",
      needsHuman: false,
      postalCode,
      localities,
      speech: phrases.postalCodeChoose(spokenCode, choices),
      reason: reasons.postalCodeMultiple(postalCode, localities.length),
    };
  }
}
