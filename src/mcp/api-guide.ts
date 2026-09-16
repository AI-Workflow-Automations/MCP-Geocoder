import type { MatchingThresholds } from "../domain/scoring.js";
import type { Language } from "../domain/types.js";

/**
 * API-Leitfaden als Markdown - für Menschen und Agenten, die den Server einbinden.
 * Wird mit den tatsächlich aktiven Schwellwerten gerendert, damit die Doku
 * nie etwas anderes behauptet als der Server tut.
 */
export function apiGuideMarkdown(thresholds: MatchingThresholds, language: Language = "de"): string {
  return language === "en" ? englishGuide(thresholds) : germanGuide(thresholds);
}

function germanGuide(thresholds: MatchingThresholds): string {
  return `# MCP-Geocoder – API-Leitfaden

Tolerante deutsche Adresserfassung für Telefonagenten. Jede Antwort enthält den
fertigen Satz für die Sprachausgabe (\`speech\`) und ein Flag, ob der Call an einen
Menschen gehen muss (\`needsHuman\`).

REST und MCP sind gleichwertig – dieselbe Fachlogik, dieselben Antworten.

| MCP-Tool | REST | Wann |
|---|---|---|
| \`resolve_postal_code\` | \`POST /api/postal-code\` | Immer zuerst |
| \`resolve_address\` | \`POST /api/address\` | Für jeden Straßennamen |
| \`select_candidate\` | \`POST /api/address/select\` | Nach einer Auswahlfrage |
| \`flag_for_human\` | \`POST /api/escalate\` | Anrufer lehnt alles ab / dritter Fehlversuch |
| \`generate_keyterms\` | \`POST /api/keyterms\` | Einmalig beim Einrichten |
| \`list_streets\` | \`POST /api/streets\` | Bestätigte PLZ: Straßenliste (Setup/Klärung; nicht vorlesen) |
| \`describe_api\` | \`GET /openapi.json\` | Diese Dokumentation |

## Gesprächsablauf

1. **Postleitzahl zuerst.** \`resolve_postal_code\` – Ziffern überstehen Schmalband besser als Ortsnamen.
2. **Dann die Straße.** \`resolve_address\` mit bestätigter PLZ.
3. **Auf \`status\` reagieren:**
   - \`confirmed\` → \`speech\` vorlesen, bei „ja" weiter.
   - \`ambiguous\` → \`speech\` vorlesen, Auswahl abwarten, \`select_candidate\`.
   - \`unresolved\` / \`needsHuman: true\` → \`speech\` vorlesen, Call übergeben.
4. **Lehnt der Anrufer alles ab** oder klappt es dreimal nicht → \`flag_for_human\`. Nicht raten.

## Sprache

Jedes Gesprächs-Tool nimmt optional \`language\` (\`"de"\` oder \`"en"\`) an und formuliert
\`speech\` und \`reason\` entsprechend. Ohne Angabe gilt die Server-Sprache (\`LANGUAGE\`).
Straßennamen bleiben in beiden Sprachen deutsch.

## Antwortformat

\`\`\`json
{
  "status": "ambiguous",
  "needsHuman": false,
  "candidates": [
    { "street": "Heinrichstraße", "confidence": 0.95, "source": "openplz" },
    { "street": "Henrichweg", "confidence": 0.84, "source": "openplz",
      "breakdown": { "cappedBy": "Grundwort widerspricht sich (strasse vs. weg)" } }
  ],
  "speech": "Da habe ich mehrere Möglichkeiten. Erstens: Heinrichstraße in 1 0 1 1 5 Berlin. Zweitens: ...",
  "reason": "\\"Heinrichstraße\\" und \\"Henrichweg\\" liegen mit 0.11 ... "
}
\`\`\`

\`speech\` wird **wortwörtlich** vorgelesen. Postleitzahlen und Hausnummern sind darin
bereits sprechbar aufbereitet.

## Aktive Schwellwerte

| Wert | Aktuell | Bedeutung |
|---|---|---|
| \`autoAccept\` | ${thresholds.autoAccept} | ab hier \`confirmed\` (bei ausreichendem Abstand) |
| \`ambiguous\` | ${thresholds.ambiguous} | ab hier Auswahl vorlesen, darunter Übergabe |
| \`minimumMargin\` | ${thresholds.minimumMargin} | Mindestabstand zum Zweitplatzierten für \`confirmed\` |
| \`suggestionBand\` | ${thresholds.suggestionBand} | nur Kandidaten in diesem Abstand werden vorgelesen |

Zusätzlich gilt: ein widersprüchliches Grundwort (Weg vs. Straße) deckelt die
Konfidenz auf 0.84 – so ein Kandidat wird nie automatisch bestätigt.

## Bewertung

\`confidence\` = 0.45 · lexikalisch + 0.35 · phonetisch + 0.10 · Token + 0.10 · Grundwort,
jeweils auf dem Wortstamm ohne Grundwort. Kölner Phonetik für den Klang,
Jaro-Winkler und Damerau-Levenshtein für die Schreibweise.
`;
}

