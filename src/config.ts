import { DEFAULT_THRESHOLDS, type MatchingThresholds } from "./domain/scoring.js";

/**
 * Konfiguration aus der Umgebung. Einzige Stelle, die process.env liest.
 * Alles andere bekommt fertige Werte injiziert.
 */

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(name: string): string[] {
  return [
    ...new Set(
      (process.env[name] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

function readOptionalNumber(name: string): number | undefined {
  return process.env[name] ? readNumber(name, 0) : undefined;
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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const lat = readOptionalNumber("SERVICE_AREA_LAT");
  const lon = readOptionalNumber("SERVICE_AREA_LON");
  const photonBaseUrl = env.PHOTON_BASE_URL ?? "https://photon.komoot.io";
  return {
    openPlzBaseUrl: env.OPENPLZ_BASE_URL ?? "https://openplzapi.org",
    photonBaseUrl,
    photonEnabled: photonBaseUrl.length > 0 && env.PHOTON_ENABLED !== "false",
    serviceAreaPostalCodes: readList("SERVICE_AREA_POSTAL_CODES"),
    serviceAreaBias: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    thresholds: {
      autoAccept: readNumber("CONFIDENCE_AUTO", DEFAULT_THRESHOLDS.autoAccept),
      ambiguous: readNumber("CONFIDENCE_AMBIGUOUS", DEFAULT_THRESHOLDS.ambiguous),
      minimumMargin: readNumber("MINIMUM_MARGIN", DEFAULT_THRESHOLDS.minimumMargin),
      suggestionBand: readNumber("SUGGESTION_BAND", DEFAULT_THRESHOLDS.suggestionBand),
    },
    cacheTtlSeconds: readNumber("CACHE_TTL_SECONDS", 86_400),
    requestTimeoutMs: readNumber("REQUEST_TIMEOUT_MS", 4000),
    httpPort: readNumber("HTTP_PORT", 8080),
    authToken: env.MCP_AUTH_TOKEN ?? "",
    webEnabled: env.WEB_ENABLED !== "false",
  };
}
