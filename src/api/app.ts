import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type NextFunction, type Request, type Response } from "express";

import type { GeocoderService } from "../application/geocoder-service.js";
import type { AppConfig } from "../config.js";
import { createMcpServer } from "../mcp/server.js";
import { renderIndexPage, renderLlmsTxt, resolveBaseUrl } from "./index-page.js";
import { openApiDocument } from "./openapi.js";

/**
 * HTTP-Anwendung: MCP-Transport, REST-API, Demo-Oberfläche.
 *
 * Alle drei rufen dieselbe Fassade. Was die Weboberfläche zeigt, tut auch der
 * Telefonagent - es gibt keinen zweiten Codepfad für die Demo.
 */

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web");

export function createApp(service: GeocoderService, config: AppConfig): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(bearerAuth(config.authToken));

  app.get(
    "/health",
    asyncRoute(async () => ({
      ok: true,
      service: "mcp-geocoder",
      providers: await probeProviders(config),
      thresholds: service.thresholds,
      serviceArea: service.serviceArea,
    })),
  );

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  mountRestApi(app, service);
  mountMcp(app, service);

  if (config.webEnabled) {
    mountWeb(app, service, config);
  }

  app.use(errorHandler);
  return app;
}

/**
 * Demo-Oberfläche. Startseite und llms.txt werden gerendert, weil Canonical-URL,
 * Geo-Meta und JSON-LD vom Deployment abhängen; der Rest kommt statisch aus web/.
 */
function mountWeb(app: express.Express, service: GeocoderService, config: AppConfig): void {
  const indexTemplate = readFileSync(path.join(WEB_ROOT, "index.html"), "utf8");
  const llmsTemplate = readFileSync(path.join(WEB_ROOT, "llms.txt"), "utf8");
  const baseUrlOf = (req: Request) =>
    resolveBaseUrl(config.publicUrl, {
      forwardedProto: req.get("x-forwarded-proto"),
      forwardedHost: req.get("x-forwarded-host"),
      host: req.get("host"),
      protocol: req.protocol,
    });

  app.get(["/", "/index.html"], (req, res) => {
    const html = renderIndexPage(indexTemplate, {
      baseUrl: baseUrlOf(req),
      serviceAreaPostalCodes: service.serviceArea,
      serviceAreaBias: config.serviceAreaBias,
    });
    res.type("html").send(html);
  });

  app.get("/llms.txt", (req, res) => {
    res.type("text/plain; charset=utf-8").send(renderLlmsTxt(llmsTemplate, baseUrlOf(req)));
  });

  app.use(express.static(WEB_ROOT, { index: false, extensions: ["html"] }));
}

/** REST-Routen. Ein Endpunkt pro Anwendungsfall, 1:1 zu den MCP-Tools. */
function mountRestApi(app: express.Express, service: GeocoderService): void {
  app.post(
    "/api/postal-code",
    asyncRoute((req) => {
      const spoken = requireString(req.body, "spoken");
      return service.resolvePostalCode(spoken);
    }),
  );

  app.post(
    "/api/address",
    asyncRoute((req) => {
      const street = requireString(req.body, "street");
      return service.resolveAddress({
        street,
        postalCode: optionalString(req.body, "postalCode"),
        houseNumber: optionalString(req.body, "houseNumber"),
        locality: optionalString(req.body, "locality"),
      });
    }),
  );

  app.post(
    "/api/address/select",
    asyncRoute((req) =>
      service.selectCandidate({
        street: requireString(req.body, "street"),
        postalCode: requireString(req.body, "postalCode"),
        locality: requireString(req.body, "locality"),
        houseNumber: optionalString(req.body, "houseNumber"),
      }),
    ),
  );

  app.post(
    "/api/escalate",
    asyncRoute((req) =>
      service.flagForHuman({
        reason: requireString(req.body, "reason"),
        heardStreet: optionalString(req.body, "heardStreet"),
        heardPostalCode: optionalString(req.body, "heardPostalCode"),
        attempts: typeof req.body?.attempts === "number" ? req.body.attempts : undefined,
      }),
    ),
  );

  app.post(
    "/api/keyterms",
    asyncRoute((req) => {
      const codes = Array.isArray(req.body?.postalCodes) ? req.body.postalCodes.map(String) : undefined;
      const limit = typeof req.body?.limit === "number" ? req.body.limit : undefined;
      return service.buildKeyterms(codes, limit);
    }),
  );
}

/**
 * MCP über Streamable HTTP. Ein Transport pro Session - eine Telefonleitung
 * ist eine Session.
 */
function mountMcp(app: express.Express, service: GeocoderService): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res, next) => {
    try {
      const sessionId = req.get("mcp-session-id");
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        if (!isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Keine gültige Session. Zuerst initialize senden." },
            id: null,
          });
          return;
        }
        const created = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, created);
          },
        });
        created.onclose = () => {
          if (created.sessionId) transports.delete(created.sessionId);
        };
        await createMcpServer(service).connect(created);
        transport = created;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });

  const forwardToSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.get("mcp-session-id");
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).send("Unbekannte Session");
        return;
      }
      await transport.handleRequest(req, res);
    } catch (error) {
      next(error);
    }
  };
  app.get("/mcp", forwardToSession);
  app.delete("/mcp", forwardToSession);
}

/** Bearer-Token, falls gesetzt. /health bleibt offen, damit Monitoring ohne Secret auskommt. */
function bearerAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!token || req.path === "/health") return next();
    if (req.get("authorization") === `Bearer ${token}`) return next();
    res.status(401).json({ error: "unauthorized" });
  };
}

class BadRequestError extends Error {}

function requireString(body: unknown, key: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`Feld "${key}" fehlt oder ist leer.`);
  }
  return value;
}

function optionalString(body: unknown, key: string): string | undefined {
  const value = (body as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Async-Handler ohne try/catch-Wiederholung: Rückgabewert wird als JSON gesendet. */
function asyncRoute(handler: (req: Request) => Promise<unknown> | unknown) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      next(error);
    }
  };
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = (error as Error).message ?? "Unbekannter Fehler";
  if (error instanceof BadRequestError) {
    res.status(400).json({ error: message, needsHuman: true });
    return;
  }
  console.error(`[mcp-geocoder] ${message}`);
  res.status(500).json({ error: message, needsHuman: true });
}

async function probeProviders(config: AppConfig) {
  const probe = async (name: string, url: string) => {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
      return { name, ok: response.ok, status: response.status, latencyMs: Date.now() - started };
    } catch (error) {
      return { name, ok: false, error: (error as Error).message, latencyMs: Date.now() - started };
    }
  };
  const checks = [probe("openplz", `${config.openPlzBaseUrl}/de/Localities?postalCode=10115&page=1&pageSize=1`)];
  if (config.photonEnabled) checks.push(probe("photon", `${config.photonBaseUrl}/api?q=Hauptstrasse&limit=1`));
  return Promise.all(checks);
}
