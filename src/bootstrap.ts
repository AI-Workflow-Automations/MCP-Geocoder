import { composeGeocoderService } from "./composition.js";
import { loadConfig } from "./config.js";

/** Gemeinsamer Start für beide Einstiege: Konfiguration lesen, Service bauen. */
export const config = loadConfig();
export const composeService = () => composeGeocoderService(config);
