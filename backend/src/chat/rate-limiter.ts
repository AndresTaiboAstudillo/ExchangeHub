/** Ventana deslizante en memoria: como mucho `max` eventos por usuario cada `windowMs`. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Registra un evento; devuelve false si el usuario superó el límite. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Milisegundos hasta que `key` pueda volver a intentarlo (0 si ya puede). */
  retryAfterMs(key: string, now = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length < this.max) return 0;
    return Math.max(0, recent[0]! + this.windowMs - now);
  }

  /** Descarta las claves sin eventos recientes, para que el mapa no crezca sin límite. */
  prune(now = Date.now()): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }

  forget(key: string): void {
    this.hits.delete(key);
  }
}
