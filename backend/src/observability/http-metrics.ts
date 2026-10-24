const WINDOW = 200; // muestras recientes por ruta, para percentiles
const MAX_ROUTES = 200; // límite de cardinalidad

interface RouteStats {
  method: string;
  route: string;
  count: number;
  errors4xx: number;
  errors5xx: number;
  totalMs: number;
  maxMs: number;
  recent: number[];
}

export interface RouteSnapshot {
  method: string;
  route: string;
  count: number;
  errors4xx: number;
  errors5xx: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Percentil por rango más cercano sobre una lista ya ordenada. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Tiempos de respuesta HTTP por ruta, en memoria (se reinician con el proceso). */
export class HttpMetrics {
  private routes = new Map<string, RouteStats>();
  private startedAt = new Date();

  record(method: string, route: string, status: number, durationMs: number) {
    let key = `${method} ${route}`;
    if (!this.routes.has(key) && this.routes.size >= MAX_ROUTES) {
      key = `${method} otras`;
      route = 'otras';
    }
    let stats = this.routes.get(key);
    if (!stats) {
      stats = {
        method,
        route,
        count: 0,
        errors4xx: 0,
        errors5xx: 0,
        totalMs: 0,
        maxMs: 0,
        recent: [],
      };
      this.routes.set(key, stats);
    }
    stats.count += 1;
    if (status >= 500) stats.errors5xx += 1;
    else if (status >= 400) stats.errors4xx += 1;
    stats.totalMs += durationMs;
    stats.maxMs = Math.max(stats.maxMs, durationMs);
    stats.recent.push(durationMs);
    if (stats.recent.length > WINDOW) stats.recent.shift();
  }

  snapshot() {
    const routes: RouteSnapshot[] = [...this.routes.values()]
      .map((s) => {
        const sorted = [...s.recent].sort((a, b) => a - b);
        return {
          method: s.method,
          route: s.route,
          count: s.count,
          errors4xx: s.errors4xx,
          errors5xx: s.errors5xx,
          avg_ms: round(s.totalMs / s.count),
          p50_ms: round(percentile(sorted, 50)),
          p95_ms: round(percentile(sorted, 95)),
          max_ms: round(s.maxMs),
        };
      })
      .sort((a, b) => b.count - a.count);
    const total = routes.reduce((n, r) => n + r.count, 0);
    const errors5xx = routes.reduce((n, r) => n + r.errors5xx, 0);
    return {
      since: this.startedAt.toISOString(),
      total,
      errors5xx,
      routes,
    };
  }

  reset() {
    this.routes.clear();
    this.startedAt = new Date();
  }
}

export const httpMetrics = new HttpMetrics();
