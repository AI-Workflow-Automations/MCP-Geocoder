import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openApiDocument } from "../api/openapi.js";
import type { GeocoderService } from "../application/geocoder-service.js";
import { apiGuideMarkdown } from "./api-guide.js";

/**
 * MCP-Server: übersetzt Tool-Aufrufe in Aufrufe der Fassade.
 *
 * Hier steht keine Fachlogik. Jedes Tool hat sein REST-Gegenstück in der
 * OpenAPI-Beschreibung - deshalb liegt die API-Dokumentation auch als
 * MCP-Resource und -Tool bei: ein Client, der nur Tools sieht, kann sie
 * trotzdem abrufen.
 */

const INSTRUCTIONS = [
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
  "API-Dokumentation: Tool describe_api oder Resource geocoder://docs/api.",
].join("\n");

function jsonResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, needsHuman: true }) }],
  };
}

/** Fehler der Fassade einheitlich in MCP-Fehler übersetzen. */
async function guarded(action: () => Promise<unknown> | unknown) {
  try {
    return jsonResult(await action());
  } catch (error) {
    return errorResult((error as Error).message);
  }
}

export function createMcpServer(service: GeocoderService): McpServer {
  const server = new McpServer({ name: "mcp-geocoder", version: "0.2.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "resolve_postal_code",
    {
      title: "Postleitzahl prüfen",
      description:
        "Prüft eine gesprochene Postleitzahl gegen das amtliche Verzeichnis und gibt die zugehörigen Orte zurück. Immer als erster Schritt der Adressaufnahme verwenden.",
      inputSchema: {
        spokenPostalCode: z.string().describe('Transkript, z.B. "10115" oder "eins null eins eins fünf"'),
      },
    },
    ({ spokenPostalCode }) => guarded(() => service.resolvePostalCode(spokenPostalCode)),
  );

  server.registerTool(
    "resolve_address",
    {
      title: "Adresse abgleichen",
      description:
        "Gleicht einen verstandenen Straßennamen gegen das amtliche Straßenverzeichnis der Postleitzahl ab. Liefert bis zu drei Kandidaten mit Konfidenz, den Rückbestätigungssatz (speech) und needsHuman. Nie den Straßennamen ungeprüft übernehmen.",
      inputSchema: {
        street: z.string().describe('Straßenname wie verstanden, Hausnummer darf enthalten sein: "Henrichweg 24"'),
        postalCode: z.string().optional().describe("Bestätigte fünfstellige PLZ"),
        houseNumber: z.string().optional().describe("Hausnummer, falls separat erfasst"),
        locality: z.string().optional().describe("Ortsname, falls bekannt"),
      },
    },
    (input) => guarded(() => service.resolveAddress(input)),
  );

  server.registerTool(
    "select_candidate",
    {
      title: "Kandidat auswählen",
      description:
        "Nach einer Auswahlfrage: bestätigt einen der vorgelesenen Kandidaten und liefert die normalisierte Adresse plus Abschlusssatz. Erst danach gilt die Adresse als erfasst.",
      inputSchema: {
        street: z.string().describe("Der gewählte amtliche Straßenname, exakt wie aus resolve_address"),
        postalCode: z.string(),
        locality: z.string(),
        houseNumber: z.string().optional(),
      },
    },
    (input) => guarded(() => service.selectCandidate(input)),
  );

  server.registerTool(
    "flag_for_human",
    {
      title: "An Menschen übergeben",
      description:
        "Markiert den Call als unsicher und übergibt an einen Menschen. Aufrufen, sobald der Anrufer keinen Vorschlag bestätigt, die Adresse zum dritten Mal nicht ankommt oder die Datenquellen ausgefallen sind. Nie stattdessen den wahrscheinlichsten Kandidaten übernehmen.",
      inputSchema: {
        reason: z.string().describe('Warum die Erfassung gescheitert ist, z.B. "alle drei Vorschläge abgelehnt"'),
        heardStreet: z.string().optional(),
        heardPostalCode: z.string().optional(),
        attempts: z.number().int().optional(),
      },
    },
    (input) => guarded(() => service.flagForHuman(input)),
  );

  server.registerTool(
    "generate_keyterms",
    {
      title: "Keyterm-Liste erzeugen",
      description:
        "Erzeugt aus dem Einzugsgebiet eine nach Fehleranfälligkeit priorisierte Keyterm-Liste für den Deepgram-Transcriber, inklusive fertigem Konfigurationsblock. Einmalig beim Einrichten, nicht im Gespräch.",
      inputSchema: {
        postalCodes: z.array(z.string()).optional().describe("Leer = SERVICE_AREA_POSTAL_CODES"),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    ({ postalCodes, limit }) => guarded(() => service.buildKeyterms(postalCodes, limit)),
  );

  server.registerTool(
    "describe_api",
    {
      title: "API-Dokumentation",
      description:
        "Liefert die Dokumentation dieses Servers: Gesprächsablauf, Antwortformat, Schwellwerte und die OpenAPI-Beschreibung der gleichwertigen REST-API.",
      inputSchema: {
        format: z.enum(["markdown", "openapi"]).optional().describe("markdown (Standard) oder openapi (JSON)"),
      },
    },
    ({ format }) =>
      format === "openapi"
        ? jsonResult(openApiDocument)
        : { content: [{ type: "text" as const, text: apiGuideMarkdown(service.thresholds) }] },
  );

  server.registerResource(
    "api-guide",
    "geocoder://docs/api",
    { title: "API-Leitfaden", description: "Gesprächsablauf, Antwortformat, Schwellwerte", mimeType: "text/markdown" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: apiGuideMarkdown(service.thresholds) }],
    }),
  );

  server.registerResource(
    "openapi",
    "geocoder://docs/openapi.json",
    { title: "OpenAPI 3.1", description: "REST-API, identisch zu den MCP-Tools", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(openApiDocument, null, 2) }],
    }),
  );

  return server;
}
