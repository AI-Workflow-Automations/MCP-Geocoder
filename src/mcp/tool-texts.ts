import type { Language } from "../domain/types.js";

/**
 * Alles, was der LLM-Agent vom MCP-Server zu lesen bekommt: Instructions,
 * Tool-Titel, Beschreibungen, Parametertexte. Je Sprache ein vollständiger
 * Satz - das Interface hält beide Sprachen auf demselben Umfang.
 */

export type ToolName =
  | "resolve_postal_code"
  | "resolve_address"
  | "select_candidate"
  | "flag_for_human"
  | "generate_keyterms"
  | "describe_api";

export interface ToolText {
  title: string;
  description: string;
  /** Beschreibungen der Eingabefelder, Schlüssel = Feldname */
  inputs: Record<string, string>;
}

export interface McpTexts {
  instructions: string;
  /** Text des optionalen language-Parameters, für alle Gesprächs-Tools gleich */
  languageInput: string;
  tools: Record<ToolName, ToolText>;
  resources: {
    apiGuide: { title: string; description: string };
    openapi: { title: string; description: string };
  };
}

const de: McpTexts = {
  instructions: [
    "Deutscher Adressabgleich für Telefonagenten.",
    "",
    "Ablauf im Gespräch:",
    "1. resolve_postal_code mit den fünf Ziffern - erst die PLZ, dann alles andere.",
    "2. resolve_address mit PLZ und dem, was beim Straßennamen verstanden wurde.",
    "3. Bei status=ambiguous das Feld speech vorlesen, dann select_candidate mit der Wahl.",
    "4. Bei needsHuman=true nichts raten: speech sagen und den Call übergeben.",
    "5. Lehnt der Anrufer alle Vorschläge ab oder klappt es dreimal nicht: flag_for_human.",
    "",
    "Das Feld speech ist immer fertig formatiert. Wortwörtlich vorlesen, nicht umformulieren.",
    'Sprache von speech: Parameter language ("de" oder "en"), Standard ist die Server-Sprache.',
    "API-Dokumentation: Tool describe_api oder Resource geocoder://docs/api.",
  ].join("\n"),
  languageInput: 'Sprache für speech und reason: "de" oder "en". Fehlt sie, gilt die Server-Sprache.',
  tools: {
    resolve_postal_code: {
      title: "Postleitzahl prüfen",
      description:
        "Prüft eine gesprochene Postleitzahl gegen das amtliche Verzeichnis und gibt die zugehörigen Orte zurück. Immer als erster Schritt der Adressaufnahme verwenden.",
      inputs: { spokenPostalCode: 'Transkript, z.B. "10115" oder "eins null eins eins fünf"' },
    },
    resolve_address: {
      title: "Adresse abgleichen",
      description:
        "Gleicht einen verstandenen Straßennamen gegen das amtliche Straßenverzeichnis der Postleitzahl ab. Liefert bis zu drei Kandidaten mit Konfidenz, den Rückbestätigungssatz (speech) und needsHuman. Nie den Straßennamen ungeprüft übernehmen.",
      inputs: {
        street: 'Straßenname wie verstanden, Hausnummer darf enthalten sein: "Henrichweg 24"',
        postalCode: "Bestätigte fünfstellige PLZ",
        houseNumber: "Hausnummer, falls separat erfasst",
        locality: "Ortsname, falls bekannt",
      },
    },
    select_candidate: {
      title: "Kandidat auswählen",
      description:
        "Nach einer Auswahlfrage: bestätigt einen der vorgelesenen Kandidaten und liefert die normalisierte Adresse plus Abschlusssatz. Erst danach gilt die Adresse als erfasst.",
      inputs: { street: "Der gewählte amtliche Straßenname, exakt wie aus resolve_address" },
    },
    flag_for_human: {
      title: "An Menschen übergeben",
      description:
        "Markiert den Call als unsicher und übergibt an einen Menschen. Aufrufen, sobald der Anrufer keinen Vorschlag bestätigt, die Adresse zum dritten Mal nicht ankommt oder die Datenquellen ausgefallen sind. Nie stattdessen den wahrscheinlichsten Kandidaten übernehmen.",
      inputs: { reason: 'Warum die Erfassung gescheitert ist, z.B. "alle drei Vorschläge abgelehnt"' },
    },
    generate_keyterms: {
      title: "Keyterm-Liste erzeugen",
      description:
        "Erzeugt aus dem Einzugsgebiet eine nach Fehleranfälligkeit priorisierte Keyterm-Liste für den Deepgram-Transcriber, inklusive fertigem Konfigurationsblock. Einmalig beim Einrichten, nicht im Gespräch.",
      inputs: { postalCodes: "Leer = SERVICE_AREA_POSTAL_CODES" },
    },
    describe_api: {
      title: "API-Dokumentation",
      description:
        "Liefert die Dokumentation dieses Servers: Gesprächsablauf, Antwortformat, Schwellwerte und die OpenAPI-Beschreibung der gleichwertigen REST-API.",
      inputs: { format: "markdown (Standard) oder openapi (JSON)" },
    },
  },
  resources: {
    apiGuide: { title: "API-Leitfaden", description: "Gesprächsablauf, Antwortformat, Schwellwerte" },
    openapi: { title: "OpenAPI 3.1", description: "REST-API, identisch zu den MCP-Tools" },
  },
};

