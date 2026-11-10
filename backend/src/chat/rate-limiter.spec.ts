import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('permite hasta el máximo y bloquea el resto dentro de la ventana', () => {
    const limiter = new RateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => limiter.allow('a', 0))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('libera cupo cuando pasa la ventana', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 999)).toBe(false);
    expect(limiter.allow('a', 1000)).toBe(true);
  });

  it('cuenta por usuario y permite olvidar a uno', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('b', 0)).toBe(true);
    limiter.forget('a');
    expect(limiter.allow('a', 1)).toBe(true);
  });
});
