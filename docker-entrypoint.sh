#!/bin/sh
# Modus per erstem Argument: serve (Default, HTTP) oder stdio (Claude Code / Desktop).
# Alles andere wird unverändert ausgeführt, z. B. `docker run ... sh`.
set -e
case "${1:-serve}" in
  serve) exec bun run src/serve.ts ;;
  stdio) exec bun run src/index.ts ;;
  *)     exec "$@" ;;
esac
