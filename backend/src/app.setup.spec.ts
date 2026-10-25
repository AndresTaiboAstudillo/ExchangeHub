import { describe, expect, it } from 'vitest';
import { allowedOrigins } from './app.setup.js';

describe('allowedOrigins', () => {
  it('usa localhost:3000 si no hay configuración', () => {
    expect(allowedOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(allowedOrigins('')).toEqual(['http://localhost:3000']);
    expect(allowedOrigins(' , ')).toEqual(['http://localhost:3000']);
  });

  it('acepta un solo origen', () => {
    expect(allowedOrigins('https://app.ejemplo.cl')).toEqual([
      'https://app.ejemplo.cl',
    ]);
  });

  it('acepta varios separados por comas, sin espacios ni barra final', () => {
    expect(
      allowedOrigins('http://localhost:3000, https://localhost/ ,'),
    ).toEqual(['http://localhost:3000', 'https://localhost']);
  });
});
