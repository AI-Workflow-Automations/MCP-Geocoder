import { decide } from "../domain/decision.js";
import { extractPostalCode, splitHouseNumber } from "../domain/normalization.js";
import type { DirectoryStreet, RankedStreet, StreetDirectory, StreetSearch } from "../domain/ports.js";
import { type MatchingThresholds, rankCandidates, scoreStreetName } from "../domain/scoring.js";
import type { AddressResolution, Language, MatchStatus, StreetCandidate } from "../domain/types.js";
import { DEFAULT_LANGUAGE } from "../speech/language.js";
import { phrasesFor, speakAddress, speakChoices } from "../speech/speech-formatter.js";

export interface ResolveAddressInput {
  street: string;
  postalCode?: string;
  houseNumber?: string;
  locality?: string;
  /** Sprache für speech und reason. Fehlt sie, gilt der Server-Standard. */
  language?: Language;
}

/** Photon-Rang leicht einrechnen: der Geocoder weiß mehr über Relevanz als reine Textnähe. */
const SEARCH_RANK_BONUS = 0.04;
const SEARCH_RANK_STEP = 0.005;
/** Treffer außerhalb der gesagten Postleitzahl abwerten, aber nicht verwerfen - manchmal ist die PLZ das Falschverstandene. */
const FOREIGN_POSTAL_CODE_PENALTY = 0.12;

/**
 * Kern der Adresserfassung.
 *
 * Reihenfolge ist bewusst: erst gegen das amtliche Verzeichnis der Postleitzahl
 * (kleiner, sauberer Suchraum), dann erst die fehlertolerante Suche. Andersherum
 * gewinnt bei gleichnamigen Straßen regelmäßig die falsche Stadt.
 *
 * Das Ergebnis sagt dem Agenten nicht nur, was gefunden wurde, sondern was er
 * als Nächstes sagen soll.
 */
export class AddressResolver {
  constructor(
    private readonly directory: StreetDirectory,
    private readonly search: StreetSearch | undefined,
    private readonly thresholds: MatchingThresholds,
    private readonly log: Pick<Console, "error"> = console,
  ) {}

  async resolve(input: ResolveAddressInput): Promise<AddressResolution> {
    const split = splitHouseNumber(input.street);
    const street = split.street;
    const houseNumber = input.houseNumber ?? split.houseNumber;
    const postalCode = input.postalCode ? extractPostalCode(input.postalCode) : undefined;
    const language = input.language ?? DEFAULT_LANGUAGE;

    const candidates: StreetCandidate[] = [];
    if (postalCode) candidates.push(...(await this.fromDirectory(street, postalCode, language)));

    const bestSoFar = rankCandidates(candidates, this.thresholds, 1)[0];
    const directoryInsufficient = !(postalCode && bestSoFar) || bestSoFar.confidence < this.thresholds.autoAccept;
    if (directoryInsufficient && this.search) candidates.push(...(await this.fromSearch(street, postalCode, language)));

    const ranked = rankCandidates(candidates, this.thresholds);
    const decision = decide(ranked, this.thresholds, language);

    return {
      status: decision.status,
      needsHuman: decision.needsHuman,
      best: decision.status === "unresolved" ? undefined : ranked[0],
      candidates: ranked,
      speech: this.speechFor(decision.status, ranked, houseNumber, language),
      heard: { postalCode: input.postalCode, street: input.street, houseNumber },
      reason: decision.reason,
    };
  }

  private async fromDirectory(street: string, postalCode: string, language: Language): Promise<StreetCandidate[]> {
    try {
      const entries = await this.directory.listStreets(postalCode);
      return entries.map((entry) => this.toCandidate(street, entry, "openplz", language));
    } catch (error) {
      // Upstream weg: nicht abbrechen, die Suche übernimmt. Der Anrufer merkt
      // nichts außer einer etwas schwächeren Konfidenz.
      this.log.error(`[mcp-geocoder] ${this.directory.name} nicht erreichbar: ${(error as Error).message}`);
      return [];
    }
  }

  private async fromSearch(
    street: string,
    postalCode: string | undefined,
    language: Language,
  ): Promise<StreetCandidate[]> {
    if (!this.search) return [];
    try {
      const hits = await this.search.search(street, postalCode);
      return hits.map((hit) => this.toSearchCandidate(street, hit, language, postalCode));
    } catch (error) {
      this.log.error(`[mcp-geocoder] ${this.search.name} nicht erreichbar: ${(error as Error).message}`);
      return [];
    }
  }

  private toCandidate(
    heard: string,
    entry: DirectoryStreet,
    source: StreetCandidate["source"],
    language: Language,
  ): StreetCandidate {
    const breakdown = scoreStreetName(heard, entry.street, language);
    return { ...entry, confidence: breakdown.total, source, breakdown };
  }

  private toSearchCandidate(
    heard: string,
    hit: RankedStreet,
    language: Language,
    postalCode?: string,
  ): StreetCandidate {
    const base = this.toCandidate(heard, hit, "photon", language);
    const rankBonus = Math.max(0, SEARCH_RANK_BONUS - hit.rank * SEARCH_RANK_STEP);
    const foreign = postalCode && hit.postalCode && hit.postalCode !== postalCode;
    const penalty = foreign ? FOREIGN_POSTAL_CODE_PENALTY : 0;
    return {
      ...base,
      postalCode: hit.postalCode || postalCode || "",
      confidence: clamp(base.confidence + rankBonus - penalty),
    };
  }

  private speechFor(
    status: MatchStatus,
    candidates: StreetCandidate[],
    houseNumber: string | undefined,
    language: Language,
  ): string {
    const phrases = phrasesFor(language);
    if (status === "unresolved") return phrases.addressUnresolved;
    if (status === "confirmed") {
      const best = candidates[0];
      return phrases.confirmAddress(speakAddress(best.street, houseNumber, best.postalCode, best.locality, language));
    }
    const options = candidates.map((c) => speakAddress(c.street, undefined, c.postalCode, c.locality, language));
    return phrases.chooseAddress(speakChoices(options, language));
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}
