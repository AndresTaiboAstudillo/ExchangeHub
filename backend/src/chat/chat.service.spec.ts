import { describe, expect, it } from 'vitest';
import { orderedPair } from './chat.service.js';

describe('orderedPair', () => {
  it('ordena el par igual sin importar el orden de entrada', () => {
    const a = 'AAAAAAAA-0000-4000-8000-000000000001';
    const b = 'bbbbbbbb-0000-4000-8000-000000000002';
    expect(orderedPair(a, b)).toEqual(orderedPair(b, a));
    expect(orderedPair(a, b)[0]).toBe(a.toLowerCase());
  });
});
