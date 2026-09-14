#!/usr/bin/env bash
# Rendert alle .puml in diesem Verzeichnis nach SVG.
#
# Voraussetzung: brew install plantuml graphviz
# Ohne Graphviz fällt das Skript auf smetana zurück (PlantUMLs eigene Layout-Engine).
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v plantuml >/dev/null 2>&1; then
  echo "plantuml nicht gefunden. Installieren mit: brew install plantuml graphviz" >&2
  exit 1
fi

LAYOUT=""
if ! command -v dot >/dev/null 2>&1; then
  echo "Graphviz (dot) fehlt - rendere mit smetana." >&2
  LAYOUT="-Ppragma=layout,smetana"
fi

for file in *.puml; do
  echo "-> ${file%.puml}.svg"
  plantuml -tsvg ${LAYOUT} "$file"
done
echo "fertig."
