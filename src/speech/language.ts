import type { Language } from "../domain/types.js";

export type { Language };

/** Unterstützte Sprachen für speech, reason und die Prompts unter der Haube. */
export const LANGUAGES: readonly Language[] = ["de", "en"];

export const DEFAULT_LANGUAGE: Language = "de";

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** Tolerant lesen: Groß-/Kleinschreibung egal, Unbekanntes fällt auf den Fallback. */
export function parseLanguage(value: string | undefined, fallback: Language): Language {
  const normalized = value?.trim().toLowerCase();
  return normalized && isLanguage(normalized) ? normalized : fallback;
}
