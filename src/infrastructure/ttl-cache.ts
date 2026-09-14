interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Prozesslokaler TTL-Cache.
 *
 * Straßenverzeichnisse ändern sich selten, ein Telefonagent fragt dieselbe
 * Postleitzahl aber dutzendfach am Tag ab. Der Cache spart Latenz im Call -
 * und die zählt hier direkt als Gesprächspause.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlSeconds: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlSeconds * 1000 });
  }

  /** Liefert den Cache-Treffer oder erzeugt und speichert den Wert. */
  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await load();
    this.set(key, value);
    return value;
  }

  get size(): number {
    return this.entries.size;
  }
}
