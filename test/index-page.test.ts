import { describe, expect, it } from "bun:test";

import {
  buildJsonLd,
  DYNAMIC_HEAD_MARKER,
  renderDynamicHead,
  renderIndexPage,
  renderLlmsTxt,
  resolveBaseUrl,
} from "../src/api/index-page.js";

/** Head-Rendering ohne HTTP: Canonical, Geo-Meta, JSON-LD, Basis-URL-Auflösung. */
describe("Startseite", () => {
  const context = {
    baseUrl: "https://geocoder.example.de",
    serviceAreaPostalCodes: ["10115", "10117"],
    serviceAreaBias: { lat: 52.53, lon: 13.38 },
  };

  it("ersetzt den Platzhalter durch Canonical, og:url und Geo-Meta", () => {
    const html = renderIndexPage(`<head>${DYNAMIC_HEAD_MARKER}</head>`, context);
    expect(html).not.toContain(DYNAMIC_HEAD_MARKER);
    expect(html).toContain('<link rel="canonical" href="https://geocoder.example.de/">');
    expect(html).toContain('<meta property="og:url" content="https://geocoder.example.de/">');
    expect(html).toContain('<meta name="geo.region" content="DE">');
    expect(html).toContain('<meta name="geo.position" content="52.53;13.38">');
    expect(html).toContain('<meta name="ICBM" content="52.53, 13.38">');
  });

  it("lässt Positions-Tags weg, wenn kein Bias-Punkt konfiguriert ist", () => {
    const head = renderDynamicHead({ ...context, serviceAreaBias: undefined });
    expect(head).toContain("geo.region");
    expect(head).not.toContain("geo.position");
    expect(head).not.toContain("ICBM");
  });

  it("liefert gültiges JSON-LD mit Einzugsgebiet als DefinedRegion", () => {
    const head = renderDynamicHead(context);
    const match = head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(match).not.toBeNull();
    const ld = JSON.parse(match?.[1] ?? "");
    expect(ld["@type"]).toBe("WebApplication");
    expect(ld.url).toBe("https://geocoder.example.de/");
    expect(ld.areaServed["@type"]).toBe("DefinedRegion");
    expect(ld.areaServed.postalCode).toEqual(["10115", "10117"]);
    expect(ld.areaServed.geoMidpoint.latitude).toBe(52.53);
  });

  it("nennt ganz Deutschland, wenn kein Einzugsgebiet gesetzt ist", () => {
    const ld = buildJsonLd({ ...context, serviceAreaPostalCodes: [] });
    expect(ld.areaServed).toMatchObject({ "@type": "Country", identifier: "DE" });
  });

  it("maskiert < im JSON-LD, damit kein </script> aus Daten entsteht", () => {
    const head = renderDynamicHead({ ...context, baseUrl: "https://x.de/</script><b>" });
    const script = head.slice(head.indexOf('<script type="application/ld+json">'));
    expect(script.indexOf("</script>")).toBe(script.lastIndexOf("</script>"));
  });

  it("füllt llms.txt mit absoluten URLs", () => {
    const text = renderLlmsTxt("- [Health]({{BASE_URL}}/health)\n- [Demo]({{BASE_URL}}/)", "https://g.example");
    expect(text).toBe("- [Health](https://g.example/health)\n- [Demo](https://g.example/)");
  });
});

describe("Basis-URL", () => {
  const request = { protocol: "http", host: "localhost:8080" };

  it("bevorzugt PUBLIC_URL und entfernt den Schrägstrich am Ende", () => {
    expect(resolveBaseUrl("https://geocoder.example.de/", request)).toBe("https://geocoder.example.de");
  });

  it("leitet aus dem Request ab", () => {
    expect(resolveBaseUrl(undefined, request)).toBe("http://localhost:8080");
  });

  it("nimmt X-Forwarded-Header hinter einem Reverse Proxy, erster Eintrag zählt", () => {
    const base = resolveBaseUrl(undefined, {
      ...request,
      forwardedProto: "https, http",
      forwardedHost: "geocoder.example.de, internal",
    });
    expect(base).toBe("https://geocoder.example.de");
  });
});
