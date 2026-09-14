/**
 * OpenAPI-Beschreibung der REST-API.
 *
 * Einzige Quelle der API-Dokumentation: wird unter /openapi.json ausgeliefert,
 * als MCP-Resource angeboten und von der Weboberfläche gerendert. Wer die API
 * ändert, ändert sie hier - sonst lügt die Doku.
 */

const matchStatus = { type: "string", enum: ["confirmed", "ambiguous", "unresolved"] } as const;

const scoreBreakdown = {
  type: "object",
  description: "Einzelscores der Bewertung - macht Fehltreffer im Call-Log nachvollziehbar.",
  properties: {
    lexical: { type: "number", description: "Zeichenähnlichkeit des Wortstamms (0..1)" },
    phonetic: { type: "number", description: "Klangähnlichkeit nach Kölner Phonetik (0..1)" },
    token: { type: "number", description: "Fehlertoleranter Tokenvergleich (0..1)" },
    streetType: { type: "number", description: "Übereinstimmung des Grundworts: 1 gleich, 0.5 neutral, 0 Widerspruch" },
    total: { type: "number", description: "Gewichtete Gesamtbewertung (0..1)" },
    cappedBy: { type: "string", description: "Gesetzt, wenn ein Regelwerk die Bewertung gedeckelt hat" },
  },
} as const;

