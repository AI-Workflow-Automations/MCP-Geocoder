import { GeocoderService } from "./application/geocoder-service.js";
import type { AppConfig } from "./config.js";
import { StderrEscalationLog } from "./infrastructure/escalation-log.js";
import { FetchHttpClient } from "./infrastructure/http-client.js";
import { OpenPlzDirectory } from "./infrastructure/openplz-directory.js";
import { PhotonSearch } from "./infrastructure/photon-search.js";

/**
 * Composition Root: hier - und nur hier - werden konkrete Implementierungen
 * zusammengesteckt. Tests bauen sich ihren Service mit Fixtures selbst.
 */
export function composeGeocoderService(config: AppConfig): GeocoderService {
  const http = new FetchHttpClient(config.requestTimeoutMs);
  return new GeocoderService({
    directory: new OpenPlzDirectory(http, config.openPlzBaseUrl, config.cacheTtlSeconds),
    search: config.photonEnabled
      ? new PhotonSearch(http, config.photonBaseUrl, config.cacheTtlSeconds, config.serviceAreaBias)
      : undefined,
    escalations: new StderrEscalationLog(),
    thresholds: config.thresholds,
    serviceAreaPostalCodes: config.serviceAreaPostalCodes,
    language: config.language,
  });
}
