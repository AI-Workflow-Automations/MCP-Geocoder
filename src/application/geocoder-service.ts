import type { EscalationEntry, EscalationSink, StreetDirectory, StreetSearch } from "../domain/ports.js";
import type { MatchingThresholds } from "../domain/scoring.js";
import type { Language } from "../domain/types.js";
import { DEFAULT_LANGUAGE } from "../speech/language.js";
import { phrasesFor, speakAddress } from "../speech/speech-formatter.js";
import { AddressResolver, type ResolveAddressInput } from "./address-resolver.js";
import { KeytermBuilder } from "./keyterm-builder.js";
import { PostalCodeResolver } from "./postal-code-resolver.js";

export interface SelectCandidateInput {
  street: string;
  postalCode: string;
  locality: string;
  houseNumber?: string;
  /** Sprache des Abschlusssatzes. Fehlt sie, gilt der Server-Standard. */
  language?: Language;
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
