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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })));
    await expect(new PythonService().health()).resolves.toEqual({ status: 'ok' });
  });

  it('traduce un 500 de Python a 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('traduce un timeout a 504', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it('traduce un servicio caído a 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(new PythonService().health()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
