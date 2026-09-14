import { REASONS } from "./reasons.js";
import type { MatchingThresholds } from "./scoring.js";
import type { Language, MatchDecision, StreetCandidate } from "./types.js";

/**
 * Statusentscheidung über eine gerankte Kandidatenliste.
 *
 * Die absolute Konfidenz allein reicht nicht. Zwei fast gleich gute Treffer
 * sind nie "confirmed", auch wenn beide über der Schwelle liegen - genau dort
 * entstehen die stillen Falschzuordnungen, die erst beim Endkunden auffallen.
 */
export function decide(
  candidates: StreetCandidate[],
  thresholds: MatchingThresholds,
  language: Language = "de",
): MatchDecision {
  const texts = REASONS[language];
  if (candidates.length === 0) {
    return { status: "unresolved", needsHuman: true, reason: texts.noCandidate };
  }

  const [best, second] = candidates;
  const margin = second ? best.confidence - second.confidence : 1;
  const bestLabel = texts.bestLabel(best.street, best.confidence.toFixed(2));

  if (best.confidence < thresholds.ambiguous) {
    return {
      status: "unresolved",
      needsHuman: true,
      reason: texts.belowEscalation(bestLabel, thresholds.ambiguous),
    };
  }

  if (best.confidence >= thresholds.autoAccept && margin >= thresholds.minimumMargin) {
    return {
      status: "confirmed",
      needsHuman: false,
      reason: texts.confirmed(bestLabel, margin.toFixed(2)),
    };
  }

  if (second && margin < thresholds.minimumMargin) {
    return {
      status: "ambiguous",
      needsHuman: false,
      reason: texts.tooClose(best.street, second.street, margin.toFixed(2)),
    };
  }

  return {
    status: "ambiguous",
    needsHuman: false,
    reason: best.breakdown?.cappedBy
      ? texts.capped(bestLabel, best.breakdown.cappedBy)
      : texts.belowAuto(bestLabel, thresholds.autoAccept),
  };
}
