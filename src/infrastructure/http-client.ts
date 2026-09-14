/**
 * Dünner fetch-Wrapper mit Timeout.
 *
 * Ein hängender Upstream darf den Call nicht blockieren: jede Sekunde Latenz
 * ist am Telefon eine Sekunde Stille. Lieber schnell scheitern und den
 * nächsten Provider fragen.
 */
export interface HttpClient {
  getJson<T>(url: string): Promise<T>;
}

export class FetchHttpClient implements HttpClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly userAgent = "mcp-geocoder/0.2",
  ) {}

  async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: "application/json", "user-agent": this.userAgent },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} bei ${url}`);
    }
    return (await response.json()) as T;
  }
}
