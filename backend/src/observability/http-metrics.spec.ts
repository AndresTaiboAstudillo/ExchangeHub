import { describe, expect, it } from 'vitest';
import { HttpMetrics } from './http-metrics.js';

describe('HttpMetrics', () => {
  it('calcula conteo, promedio, percentiles y errores por ruta', () => {
    const m = new HttpMetrics();
    for (let i = 1; i <= 100; i++) m.record('GET', '/universities', 200, i);
    m.record('GET', '/universities', 404, 5);
    m.record('GET', '/universities', 500, 7);
    const [route] = m.snapshot().routes;
    expect(route).toMatchObject({
      method: 'GET',
      route: '/universities',
      count: 102,
      errors4xx: 1,
      errors5xx: 1,
      max_ms: 100,
    });
    expect(route.p50_ms).toBeGreaterThan(40);
    expect(route.p95_ms).toBeGreaterThanOrEqual(90);
    expect(route.avg_ms).toBeGreaterThan(40);
  });

  it('separa método y ruta y ordena por volumen', () => {
    const m = new HttpMetrics();
    m.record('GET', '/a', 200, 1);
    m.record('POST', '/a', 201, 1);
    m.record('POST', '/a', 201, 1);
    const snap = m.snapshot();
    expect(snap.routes.map((r) => `${r.method} ${r.route}`)).toEqual([
      'POST /a',
      'GET /a',
    ]);
    expect(snap.total).toBe(3);
  });

  it('limita la cardinalidad: las rutas sobrantes se agrupan', () => {
    const m = new HttpMetrics();
    for (let i = 0; i < 300; i++) m.record('GET', `/r${i}`, 200, 1);
    const snap = m.snapshot();
    expect(snap.routes.length).toBeLessThanOrEqual(201);
    expect(snap.routes.some((r) => r.route === 'otras')).toBe(true);
    expect(snap.total).toBe(300);
  });

  it('reset limpia todo', () => {
    const m = new HttpMetrics();
    m.record('GET', '/a', 200, 1);
    m.reset();
    expect(m.snapshot()).toMatchObject({ total: 0, routes: [] });
  });
});
