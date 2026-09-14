#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { composeService, config } from "./bootstrap.js";
import { createMcpServer } from "./mcp/server.js";

/**
 * stdio-Transport - für Claude Desktop, Claude Code und lokale Tests.
 * Auf stdout darf nichts außer dem Protokoll landen; Logs gehen nach stderr.
 */
const server = createMcpServer(composeService(), config.language);
await server.connect(new StdioServerTransport());
console.error("[mcp-geocoder] stdio-Transport bereit");
