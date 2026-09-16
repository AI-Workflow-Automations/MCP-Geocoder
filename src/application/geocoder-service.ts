import { extractPostalCode, normalizeStreetName } from "../domain/normalization.js";
import type { EscalationEntry, EscalationSink, StreetDirectory, StreetSearch } from "../domain/ports.js";
import type { MatchingThresholds } from "../domain/scoring.js";
import type { Language } from "../domain/types.js";
import { DEFAULT_LANGUAGE } from "../speech/language.js";
import { phrasesFor, speakAddress } from "../speech/speech-formatter.js";
import { AddressResolver, type ResolveAddressInput } from "./address-resolver.js";
import { KeytermBuilder } from "./keyterm-builder.js";
import { PostalCodeResolver } from "./postal-code-resolver.js";

/** Standard- und Höchstlimit für Straßenlisten (MCP/REST). */
export const DEFAULT_STREET_LIST_LIMIT = 50;
export const MAX_STREET_LIST_LIMIT = 100;

export interface SelectCandidateInput {
  street: string;
  postalCode: string;
  locality: string;
  houseNumber?: string;
  /** Sprache des Abschlusssatzes. Fehlt sie, gilt der Server-Standard. */
  language?: Language;
}

export interface ListStreetsInput {
  /** Bestätigte fünfstellige Postleitzahl */
  postalCode: string;
  /** Optionaler Namenspräfix (normalisiert, case-/umlauttolerant) */
  prefix?: string;
  /** Maximale Anzahl zurückgegebener Straßennamen (1–100, Standard 50) */
  limit?: number;
}

export interface ListStreetsResult {
  postalCode: string;
  streets: string[];
  /** Länge von `streets` */
  count: number;
  /** Treffer nach Präfixfilter, vor Limit */
  total: number;
  /** true, wenn `total` das Limit überschreitet */
  truncated: boolean;
  prefix?: string;
}

export interface GeocoderDependencies {
  directory: StreetDirectory;
  search?: StreetSearch;
  escalations: EscalationSink;
  thresholds: MatchingThresholds;
  serviceAreaPostalCodes: string[];
  /** Standardsprache für speech und reason, wenn die Anfrage keine nennt. */
  language?: Language;
}

/**
 * Fassade über alle Anwendungsfälle.
 *
 * MCP-Tools und REST-API rufen ausschließlich diese Klasse. So bleibt die
 * Fachlogik an einer Stelle, und beide Schnittstellen verhalten sich garantiert
 * gleich - was die Weboberfläche zeigt, tut auch der Telefonagent.
 */
export class GeocoderService {
  private readonly addresses: AddressResolver;
  private readonly postalCodes: PostalCodeResolver;
  private readonly keyterms: KeytermBuilder;

  constructor(private readonly deps: GeocoderDependencies) {
    this.addresses = new AddressResolver(deps.directory, deps.search, deps.thresholds);
    this.postalCodes = new PostalCodeResolver(deps.directory);
    this.keyterms = new KeytermBuilder(deps.directory);
  }

  resolvePostalCode(spoken: string, language?: Language) {
    return this.postalCodes.resolve(spoken, this.languageOr(language));
  }

  resolveAddress(input: ResolveAddressInput) {
    return this.addresses.resolve({ ...input, language: this.languageOr(input.language) });
  }

  /** Nach einer Auswahlfrage: erst hier gilt die Adresse als erfasst. */
  selectCandidate(input: SelectCandidateInput) {
    const { language: requested, ...address } = input;
    const language = this.languageOr(requested);
    const spoken = speakAddress(address.street, address.houseNumber, address.postalCode, address.locality, language);
    return {
      status: "confirmed" as const,
      needsHuman: false,
      address,
      formatted: `${[address.street, address.houseNumber].filter(Boolean).join(" ")}, ${address.postalCode} ${address.locality}`,
      speech: phrasesFor(language).addressRecorded(spoken),
    };
  }

  flagForHuman(entry: EscalationEntry, language?: Language) {
    this.deps.escalations.record(entry);
    return {
      status: "unresolved" as const,
      needsHuman: true,
      logged: true,
      reason: entry.reason,
      speech: phrasesFor(this.languageOr(language)).handoverToHuman,
    };
  }

  buildKeyterms(postalCodes?: string[], limit?: number) {
    const codes = postalCodes?.length ? postalCodes : this.deps.serviceAreaPostalCodes;
    return this.keyterms.build(codes, limit);
  }

  /**
   * Straßenliste einer bestätigten PLZ.
   *
   * Nutzt `StreetDirectory.listStreets` (inkl. OpenPLZ-TTL-Cache). Prefix und
   * Limit werden aus der gecachten Vollliste abgeleitet – kein Extra-Cache.
   * Kein `speech`: die Liste ist Setup/Klärung, keine TTS-Vorleseliste.
   */
  async listStreets(input: ListStreetsInput): Promise<ListStreetsResult> {
    const postalCode = extractPostalCode(input.postalCode);
    if (!postalCode) {
      throw new Error('Ungültige Postleitzahl. list_streets erwartet eine bestätigte fünfstellige PLZ (z.B. "10115").');
    }

    const limit = clampStreetListLimit(input.limit);
    const prefix = input.prefix?.trim() || undefined;
    const prefixNormalized = prefix ? normalizeStreetName(prefix) : undefined;

    const entries = await this.deps.directory.listStreets(postalCode);
    const matching = prefixNormalized
      ? entries.filter((entry) => normalizeStreetName(entry.street).startsWith(prefixNormalized))
      : entries;

    const total = matching.length;
    const truncated = total > limit;
    const streets = matching.slice(0, limit).map((entry) => entry.street);

    return {
      postalCode,
      streets,
      count: streets.length,
      total,
      truncated,
      ...(prefix ? { prefix } : {}),
    };
  }

  get thresholds(): MatchingThresholds {
    return this.deps.thresholds;
  }

  get serviceArea(): string[] {
    return this.deps.serviceAreaPostalCodes;
  }

  /** Server-Standardsprache. */
  get language(): Language {
    return this.deps.language ?? DEFAULT_LANGUAGE;
  }

  private languageOr(requested?: Language): Language {
    return requested ?? this.language;
  }
}

function clampStreetListLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_STREET_LIST_LIMIT;
  return Math.min(MAX_STREET_LIST_LIMIT, Math.max(1, Math.trunc(limit)));
}
