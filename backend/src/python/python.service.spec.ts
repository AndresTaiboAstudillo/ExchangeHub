import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PythonService } from './python.service.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('PythonService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el JSON cuando Python responde bien', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })),
    );
    await expect(new PythonService().health()).resolves.toEqual({
      status: 'ok',
    });
  });

  it('traduce un 500 de Python a 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('traduce un timeout a 504', async () => {
    const timeout = Object.assign(new Error('timeout'), {
      name: 'TimeoutError',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it('traduce un servicio caído a 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  describe('runUniversitiesPipeline', () => {
    it('envía POST con las fuentes y devuelve el resultado', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ status: 'succeeded' }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        new PythonService().runUniversitiesPipeline([
          'mineduc_ies',
          'wikidata',
        ]),
      ).resolves.toEqual({ status: 'succeeded' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:8001/v1/pipeline/universities/run');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body as string)).toEqual({
        sources: ['mineduc_ies', 'wikidata'],
      });
    });

    it('usa un timeout propio, mucho mayor que el de las llamadas rápidas', async () => {
      const spy = vi.spyOn(AbortSignal, 'timeout');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({})),
      );
      const service = new PythonService();
      await service.health();
      await service.runUniversitiesPipeline(['mineduc_ies']);
      const [quick, pipeline] = spy.mock.calls.map(([ms]) => ms);
      expect(quick).toBe(3000);
      expect(pipeline).toBe(120000);
      spy.mockRestore();
    });

    it('traduce un 422 de validación a 502 (el cliente no debe verlo)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 422)));
      await expect(
        new PythonService().runUniversitiesPipeline(['mineduc_ies']),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('una respuesta que no es JSON es un 502', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })),
      );
      await expect(
        new PythonService().runUniversitiesPipeline(['mineduc_ies']),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