const streetCandidate = {
  type: "object",
  required: ["street", "postalCode", "locality", "confidence", "source"],
  properties: {
    street: { type: "string", description: "Amtliche Schreibweise" },
    postalCode: { type: "string" },
    locality: { type: "string" },
    borough: { type: "string" },
    suburb: { type: "string" },
    federalState: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    source: { type: "string", enum: ["openplz", "photon"] },
    breakdown: scoreBreakdown,
  },
} as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "MCP-Geocoder API",
    version: "0.2.0",
    description:
      "Tolerante deutsche Adresserfassung für Telefonagenten. Jede Antwort enthält neben den Daten den fertigen Satz für die Sprachausgabe (`speech`) und ein Flag, ob der Call an einen Menschen gehen muss (`needsHuman`).\n\nDieselbe Fachlogik steht als MCP-Tools zur Verfügung - REST und MCP verhalten sich identisch.",
  },
  servers: [{ url: "/", description: "Diese Instanz" }],
  tags: [
    { name: "Adresse", description: "Der Gesprächsablauf: PLZ → Straße → Auswahl → Übergabe" },
    { name: "Einrichtung", description: "Einmalig pro Kunde, nicht im laufenden Gespräch" },
    { name: "Betrieb" },
  ],
  paths: {
    "/api/postal-code": {
      post: {
        tags: ["Adresse"],
        summary: "Postleitzahl prüfen",
        description:
          "Erster Schritt der Adressaufnahme. Ziffern überstehen Schmalband-Telefonie besser als Ortsnamen, und eine bestätigte PLZ engt die Straßensuche von bundesweit auf wenige Hundert Kandidaten ein.",
        operationId: "resolvePostalCode",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["spoken"],
                properties: {
                  spoken: {
                    type: "string",
                    description: 'Transkript, z.B. "10115" oder "eins null eins eins fünf"',
                    example: "10115",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Prüfergebnis",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PostalCodeResolution" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/address": {
      post: {
        tags: ["Adresse"],
        summary: "Straße abgleichen",
        description:
          "Gleicht den verstandenen Straßennamen gegen das amtliche Verzeichnis der Postleitzahl ab. Liefert bis zu drei Kandidaten mit Konfidenz, den Rückbestätigungssatz und `needsHuman`. Nie den Straßennamen ungeprüft übernehmen.",
        operationId: "resolveAddress",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["street"],
                properties: {
                  street: {
                    type: "string",
                    description: "Wie verstanden, Hausnummer darf enthalten sein",
                    example: "Henrichweg 24",
                  },
                  postalCode: { type: "string", description: "Bestätigte fünfstellige PLZ", example: "10115" },
                  houseNumber: { type: "string", description: "Falls separat erfasst" },
                  locality: { type: "string", description: "Ortsname, falls bekannt" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Abgleichergebnis",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AddressResolution" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/address/select": {
      post: {
        tags: ["Adresse"],
        summary: "Kandidat bestätigen",
        description: "Nach einer Auswahlfrage. Erst nach diesem Aufruf gilt die Adresse als erfasst.",
        operationId: "selectCandidate",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["street", "postalCode", "locality"],
                properties: {
                  street: { type: "string", description: "Exakt wie aus /api/address zurückgegeben" },
                  postalCode: { type: "string" },
                  locality: { type: "string" },
                  houseNumber: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Erfasste Adresse",
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
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/escalate": {
      post: {
        tags: ["Adresse"],
        summary: "An Menschen übergeben",
        description:
          "Markiert den Call als unsicher. Aufrufen, sobald der Anrufer keinen Vorschlag bestätigt oder es dreimal nicht klappt. Schreibt eine strukturierte Logzeile - die Datengrundlage fürs Messkriterium.",
        operationId: "flagForHuman",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: {
                  reason: { type: "string", example: "Anrufer hat alle drei Vorschläge abgelehnt" },
                  heardStreet: { type: "string" },
                  heardPostalCode: { type: "string" },
                  attempts: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Übergabe protokolliert",
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
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/keyterms": {
      post: {
        tags: ["Einrichtung"],
        summary: "Keyterm-Liste für den Transcriber erzeugen",
        description:
          "Erzeugt aus dem Einzugsgebiet eine nach Fehleranfälligkeit priorisierte Keyterm-Liste für Deepgram Nova-3 (max. 100 Terme, je max. 50 Zeichen).",
        operationId: "buildKeyterms",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  postalCodes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Leer = SERVICE_AREA_POSTAL_CODES",
                  },
                  limit: { type: "integer", minimum: 1, maximum: 100 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Keyterm-Liste",
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
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/health": {
      get: {
        tags: ["Betrieb"],
        summary: "Erreichbarkeit der Datenquellen und aktive Schwellwerte",
        operationId: "health",
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    service: { type: "string" },
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
        tags: ["Betrieb"],
        summary: "MCP Streamable-HTTP-Endpunkt",
        description:
          "Model Context Protocol. Nicht für direkte Aufrufe gedacht - hier verbindet sich der Telefonagent (z.B. Vapi). Die Tools entsprechen 1:1 den REST-Endpunkten dieser Dokumentation.",
        operationId: "mcp",
        responses: { "200": { description: "JSON-RPC-Antwort" } },
      },
    },
  },
  components: {
    schemas: {
      MatchStatus: {
        ...matchStatus,
        description:
          "confirmed: übernehmen und rückbestätigen · ambiguous: Auswahl vorlesen · unresolved: an Menschen übergeben",
      },
      StreetCandidate: streetCandidate,
      AddressResolution: {
        type: "object",
        required: ["status", "needsHuman", "candidates", "speech", "heard", "reason"],
        properties: {
          status: { $ref: "#/components/schemas/MatchStatus" },
          needsHuman: { type: "boolean", description: "true => Call flaggen und übergeben, nichts raten" },
          best: streetCandidate,
          candidates: { type: "array", maxItems: 3, items: streetCandidate },
          speech: {
            type: "string",
            description: "Wortwörtlich vorlesen. PLZ und Hausnummer sind bereits sprechbar aufbereitet.",
          },
          heard: {
            type: "object",
            properties: { postalCode: { type: "string" }, street: { type: "string" }, houseNumber: { type: "string" } },
          },
          reason: { type: "string", description: "Klartext-Begründung fürs Call-Log" },
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
        description: "Ungültige Eingabe",
        content: {
          "application/json": {
            schema: { type: "object", properties: { error: { type: "string" }, needsHuman: { type: "boolean" } } },
          },
        },
      },
    },
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        description: "Nur aktiv, wenn MCP_AUTH_TOKEN gesetzt ist. /health bleibt offen.",
      },
    },
  },
  security: [{ bearer: [] }],
} as const;
