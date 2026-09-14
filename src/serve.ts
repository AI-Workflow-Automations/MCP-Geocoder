#!/usr/bin/env bun
import { createApp } from "./api/app.js";
import { composeService, config } from "./bootstrap.js";

/**
 * HTTP-Einstieg: MCP über Streamable HTTP, REST-API, Demo-Oberfläche.
 * Für Telefonagenten wie Vapi, die MCP nur über eine URL einbinden.
 */
const app = createApp(composeService(), config);
app.listen(config.httpPort, () => {
  console.error(`[mcp-geocoder] http://localhost:${config.httpPort}  (MCP: /mcp, API: /api, Doku: /openapi.json)`);
});
