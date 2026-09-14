import type { MatchingThresholds } from "./scoring.js";
import type { MatchDecision, StreetCandidate } from "./types.js";

/**
 * Statusentscheidung über eine gerankte Kandidatenliste.
 *
 * Die absolute Konfidenz allein reicht nicht. Zwei fast gleich gute Treffer
 * sind nie "confirmed", auch wenn beide über der Schwelle liegen - genau dort
 * entstehen die stillen Falschzuordnungen, die erst beim Endkunden auffallen.
 */
export function decide(candidates: StreetCandidate[], thresholds: MatchingThresholds): MatchDecision {
  if (candidates.length === 0) {
    return { status: "unresolved", needsHuman: true, reason: "Kein Kandidat im Straßenverzeichnis gefunden." };
  }

  const [best, second] = candidates;
  const margin = second ? best.confidence - second.confidence : 1;
  const bestLabel = `"${best.street}" bei ${best.confidence.toFixed(2)}`;

  if (best.confidence < thresholds.ambiguous) {
    return {
      status: "unresolved",
      needsHuman: true,
      reason: `Bester Treffer ${bestLabel} - unter der Eskalationsschwelle ${thresholds.ambiguous}.`,
    };
  }

  if (best.confidence >= thresholds.autoAccept && margin >= thresholds.minimumMargin) {
    return {
      status: "confirmed",
      needsHuman: false,
      reason: `${bestLabel}, Abstand zum nächsten Treffer ${margin.toFixed(2)}.`,
    };
  }

  if (second && margin < thresholds.minimumMargin) {
    return {
      status: "ambiguous",
      needsHuman: false,
      reason: `"${best.street}" und "${second.street}" liegen mit ${margin.toFixed(2)} zu dicht beieinander - Auswahl vorlesen.`,
    };
  }

  return {
    status: "ambiguous",
    needsHuman: false,
    reason: best.breakdown?.cappedBy
      ? `${bestLabel} - gedeckelt: ${best.breakdown.cappedBy}.`
      : `${bestLabel} - unter der Auto-Schwelle ${thresholds.autoAccept}.`,
  };
}
