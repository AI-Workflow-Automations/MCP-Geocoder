import type { AppConfig } from "../config.js";

/**
 * Rendert die Startseite: statisches Template plus die Head-Tags, die vom
 * Deployment abhängen - Canonical-URL, Geo-Meta fürs Einzugsgebiet, JSON-LD.
 * Reine Funktion, damit sie ohne HTTP testbar bleibt.
 */

/** Platzhalter im Template, bleibt ohne Rendering ein harmloser Kommentar. */
export const DYNAMIC_HEAD_MARKER = "<!-- @dynamic-head -->";

export interface IndexPageContext {
  /** Öffentliche Basis-URL ohne abschließenden Schrägstrich, z. B. https://geocoder.example.de */
  baseUrl: string;
  serviceAreaPostalCodes: string[];
  serviceAreaBias?: AppConfig["serviceAreaBias"];
}

const DESCRIPTION =
  "Resolves spoken German postal codes and street names against official data. " +
  "Top-3 candidates, confidence score, escalation flag and a TTS-ready confirmation – as MCP server and REST API.";

export function renderIndexPage(template: string, context: IndexPageContext): string {
  return template.replace(DYNAMIC_HEAD_MARKER, renderDynamicHead(context));
}

/** llms.txt (llmstxt.org): Markdown-Übersicht für KI-Crawler, Links absolut. */
export function renderLlmsTxt(template: string, baseUrl: string): string {
  return template.replaceAll("{{BASE_URL}}", baseUrl);
}

export function renderDynamicHead(context: IndexPageContext): string {
  const url = `${context.baseUrl}/`;
  const tags = [
    `<link rel="canonical" href="${escapeAttribute(url)}">`,
    `<meta property="og:url" content="${escapeAttribute(url)}">`,
    ...renderGeoMeta(context.serviceAreaBias),
    `<script type="application/ld+json">${serializeJsonLd(buildJsonLd(context))}</script>`,
  ];
  return tags.join("\n  ");
}

/** geo.* und ICBM: verbreitete, wenn auch informelle Meta-Tags für den Standort. */
function renderGeoMeta(bias: AppConfig["serviceAreaBias"]): string[] {
  const tags = [`<meta name="geo.region" content="DE">`];
  if (bias) {
    tags.push(`<meta name="geo.position" content="${bias.lat};${bias.lon}">`);
    tags.push(`<meta name="ICBM" content="${bias.lat}, ${bias.lon}">`);
  }
  return tags;
}

export function buildJsonLd(context: IndexPageContext): Record<string, unknown> {
  const url = `${context.baseUrl}/`;
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MCP-Geocoder",
    url,
    description: DESCRIPTION,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en",
    isAccessibleForFree: true,
    areaServed: buildAreaServed(context),
    softwareHelp: { "@type": "CreativeWork", name: "OpenAPI 3.1 document", url: `${context.baseUrl}/openapi.json` },
    publisher: {
      "@type": "Organization",
      name: "AI Workflow Automations",
      url: "https://github.com/AI-Workflow-Automations",
    },
    codeRepository: "https://github.com/AI-Workflow-Automations/MCP-Geocoder",
  };
}

/** Einzugsgebiet als DefinedRegion mit PLZ-Liste; ohne Konfiguration ganz Deutschland. */
function buildAreaServed(context: IndexPageContext): Record<string, unknown> {
  if (context.serviceAreaPostalCodes.length === 0) {
    return { "@type": "Country", name: "Germany", identifier: "DE" };
  }
  const region: Record<string, unknown> = {
    "@type": "DefinedRegion",
    addressCountry: "DE",
    postalCode: context.serviceAreaPostalCodes,
  };
  if (context.serviceAreaBias) {
    region.geoMidpoint = {
      "@type": "GeoCoordinates",
      latitude: context.serviceAreaBias.lat,
      longitude: context.serviceAreaBias.lon,
    };
  }
  return region;
}

/** JSON in <script>: "<" maskieren, damit kein "</script>" aus Daten das Dokument bricht. */
function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Basis-URL für Canonical und JSON-LD. Konfiguration gewinnt; sonst aus dem
 * Request, inklusive X-Forwarded-* hinter einem Reverse Proxy.
 */
export function resolveBaseUrl(
  configured: string | undefined,
  headers: { forwardedProto?: string; forwardedHost?: string; host?: string; protocol: string },
): string {
  if (configured) return configured.replace(/\/+$/, "");
  const proto = headers.forwardedProto?.split(",")[0]?.trim() || headers.protocol;
  const host = headers.forwardedHost?.split(",")[0]?.trim() || headers.host || "localhost";
  return `${proto}://${host}`;
}
