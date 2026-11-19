import { describe, expect, it } from 'vitest';
import { isSessionRevoked } from './session.js';

describe('isSessionRevoked', () => {
  const changed = new Date('2026-11-19T12:00:10.500Z');
  const sec = Math.floor(changed.getTime() / 1000);

  it('sin cambio de contraseña, la sesión vale', () => {
    expect(isSessionRevoked(sec - 1000, null)).toBe(false);
    expect(isSessionRevoked(undefined, null)).toBe(false);
  });
  it('un token anterior al cambio queda revocado', () => {
    expect(isSessionRevoked(sec - 1, changed)).toBe(true);
  });
  it('un token del mismo segundo del cambio o posterior vale', () => {
    expect(isSessionRevoked(sec, changed)).toBe(false);
    expect(isSessionRevoked(sec + 60, changed)).toBe(false);
  });
  it('sin fecha de emisión y con cambio registrado se rechaza', () => {
    expect(isSessionRevoked(undefined, changed)).toBe(true);
  });
});