function englishGuide(thresholds: MatchingThresholds): string {
  return `# MCP-Geocoder – API guide

Fault-tolerant German address capture for phone agents. Every response contains the
final sentence for speech output (\`speech\`) and a flag telling whether the call must go
to a human (\`needsHuman\`).

REST and MCP are equivalent – same business logic, same responses.

| MCP tool | REST | When |
|---|---|---|
| \`resolve_postal_code\` | \`POST /api/postal-code\` | Always first |
| \`resolve_address\` | \`POST /api/address\` | For every street name |
| \`select_candidate\` | \`POST /api/address/select\` | After a choice question |
| \`flag_for_human\` | \`POST /api/escalate\` | Caller rejects everything / third failed attempt |
| \`generate_keyterms\` | \`POST /api/keyterms\` | Once during setup |
| \`list_streets\` | \`POST /api/streets\` | Confirmed postal code: street list (setup/clarification; do not read aloud) |
| \`describe_api\` | \`GET /openapi.json\` | This documentation |

## Conversation flow

1. **Postal code first.** \`resolve_postal_code\` – digits survive narrowband better than place names.
2. **Then the street.** \`resolve_address\` with the confirmed postal code.
3. **React to \`status\`:**
   - \`confirmed\` → read out \`speech\`, continue on "yes".
   - \`ambiguous\` → read out \`speech\`, wait for the choice, \`select_candidate\`.
   - \`unresolved\` / \`needsHuman: true\` → read out \`speech\`, hand over the call.
4. **If the caller rejects everything** or it fails three times → \`flag_for_human\`. Do not guess.

## Language

Every conversation tool accepts an optional \`language\` (\`"de"\` or \`"en"\`) and phrases
\`speech\` and \`reason\` accordingly. Without it the server language (\`LANGUAGE\`) applies.
Street names stay German in both languages.

## Response format

\`\`\`json
{
  "status": "ambiguous",
  "needsHuman": false,
  "candidates": [
    { "street": "Heinrichstraße", "confidence": 0.95, "source": "openplz" },
    { "street": "Henrichweg", "confidence": 0.84, "source": "openplz",
      "breakdown": { "cappedBy": "Street type conflict (strasse vs. weg)" } }
  ],
  "speech": "I have several possibilities here. First: Heinrichstraße in 1 0 1 1 5 Berlin. Second: ...",
  "reason": "\\"Heinrichstraße\\" and \\"Henrichweg\\" are too close at 0.11 ... "
}
\`\`\`

\`speech\` is read out **verbatim**. Postal codes and house numbers are already
prepared for speech.

## Active thresholds

| Value | Current | Meaning |
|---|---|---|
| \`autoAccept\` | ${thresholds.autoAccept} | \`confirmed\` from here (given sufficient margin) |
| \`ambiguous\` | ${thresholds.ambiguous} | choices are read out from here, hand-over below |
| \`minimumMargin\` | ${thresholds.minimumMargin} | minimum margin to the runner-up for \`confirmed\` |
| \`suggestionBand\` | ${thresholds.suggestionBand} | only candidates within this margin are read out |

In addition: a conflicting street type (Weg vs. Straße) caps the confidence at 0.84 –
such a candidate is never confirmed automatically.

## Scoring

\`confidence\` = 0.45 · lexical + 0.35 · phonetic + 0.10 · token + 0.10 · street type,
each on the stem without the street type. Cologne phonetics for the sound,
Jaro-Winkler and Damerau-Levenshtein for the spelling.
`;
}
