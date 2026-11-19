import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard.js';

const rules = [{ name: 't', max: 2, windowMs: 60_000, by: 'ip+email' as const }];

function context(ip: string, email: string, setHeader = vi.fn()) {
  return {
    getHandler: () => 'h',
    switchToHttp: () => ({
      getRequest: () => ({ ip, body: { email } }),
      getResponse: () => ({ setHeader }),
    }),
  } as never;
}

describe('RateLimitGuard', () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_DISABLED;
  });
  const make = () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'get').mockReturnValue(rules);
    return new RateLimitGuard(reflector);
  };

  it('deja pasar hasta el máximo y luego responde 429 con Retry-After', () => {
    const guard = make();
    const setHeader = vi.fn();
    expect(guard.canActivate(context('1.1.1.1', 'a@x.cl', setHeader))).toBe(true);
    expect(guard.canActivate(context('1.1.1.1', 'A@x.cl ', setHeader))).toBe(true);
    try {
      guard.canActivate(context('1.1.1.1', 'a@x.cl', setHeader));
      expect.unreachable();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(429);
    }
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('cuenta aparte por correo y por dirección', () => {
    const guard = make();
    for (let i = 0; i < 2; i++) guard.canActivate(context('1.1.1.1', 'a@x.cl'));
    expect(guard.canActivate(context('1.1.1.1', 'b@x.cl'))).toBe(true);
    expect(guard.canActivate(context('2.2.2.2', 'a@x.cl'))).toBe(true);
  });

  it('RATE_LIMIT_DISABLED=true lo desactiva', () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    const guard = make();
    for (let i = 0; i < 5; i++) expect(guard.canActivate(context('1.1.1.1', 'a@x.cl'))).toBe(true);
  });
});
