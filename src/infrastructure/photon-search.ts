import type { RankedStreet, StreetSearch } from "../domain/ports.js";
import type { HttpClient } from "./http-client.js";
import { TtlCache } from "./ttl-cache.js";

/**
 * Photon (komoot, OSM-basiert) - fehlertolerantes Ranking.
 *
 * Rolle im Ablauf: Fallback, wenn die Postleitzahl fehlt oder falsch
 * verstanden wurde. Photon ist auf Search-as-you-type gebaut und verträgt
 * Tippfehler von Haus aus.
 *
 * Nominatim ist bewusst nicht eingebunden: gebaut für Adressauflösung, nicht
 * für Tippfehler - und das Ratelimit der öffentlichen Instanz trägt keine
 * Telefonie-Last.
 */

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    countrycode?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

export interface GeoBias {
  lat: number;
  lon: number;
}

export class PhotonSearch implements StreetSearch {
  readonly name = "photon";
  private readonly cache: TtlCache<RankedStreet[]>;

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    cacheTtlSeconds: number,
    /** Mittelpunkt des Einzugsgebiets - sonst gewinnt die gleichnamige Straße am anderen Ende des Landes */
    private readonly bias?: GeoBias,
  ) {
    this.cache = new TtlCache(cacheTtlSeconds);
  }

  search(query: string, postalCode?: string, limit = 15): Promise<RankedStreet[]> {
    const term = postalCode ? `${query} ${postalCode}` : query;
    return this.cache.getOrLoad(`${term}|${limit}`, async () => {
      const params = new URLSearchParams({ q: term, limit: String(limit), lang: "de" });
      if (this.bias) {
        params.set("lat", String(this.bias.lat));
        params.set("lon", String(this.bias.lon));
      }
      const response = await this.http.getJson<PhotonResponse>(`${this.baseUrl}/api?${params}`);
      return (response.features ?? [])
        .filter((feature) => !feature.properties.countrycode || feature.properties.countrycode === "DE")
        .map(toRankedStreet)
        .filter((hit): hit is RankedStreet => hit !== undefined);
    });
  }
}

function toRankedStreet(feature: PhotonFeature, rank: number): RankedStreet | undefined {
  const p = feature.properties;
  const street = (p.street ?? p.name ?? "").trim();
  if (!street) return undefined;
  return {
    street,
    postalCode: p.postcode ?? "",
    locality: p.city ?? p.district ?? "",
    federalState: p.state,
    rank,
  };
}
