import { describe, expect, it } from 'vitest';
import {
  mean,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  rPrecision,
} from './metrics.js';

const rel = new Set(['a', 'b', 'c', 'd']);

describe('métricas de recuperación', () => {
  it('Precision@K divide por K aunque se devuelvan menos resultados', () => {
    expect(precisionAtK(['a', 'x', 'b'], rel, 3)).toBeCloseTo(2 / 3);
    expect(precisionAtK(['a'], rel, 5)).toBeCloseTo(1 / 5);
    expect(precisionAtK([], rel, 5)).toBe(0);
    expect(precisionAtK(['a'], rel, 0)).toBe(0);
  });

  it('Recall@K divide por el total de relevantes', () => {
    expect(recallAtK(['a', 'x', 'b'], rel, 3)).toBe(0.5);
    expect(recallAtK(['a', 'b', 'c', 'd', 'x'], rel, 10)).toBe(1);
    expect(recallAtK(['a'], new Set(), 5)).toBe(0);
  });

  it('solo cuenta los K primeros', () => {
    const ranked = ['x', 'y', 'a', 'b'];
    expect(precisionAtK(ranked, rel, 2)).toBe(0);
    expect(recallAtK(ranked, rel, 2)).toBe(0);
    expect(recallAtK(ranked, rel, 4)).toBe(0.5);
  });

  it('MRR usa la posición del primer relevante', () => {
    expect(reciprocalRank(['x', 'y', 'b'], rel)).toBeCloseTo(1 / 3);
    expect(reciprocalRank(['a'], rel)).toBe(1);
    expect(reciprocalRank(['x'], rel)).toBe(0);
  });

  it('R-Precision no depende de K', () => {
    expect(rPrecision(['a', 'b', 'x', 'y', 'c'], rel)).toBe(0.5); // R=4: a,b en las 4 primeras
    expect(rPrecision(['a'], new Set())).toBe(0);
  });

  it('mean de lista vacía es 0', () => {
    expect(mean([])).toBe(0);
    expect(mean([1, 2, 3])).toBe(2);
  });
});
