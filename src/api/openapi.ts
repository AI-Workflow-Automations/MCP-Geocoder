import type { Language } from "../domain/types.js";
import { LANGUAGES } from "../speech/language.js";

/**
 * OpenAPI-Beschreibung der REST-API.
 *
 * Einzige Quelle der API-Dokumentation: wird unter /openapi.json ausgeliefert,
 * als MCP-Resource angeboten und von der Weboberfläche gerendert. Wer die API
 * ändert, ändert sie hier - sonst lügt die Doku.
 *
 * Die Struktur ist sprachunabhängig; nur die Beschreibungstexte kommen aus
 * der Texttabelle der gewählten Sprache.
 */

interface OpenApiTexts {
  description: string;
  thisInstance: string;
  tags: { address: string; setup: string; operations: string };
  languageParam: string;
  breakdown: {
    description: string;
    lexical: string;
    phonetic: string;
    token: string;
    streetType: string;
    total: string;
    cappedBy: string;
  };
  officialSpelling: string;
  postalCode: {
    summary: string;
    description: string;
    spoken: string;
    response: string;
  };
  address: {
    summary: string;
    description: string;
    street: string;
    postalCode: string;
    houseNumber: string;
    locality: string;
    response: string;
  };
  select: { summary: string; description: string; street: string; response: string };
  escalate: { summary: string; description: string; reasonExample: string; response: string };
  keyterms: { summary: string; description: string; postalCodes: string; response: string };
  streets: {
    summary: string;
    description: string;
    postalCode: string;
    prefix: string;
    limit: string;
    response: string;
  };
  health: { summary: string; response: string };
  mcp: { summary: string; description: string; response: string };
  schemas: {
    matchStatus: string;
    needsHuman: string;
    speech: string;
    reason: string;
  };
  badRequest: string;
  bearer: string;
}

