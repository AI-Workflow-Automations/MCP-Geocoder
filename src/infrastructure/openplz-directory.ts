import type { DirectoryStreet, StreetDirectory } from "../domain/ports.js";
import type { Locality } from "../domain/types.js";
import type { HttpClient } from "./http-client.js";
import { TtlCache } from "./ttl-cache.js";

/**
 * OpenPLZ API - amtliches Verzeichnis von Postleitzahlen, Orten und Straßen.
 *
 * Rolle im Ablauf: Suchraum eingrenzen. Eine deutsche Postleitzahl hat
 * typischerweise 50 bis 400 Straßen. Gegen diese Liste zu matchen ist ein
 * anderes Problem als gegen alle Straßen des Landes.
 */

interface OpenPlzStreet {
  name: string;
  postalCode: string;
  locality: string;
  borough?: string;
  suburb?: string;
  federalState?: { name?: string };
}

interface OpenPlzLocality {
  postalCode: string;
  name: string;
  municipality?: { name?: string };
  district?: { name?: string };
  federalState?: { name?: string };
}

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

export class OpenPlzDirectory implements StreetDirectory {
  readonly name = "openplz";
  private readonly streets: TtlCache<DirectoryStreet[]>;
  private readonly localities: TtlCache<Locality[]>;

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    cacheTtlSeconds: number,
  ) {
    this.streets = new TtlCache(cacheTtlSeconds);
    this.localities = new TtlCache(cacheTtlSeconds);
  }

  /** Paginiert - OpenPLZ liefert höchstens 50 Einträge pro Seite. */
  listStreets(postalCode: string): Promise<DirectoryStreet[]> {
    return this.streets.getOrLoad(postalCode, async () => {
      const collected: DirectoryStreet[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${this.baseUrl}/de/Streets?postalCode=${encodeURIComponent(postalCode)}&page=${page}&pageSize=${PAGE_SIZE}`;
        const batch = await this.http.getJson<OpenPlzStreet[]>(url);
        if (!Array.isArray(batch) || batch.length === 0) break;
        collected.push(...batch.map(toDirectoryStreet));
        if (batch.length < PAGE_SIZE) break;
      }
      return collected;
    });
  }

  listLocalities(postalCode: string): Promise<Locality[]> {
    return this.localities.getOrLoad(postalCode, async () => {
      const url = `${this.baseUrl}/de/Localities?postalCode=${encodeURIComponent(postalCode)}&page=1&pageSize=${PAGE_SIZE}`;
      const raw = await this.http.getJson<OpenPlzLocality[]>(url);
      return Array.isArray(raw) ? raw.map(toLocality) : [];
    });
  }
}

function toDirectoryStreet(entry: OpenPlzStreet): DirectoryStreet {
  return {
    street: entry.name,
    postalCode: entry.postalCode,
    locality: entry.locality,
    borough: entry.borough,
    suburb: entry.suburb,
    federalState: entry.federalState?.name,
  };
}

function toLocality(entry: OpenPlzLocality): Locality {
  return {
    postalCode: entry.postalCode,
    locality: entry.name,
    municipality: entry.municipality?.name,
    district: entry.district?.name,
    federalState: entry.federalState?.name,
  };
}
