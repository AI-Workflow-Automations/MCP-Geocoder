import { describe, expect, it } from "bun:test";

import { createApp } from "../src/api/app.js";
import { loadConfig } from "../src/config.js";
import { createFixtureService } from "./fixtures.js";

/**
 * REST-API über einen echten Listener auf zufälligem Port.
 * Prüft Vertrag und Fehlerbehandlung, nicht die Fachlogik - die ist oben abgedeckt.
 */
async function startApp(env: Record<string, string> = {}) {
  const config = loadConfig({ ...process.env, PHOTON_ENABLED: "false", ...env });
  const { service } = createFixtureService();
  const app = createApp(service, config);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

describe("REST-API", () => {
  it("gleicht eine Adresse ab", async () => {
    const { base, close } = await startApp();
    try {
      const response = await fetch(`${base}/api/address`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ street: "Henrichweg 24", postalCode: "10115" }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("confirmed");
      expect(body.best.street).toBe("Henrichweg");
    } finally {
      await close();
    }
  });

  it("weist fehlende Pflichtfelder mit 400 ab", async () => {
    const { base, close } = await startApp();
    try {
      const response = await fetch(`${base}/api/address`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("street");
    } finally {
      await close();
    }
  });

  it("liefert die OpenAPI-Beschreibung und die Demo-Seite", async () => {
    const { base, close } = await startApp();
    try {
      const spec = await (await fetch(`${base}/openapi.json`)).json();
      expect(spec.openapi).toBe("3.1.0");
      expect(Object.keys(spec.paths)).toContain("/api/address");
      const page = await fetch(`${base}/`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("MCP-Geocoder");
    } finally {
      await close();
    }
  });

  it("schützt mit Bearer-Token, lässt /health aber offen", async () => {
    const { base, close } = await startApp({ MCP_AUTH_TOKEN: "geheim" });
    try {
      expect((await fetch(`${base}/openapi.json`)).status).toBe(401);
      expect((await fetch(`${base}/openapi.json`, { headers: { authorization: "Bearer geheim" } })).status).toBe(200);
      expect((await fetch(`${base}/health`)).status).toBe(200);
    } finally {
      await close();
    }
  });

  it("beantwortet einen MCP-initialize und listet die Tools", async () => {
    const { base, close } = await startApp();
    try {
      const init = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
        }),
      });
      expect(init.status).toBe(200);
      const sessionId = init.headers.get("mcp-session-id");
      expect(sessionId).toBeTruthy();

      const list = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId ?? "",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      });
      const text = await list.text();
      expect(text).toContain("resolve_address");
      expect(text).toContain("describe_api");
    } finally {
      await close();
    }
  });
});