const de: OpenApiTexts = {
  description:
    "Tolerante deutsche Adresserfassung für Telefonagenten. Jede Antwort enthält neben den Daten den fertigen Satz für die Sprachausgabe (`speech`) und ein Flag, ob der Call an einen Menschen gehen muss (`needsHuman`).\n\nDieselbe Fachlogik steht als MCP-Tools zur Verfügung - REST und MCP verhalten sich identisch.",
  thisInstance: "Diese Instanz",
  tags: {
    address: "Der Gesprächsablauf: PLZ → Straße → Auswahl → Übergabe",
    setup: "Einmalig pro Kunde, nicht im laufenden Gespräch",
    operations: "Betrieb",
  },
  languageParam: 'Sprache für speech und reason: "de" oder "en". Fehlt sie, gilt die Server-Sprache.',
  breakdown: {
    description: "Einzelscores der Bewertung - macht Fehltreffer im Call-Log nachvollziehbar.",
    lexical: "Zeichenähnlichkeit des Wortstamms (0..1)",
    phonetic: "Klangähnlichkeit nach Kölner Phonetik (0..1)",
    token: "Fehlertoleranter Tokenvergleich (0..1)",
    streetType: "Übereinstimmung des Grundworts: 1 gleich, 0.5 neutral, 0 Widerspruch",
    total: "Gewichtete Gesamtbewertung (0..1)",
    cappedBy: "Gesetzt, wenn ein Regelwerk die Bewertung gedeckelt hat",
  },
  officialSpelling: "Amtliche Schreibweise",
  postalCode: {
    summary: "Postleitzahl prüfen",
    description:
      "Erster Schritt der Adressaufnahme. Ziffern überstehen Schmalband-Telefonie besser als Ortsnamen, und eine bestätigte PLZ engt die Straßensuche von bundesweit auf wenige Hundert Kandidaten ein.",
    spoken: 'Transkript, z.B. "10115" oder "eins null eins eins fünf"',
    response: "Prüfergebnis",
  },
  address: {
    summary: "Straße abgleichen",
    description:
      "Gleicht den verstandenen Straßennamen gegen das amtliche Verzeichnis der Postleitzahl ab. Liefert bis zu drei Kandidaten mit Konfidenz, den Rückbestätigungssatz und `needsHuman`. Nie den Straßennamen ungeprüft übernehmen.",
    street: "Wie verstanden, Hausnummer darf enthalten sein",
    postalCode: "Bestätigte fünfstellige PLZ",
    houseNumber: "Falls separat erfasst",
    locality: "Ortsname, falls bekannt",
    response: "Abgleichergebnis",
  },
  select: {
    summary: "Kandidat bestätigen",
    description: "Nach einer Auswahlfrage. Erst nach diesem Aufruf gilt die Adresse als erfasst.",
    street: "Exakt wie aus /api/address zurückgegeben",
    response: "Erfasste Adresse",
  },
  escalate: {
    summary: "An Menschen übergeben",
    description:
      "Markiert den Call als unsicher. Aufrufen, sobald der Anrufer keinen Vorschlag bestätigt oder es dreimal nicht klappt. Schreibt eine strukturierte Logzeile - die Datengrundlage fürs Messkriterium.",
    reasonExample: "Anrufer hat alle drei Vorschläge abgelehnt",
    response: "Übergabe protokolliert",
  },
  keyterms: {
    summary: "Keyterm-Liste für den Transcriber erzeugen",
    description:
      "Erzeugt aus dem Einzugsgebiet eine nach Fehleranfälligkeit priorisierte Keyterm-Liste für Deepgram Nova-3 (max. 100 Terme, je max. 50 Zeichen).",
    postalCodes: "Leer = SERVICE_AREA_POSTAL_CODES",
    response: "Keyterm-Liste",
  },
  streets: {
    summary: "Straßen einer PLZ auflisten",
    description:
      "Liefert die Straßenliste einer bestätigten Postleitzahl. Optional Präfix und Limit (Standard 50, max. 100). Antwort strukturiert mit `streets`, `count`, `total`, `truncated` – nicht zum Vorlesen der Vollliste gedacht.",
    postalCode: "Bestätigte fünfstellige PLZ",
    prefix: "Optionaler Namenspräfix",
    limit: "Maximale Anzahl Straßennamen (1–100, Standard 50)",
    response: "Straßenliste",
  },
  health: { summary: "Erreichbarkeit der Datenquellen und aktive Schwellwerte", response: "Status" },
  mcp: {
    summary: "MCP Streamable-HTTP-Endpunkt",
    description:
      "Model Context Protocol. Nicht für direkte Aufrufe gedacht - hier verbindet sich der Telefonagent (z.B. Vapi). Die Tools entsprechen 1:1 den REST-Endpunkten dieser Dokumentation.",
    response: "JSON-RPC-Antwort",
  },
  schemas: {
    matchStatus:
      "confirmed: übernehmen und rückbestätigen · ambiguous: Auswahl vorlesen · unresolved: an Menschen übergeben",
    needsHuman: "true => Call flaggen und übergeben, nichts raten",
    speech: "Wortwörtlich vorlesen. PLZ und Hausnummer sind bereits sprechbar aufbereitet.",
    reason: "Klartext-Begründung fürs Call-Log",
  },
  badRequest: "Ungültige Eingabe",
  bearer: "Nur aktiv, wenn MCP_AUTH_TOKEN gesetzt ist. /health bleibt offen.",
};

