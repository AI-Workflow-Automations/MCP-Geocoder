import type { EscalationEntry, EscalationSink, StreetDirectory, StreetSearch } from "../domain/ports.js";
import type { MatchingThresholds } from "../domain/scoring.js";
import { phrases, speakAddress } from "../speech/speech-formatter.js";
import { AddressResolver, type ResolveAddressInput } from "./address-resolver.js";
import { KeytermBuilder } from "./keyterm-builder.js";
import { PostalCodeResolver } from "./postal-code-resolver.js";

export interface SelectCandidateInput {
  street: string;
  postalCode: string;
  locality: string;
  houseNumber?: string;
}

export interface GeocoderDependencies {
  directory: StreetDirectory;
  search?: StreetSearch;
  escalations: EscalationSink;
  thresholds: MatchingThresholds;
  serviceAreaPostalCodes: string[];
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

  resolvePostalCode(spoken: string) {
    return this.postalCodes.resolve(spoken);
  }

  resolveAddress(input: ResolveAddressInput) {
    return this.addresses.resolve(input);
  }

  /** Nach einer Auswahlfrage: erst hier gilt die Adresse als erfasst. */
  selectCandidate(input: SelectCandidateInput) {
    const spoken = speakAddress(input.street, input.houseNumber, input.postalCode, input.locality);
    return {
      status: "confirmed" as const,
      needsHuman: false,
      address: input,
      formatted: `${[input.street, input.houseNumber].filter(Boolean).join(" ")}, ${input.postalCode} ${input.locality}`,
      speech: phrases.addressRecorded(spoken),
    };
  }

  flagForHuman(entry: EscalationEntry) {
    this.deps.escalations.record(entry);
    return {
      status: "unresolved" as const,
      needsHuman: true,
      logged: true,
      reason: entry.reason,
      speech: phrases.handoverToHuman,
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
}
