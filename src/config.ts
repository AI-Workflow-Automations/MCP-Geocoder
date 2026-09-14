import { DEFAULT_THRESHOLDS, type MatchingThresholds } from "./domain/scoring.js";
import type { Language } from "./domain/types.js";
import { DEFAULT_LANGUAGE, parseLanguage } from "./speech/language.js";

/**
 * Konfiguration aus der Umgebung. Einzige Stelle, die process.env liest.
 * Alles andere bekommt fertige Werte injiziert.
 */

type Env = NodeJS.ProcessEnv;

function readNumber(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(env: Env, name: string): string[] {
  return [
    ...new Set(
      (env[name] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

function readOptionalNumber(env: Env, name: string): number | undefined {
  return env[name] ? readNumber(env, name, 0) : undefined;
}

export interface AppConfig {
  openPlzBaseUrl: string;
  photonBaseUrl: string;
  /** Leer = Photon deaktiviert */
  photonEnabled: boolean;
  serviceAreaPostalCodes: string[];
  serviceAreaBias?: { lat: number; lon: number };
  thresholds: MatchingThresholds;
  cacheTtlSeconds: number;
  requestTimeoutMs: number;
  httpPort: number;
  authToken: string;
  /** Demo-Oberfläche und REST-API ausliefern */
  webEnabled: boolean;
  /** Öffentliche Basis-URL für Canonical, JSON-LD, llms.txt. Leer = aus dem Request ableiten. */
  publicUrl?: string;
  /** Standardsprache für speech, reason und die Prompts unter der Haube (MCP-Instructions, Tool-Texte, Doku). */
  language: Language;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const lat = readOptionalNumber(env, "SERVICE_AREA_LAT");
  const lon = readOptionalNumber(env, "SERVICE_AREA_LON");
  const photonBaseUrl = env.PHOTON_BASE_URL ?? "https://photon.komoot.io";
  return {
    openPlzBaseUrl: env.OPENPLZ_BASE_URL ?? "https://openplzapi.org",
    photonBaseUrl,
    photonEnabled: photonBaseUrl.length > 0 && env.PHOTON_ENABLED !== "false",
    serviceAreaPostalCodes: readList(env, "SERVICE_AREA_POSTAL_CODES"),
    serviceAreaBias: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    thresholds: {
      autoAccept: readNumber(env, "CONFIDENCE_AUTO", DEFAULT_THRESHOLDS.autoAccept),
      ambiguous: readNumber(env, "CONFIDENCE_AMBIGUOUS", DEFAULT_THRESHOLDS.ambiguous),
      minimumMargin: readNumber(env, "MINIMUM_MARGIN", DEFAULT_THRESHOLDS.minimumMargin),
      suggestionBand: readNumber(env, "SUGGESTION_BAND", DEFAULT_THRESHOLDS.suggestionBand),
    },
    cacheTtlSeconds: readNumber(env, "CACHE_TTL_SECONDS", 86_400),
    requestTimeoutMs: readNumber(env, "REQUEST_TIMEOUT_MS", 4000),
    httpPort: readNumber(env, "HTTP_PORT", 8080),
    authToken: env.MCP_AUTH_TOKEN ?? "",
    webEnabled: env.WEB_ENABLED !== "false",
    publicUrl: env.PUBLIC_URL?.trim() || undefined,
    language: parseLanguage(env.LANGUAGE, DEFAULT_LANGUAGE),
  };
}
