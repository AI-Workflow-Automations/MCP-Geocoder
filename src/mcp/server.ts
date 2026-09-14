import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildOpenApiDocument } from "../api/openapi.js";
import type { GeocoderService } from "../application/geocoder-service.js";
import type { Language } from "../domain/types.js";
import { LANGUAGES } from "../speech/language.js";
import { apiGuideMarkdown } from "./api-guide.js";
import { mcpTexts } from "./tool-texts.js";

/**
 * MCP-Server: übersetzt Tool-Aufrufe in Aufrufe der Fassade.
 *
 * Hier steht keine Fachlogik. Jedes Tool hat sein REST-Gegenstück in der
 * OpenAPI-Beschreibung - deshalb liegt die API-Dokumentation auch als
 * MCP-Resource und -Tool bei: ein Client, der nur Tools sieht, kann sie
 * trotzdem abrufen.
 *
 * Die Sprache bestimmt, was der Agent liest (Instructions, Tool-Texte) und
 * den Standard für speech. Pro Aufruf lässt sie sich per language überschreiben.
 */

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

export function createMcpServer(service: GeocoderService, language: Language = service.language): McpServer {
  const texts = mcpTexts(language);
  const languageSchema = z
    .enum(LANGUAGES as [Language, ...Language[]])
    .optional()
    .describe(texts.languageInput);
  const server = new McpServer({ name: "mcp-geocoder", version: "0.2.0" }, { instructions: texts.instructions });

  const postalCode = texts.tools.resolve_postal_code;
  server.registerTool(
    "resolve_postal_code",
    {
      title: postalCode.title,
      description: postalCode.description,
      inputSchema: {
        spokenPostalCode: z.string().describe(postalCode.inputs.spokenPostalCode),
        language: languageSchema,
      },
    },
    ({ spokenPostalCode, language: requested }) =>
      guarded(() => service.resolvePostalCode(spokenPostalCode, requested ?? language)),
  );

  const address = texts.tools.resolve_address;
  server.registerTool(
    "resolve_address",
    {
      title: address.title,
      description: address.description,
      inputSchema: {
        street: z.string().describe(address.inputs.street),
        postalCode: z.string().optional().describe(address.inputs.postalCode),
        houseNumber: z.string().optional().describe(address.inputs.houseNumber),
        locality: z.string().optional().describe(address.inputs.locality),
        language: languageSchema,
      },
    },
    (input) => guarded(() => service.resolveAddress({ ...input, language: input.language ?? language })),
  );

  const select = texts.tools.select_candidate;
  server.registerTool(
    "select_candidate",
    {
      title: select.title,
      description: select.description,
      inputSchema: {
        street: z.string().describe(select.inputs.street),
        postalCode: z.string(),
        locality: z.string(),
        houseNumber: z.string().optional(),
        language: languageSchema,
      },
    },
    (input) => guarded(() => service.selectCandidate({ ...input, language: input.language ?? language })),
  );

  const flag = texts.tools.flag_for_human;
  server.registerTool(
    "flag_for_human",
    {
      title: flag.title,
      description: flag.description,
      inputSchema: {
        reason: z.string().describe(flag.inputs.reason),
        heardStreet: z.string().optional(),
        heardPostalCode: z.string().optional(),
        attempts: z.number().int().optional(),
        language: languageSchema,
      },
    },
    ({ language: requested, ...entry }) => guarded(() => service.flagForHuman(entry, requested ?? language)),
  );

  const keyterms = texts.tools.generate_keyterms;
  server.registerTool(
    "generate_keyterms",
    {
      title: keyterms.title,
      description: keyterms.description,
      inputSchema: {
        postalCodes: z.array(z.string()).optional().describe(keyterms.inputs.postalCodes),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    ({ postalCodes, limit }) => guarded(() => service.buildKeyterms(postalCodes, limit)),
  );

  const describe = texts.tools.describe_api;
  server.registerTool(
    "describe_api",
    {
      title: describe.title,
      description: describe.description,
      inputSchema: {
        format: z.enum(["markdown", "openapi"]).optional().describe(describe.inputs.format),
      },
    },
    ({ format }) =>
      format === "openapi"
        ? jsonResult(buildOpenApiDocument(language))
        : { content: [{ type: "text" as const, text: apiGuideMarkdown(service.thresholds, language) }] },
  );

  server.registerResource(
    "api-guide",
    "geocoder://docs/api",
    { ...texts.resources.apiGuide, mimeType: "text/markdown" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: apiGuideMarkdown(service.thresholds, language) }],
    }),
  );

  server.registerResource(
    "openapi",
    "geocoder://docs/openapi.json",
    { ...texts.resources.openapi, mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(buildOpenApiDocument(language), null, 2),
        },
      ],
    }),
  );

  return server;
}