const en: OpenApiTexts = {
  description:
    "Fault-tolerant German address capture for phone agents. Besides the data, every response contains the final sentence for speech output (`speech`) and a flag telling whether the call must go to a human (`needsHuman`).\n\nThe same business logic is available as MCP tools - REST and MCP behave identically.",
  thisInstance: "This instance",
  tags: {
    address: "The conversation flow: postal code → street → choice → hand-over",
    setup: "Once per customer, not during a call",
    operations: "Operations",
  },
  languageParam: 'Language for speech and reason: "de" or "en". Defaults to the server language.',
  breakdown: {
    description: "Individual scores of the rating - makes mismatches traceable in the call log.",
    lexical: "Character similarity of the stem (0..1)",
    phonetic: "Sound similarity by Cologne phonetics (0..1)",
    token: "Fault-tolerant token comparison (0..1)",
    streetType: "Street type agreement: 1 equal, 0.5 neutral, 0 conflict",
    total: "Weighted overall score (0..1)",
    cappedBy: "Set when a rule capped the score",
  },
  officialSpelling: "Official spelling",
  postalCode: {
    summary: "Check postal code",
    description:
      "First step of address capture. Digits survive narrowband telephony better than place names, and a confirmed postal code narrows the street search from nationwide to a few hundred candidates.",
    spoken: 'Transcript, e.g. "10115" or "one zero one one five"',
    response: "Check result",
  },
  address: {
    summary: "Match street",
    description:
      "Matches the heard street name against the official directory of the postal code. Returns up to three candidates with confidence, the confirmation sentence and `needsHuman`. Never accept a street name unverified.",
    street: "As understood, house number may be included",
    postalCode: "Confirmed five-digit postal code",
    houseNumber: "If captured separately",
    locality: "Place name, if known",
    response: "Match result",
  },
  select: {
    summary: "Confirm candidate",
    description: "After a choice question. Only after this call does the address count as captured.",
    street: "Exactly as returned by /api/address",
    response: "Captured address",
  },
  escalate: {
    summary: "Hand over to a human",
    description:
      "Marks the call as uncertain. Call it as soon as the caller confirms no suggestion or it fails three times. Writes a structured log line - the data basis for the success metric.",
    reasonExample: "Caller rejected all three suggestions",
    response: "Hand-over logged",
  },
  keyterms: {
    summary: "Generate keyterm list for the transcriber",
    description:
      "Builds a keyterm list for Deepgram Nova-3 from the service area, prioritized by error-proneness (max. 100 terms, max. 50 characters each).",
    postalCodes: "Empty = SERVICE_AREA_POSTAL_CODES",
    response: "Keyterm list",
  },
  streets: {
    summary: "List streets for a postal code",
    description:
      "Returns the street list for a confirmed postal code. Optional prefix and limit (default 50, max 100). Structured response with `streets`, `count`, `total`, `truncated` – not meant for reading the full list aloud.",
    postalCode: "Confirmed five-digit postal code",
    prefix: "Optional name prefix",
    limit: "Maximum number of street names (1–100, default 50)",
    response: "Street list",
  },
  health: { summary: "Reachability of the data sources and active thresholds", response: "Status" },
  mcp: {
    summary: "MCP Streamable HTTP endpoint",
    description:
      "Model Context Protocol. Not meant for direct calls - this is where the phone agent (e.g. Vapi) connects. The tools correspond 1:1 to the REST endpoints of this documentation.",
    response: "JSON-RPC response",
  },
  schemas: {
    matchStatus: "confirmed: accept and confirm back · ambiguous: read out choices · unresolved: hand over to a human",
    needsHuman: "true => flag the call and hand over, do not guess",
    speech: "Read out verbatim. Postal code and house number are already prepared for speech.",
    reason: "Plain-text reasoning for the call log",
  },
  badRequest: "Invalid input",
  bearer: "Only active when MCP_AUTH_TOKEN is set. /health stays open.",
};

const TEXTS: Record<Language, OpenApiTexts> = { de, en };

const TAG_NAMES: Record<Language, { address: string; setup: string; operations: string }> = {
  de: { address: "Adresse", setup: "Einrichtung", operations: "Betrieb" },
  en: { address: "Address", setup: "Setup", operations: "Operations" },
};

