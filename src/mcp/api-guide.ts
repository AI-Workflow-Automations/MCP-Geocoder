import type { MatchingThresholds } from "../domain/scoring.js";

/**
 * API-Leitfaden als Markdown - für Menschen, die den Server einbinden.
 * Wird mit den tatsächlich aktiven Schwellwerten gerendert, damit die Doku
 * nie etwas anderes behauptet als der Server tut.
 */
export function apiGuideMarkdown(thresholds: MatchingThresholds): string {
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
| \`describe_api\` | \`GET /openapi.json\` | Diese Dokumentation |

## Gesprächsablauf

1. **Postleitzahl zuerst.** \`resolve_postal_code\` – Ziffern überstehen Schmalband besser als Ortsnamen.
2. **Dann die Straße.** \`resolve_address\` mit bestätigter PLZ.
3. **Auf \`status\` reagieren:**
   - \`confirmed\` → \`speech\` vorlesen, bei „ja" weiter.
   - \`ambiguous\` → \`speech\` vorlesen, Auswahl abwarten, \`select_candidate\`.
   - \`unresolved\` / \`needsHuman: true\` → \`speech\` vorlesen, Call übergeben.
4. **Lehnt der Anrufer alles ab** oder klappt es dreimal nicht → \`flag_for_human\`. Nicht raten.

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