const en: McpTexts = {
  instructions: [
    "German address matching for phone agents.",
    "",
    "Conversation flow:",
    "1. resolve_postal_code with the five digits - postal code first, everything else after.",
    "2. resolve_address with the postal code and what was understood of the street name.",
    "3. On status=ambiguous read out the speech field, then select_candidate with the choice.",
    "4. On needsHuman=true do not guess: say speech and hand over the call.",
    "5. If the caller rejects every suggestion or it fails three times: flag_for_human.",
    "",
    "The speech field is always final wording. Read it out verbatim, do not rephrase.",
    'Language of speech: parameter language ("de" or "en"), defaults to the server language.',
    "API documentation: tool describe_api or resource geocoder://docs/api.",
  ].join("\n"),
  languageInput: 'Language for speech and reason: "de" or "en". Defaults to the server language.',
  tools: {
    resolve_postal_code: {
      title: "Check postal code",
      description:
        "Checks a spoken postal code against the official directory and returns the matching places. Always use as the first step of address capture.",
      inputs: { spokenPostalCode: 'Transcript, e.g. "10115" or "one zero one one five"' },
    },
    resolve_address: {
      title: "Match address",
      description:
        "Matches a heard street name against the official street directory of the postal code. Returns up to three candidates with confidence, the confirmation sentence (speech) and needsHuman. Never accept a street name unverified.",
      inputs: {
        street: 'Street name as understood, house number may be included: "Henrichweg 24"',
        postalCode: "Confirmed five-digit postal code",
        houseNumber: "House number, if captured separately",
        locality: "Place name, if known",
      },
    },
    select_candidate: {
      title: "Select candidate",
      description:
        "After a choice question: confirms one of the candidates that were read out and returns the normalized address plus the closing sentence. Only then does the address count as captured.",
      inputs: { street: "The chosen official street name, exactly as returned by resolve_address" },
    },
    flag_for_human: {
      title: "Hand over to a human",
      description:
        "Marks the call as uncertain and hands over to a human. Call it as soon as the caller confirms no suggestion, the address fails for the third time, or the data sources are down. Never accept the most likely candidate instead.",
      inputs: { reason: 'Why capture failed, e.g. "all three suggestions rejected"' },
    },
    generate_keyterms: {
      title: "Generate keyterm list",
      description:
        "Builds a keyterm list for the Deepgram transcriber from the service area, prioritized by error-proneness, including a ready-made configuration block. Once during setup, not during a call.",
      inputs: { postalCodes: "Empty = SERVICE_AREA_POSTAL_CODES" },
    },
    describe_api: {
      title: "API documentation",
      description:
        "Returns the documentation of this server: conversation flow, response format, thresholds and the OpenAPI description of the equivalent REST API.",
      inputs: { format: "markdown (default) or openapi (JSON)" },
    },
  },
  resources: {
    apiGuide: { title: "API guide", description: "Conversation flow, response format, thresholds" },
    openapi: { title: "OpenAPI 3.1", description: "REST API, identical to the MCP tools" },
  },
};

const TEXTS: Record<Language, McpTexts> = { de, en };

export function mcpTexts(language: Language): McpTexts {
  return TEXTS[language];
}