export function buildOpenApiDocument(language: Language = "de") {
  const t = TEXTS[language];
  const tag = TAG_NAMES[language];
  const matchStatus = { type: "string", enum: ["confirmed", "ambiguous", "unresolved"] };
  const languageParam = { type: "string", enum: [...LANGUAGES], description: t.languageParam };

  const scoreBreakdown = {
    type: "object",
    description: t.breakdown.description,
    properties: {
      lexical: { type: "number", description: t.breakdown.lexical },
      phonetic: { type: "number", description: t.breakdown.phonetic },
      token: { type: "number", description: t.breakdown.token },
      streetType: { type: "number", description: t.breakdown.streetType },
      total: { type: "number", description: t.breakdown.total },
      cappedBy: { type: "string", description: t.breakdown.cappedBy },
    },
  };

  const streetCandidate = {
    type: "object",
    required: ["street", "postalCode", "locality", "confidence", "source"],
    properties: {
      street: { type: "string", description: t.officialSpelling },
      postalCode: { type: "string" },
      locality: { type: "string" },
      borough: { type: "string" },
      suburb: { type: "string" },
      federalState: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      source: { type: "string", enum: ["openplz", "photon"] },
      breakdown: scoreBreakdown,
    },
  };

  const badRequest = { $ref: "#/components/responses/BadRequest" };

  return {
    openapi: "3.1.0",
    info: { title: "MCP-Geocoder API", version: "0.2.0", description: t.description },
    servers: [{ url: "/", description: t.thisInstance }],
    tags: [
      { name: tag.address, description: t.tags.address },
      { name: tag.setup, description: t.tags.setup },
      { name: tag.operations },
    ],
    paths: {
      "/api/postal-code": {
        post: {
          tags: [tag.address],
          summary: t.postalCode.summary,
          description: t.postalCode.description,
          operationId: "resolvePostalCode",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["spoken"],
                  properties: {
                    spoken: { type: "string", description: t.postalCode.spoken, example: "10115" },
                    language: languageParam,
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.postalCode.response,
              content: { "application/json": { schema: { $ref: "#/components/schemas/PostalCodeResolution" } } },
            },
            "400": badRequest,
          },
        },
      },
      "/api/address": {
        post: {
          tags: [tag.address],
          summary: t.address.summary,
          description: t.address.description,
          operationId: "resolveAddress",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["street"],
                  properties: {
                    street: { type: "string", description: t.address.street, example: "Henrichweg 24" },
                    postalCode: { type: "string", description: t.address.postalCode, example: "10115" },
                    houseNumber: { type: "string", description: t.address.houseNumber },
                    locality: { type: "string", description: t.address.locality },
                    language: languageParam,
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.address.response,
              content: { "application/json": { schema: { $ref: "#/components/schemas/AddressResolution" } } },
            },
            "400": badRequest,
          },
        },
      },
      "/api/address/select": {
        post: {
          tags: [tag.address],
          summary: t.select.summary,
          description: t.select.description,
          operationId: "selectCandidate",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["street", "postalCode", "locality"],
                  properties: {
                    street: { type: "string", description: t.select.street },
                    postalCode: { type: "string" },
                    locality: { type: "string" },
                    houseNumber: { type: "string" },
                    language: languageParam,
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.select.response,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["confirmed"] },
                      needsHuman: { type: "boolean", enum: [false] },
                      address: { type: "object" },
                      formatted: { type: "string", example: "Heinrichstraße 24, 10115 Berlin" },
                      speech: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": badRequest,
          },
        },
      },
      "/api/escalate": {
        post: {
          tags: [tag.address],
          summary: t.escalate.summary,
          description: t.escalate.description,
          operationId: "flagForHuman",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["reason"],
                  properties: {
                    reason: { type: "string", example: t.escalate.reasonExample },
                    heardStreet: { type: "string" },
                    heardPostalCode: { type: "string" },
                    attempts: { type: "integer" },
                    language: languageParam,
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.escalate.response,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["unresolved"] },
                      needsHuman: { type: "boolean", enum: [true] },
                      logged: { type: "boolean" },
                      reason: { type: "string" },
                      speech: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": badRequest,
          },
        },
      },
      "/api/keyterms": {
        post: {
          tags: [tag.setup],
          summary: t.keyterms.summary,
          description: t.keyterms.description,
          operationId: "buildKeyterms",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    postalCodes: { type: "array", items: { type: "string" }, description: t.keyterms.postalCodes },
                    limit: { type: "integer", minimum: 1, maximum: 100 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.keyterms.response,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      keyterms: { type: "array", items: { type: "string" } },
                      transcriberConfig: { type: "object" },
                      stats: { type: "object" },
                    },
                  },
                },
              },
            },
            "400": badRequest,
          },
        },
      },
      "/api/streets": {
        post: {
          tags: [tag.setup],
          summary: t.streets.summary,
          description: t.streets.description,
          operationId: "listStreets",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["postalCode"],
                  properties: {
                    postalCode: { type: "string", description: t.streets.postalCode, example: "10115" },
                    prefix: { type: "string", description: t.streets.prefix, example: "Hein" },
                    limit: { type: "integer", minimum: 1, maximum: 100, description: t.streets.limit },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: t.streets.response,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["postalCode", "streets", "count", "total", "truncated"],
                    properties: {
                      postalCode: { type: "string" },
                      streets: { type: "array", items: { type: "string" } },
                      count: { type: "integer" },
                      total: { type: "integer" },
                      truncated: { type: "boolean" },
                      prefix: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": badRequest,
          },
        },
      },
      "/health": {
        get: {
          tags: [tag.operations],
          summary: t.health.summary,
          operationId: "health",
          responses: {
            "200": {
              description: t.health.response,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                      language: { type: "string", enum: [...LANGUAGES] },
                      providers: { type: "array", items: { type: "object" } },
                      thresholds: { type: "object" },
                      serviceArea: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/mcp": {
        post: {
          tags: [tag.operations],
          summary: t.mcp.summary,
          description: t.mcp.description,
          operationId: "mcp",
          responses: { "200": { description: t.mcp.response } },
        },
      },
    },
    components: {
      schemas: {
        MatchStatus: { ...matchStatus, description: t.schemas.matchStatus },
        StreetCandidate: streetCandidate,
        AddressResolution: {
          type: "object",
          required: ["status", "needsHuman", "candidates", "speech", "heard", "reason"],
          properties: {
            status: { $ref: "#/components/schemas/MatchStatus" },
            needsHuman: { type: "boolean", description: t.schemas.needsHuman },
            best: streetCandidate,
            candidates: { type: "array", maxItems: 3, items: streetCandidate },
            speech: { type: "string", description: t.schemas.speech },
            heard: {
              type: "object",
              properties: {
                postalCode: { type: "string" },
                street: { type: "string" },
                houseNumber: { type: "string" },
              },
            },
            reason: { type: "string", description: t.schemas.reason },
          },
        },
        PostalCodeResolution: {
          type: "object",
          required: ["status", "needsHuman", "localities", "speech", "reason"],
          properties: {
            status: { $ref: "#/components/schemas/MatchStatus" },
            needsHuman: { type: "boolean" },
            postalCode: { type: "string" },
            localities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  postalCode: { type: "string" },
                  locality: { type: "string" },
                  municipality: { type: "string" },
                  district: { type: "string" },
                  federalState: { type: "string" },
                },
              },
            },
            speech: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      responses: {
        BadRequest: {
          description: t.badRequest,
          content: {
            "application/json": {
              schema: { type: "object", properties: { error: { type: "string" }, needsHuman: { type: "boolean" } } },
            },
          },
        },
      },
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: t.bearer },
      },
    },
    security: [{ bearer: [] }],
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
