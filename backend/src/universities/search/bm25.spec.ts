import { describe, expect, it } from 'vitest';
import { Bm25Index } from './bm25.js';
import { nameKey, singularize, tokenize } from './normalize.js';

describe('normalize', () => {
  it('quita tildes, mayúsculas y puntuación', () => {
    expect(nameKey('Universidad del Bío-Bío')).toBe('universidad del bio bio');
  });

  it('tokeniza sin palabras vacías y singulariza', () => {
    expect(tokenize('Universidades de la Región de Valparaíso')).toEqual([
      'universidad',
      'region',
      'valparaiso',
    ]);
  });

  it('singulariza casos comunes sin romper palabras cortas', () => {
    expect(singularize('estatales')).toBe('estatal');
    expect(singularize('universidades')).toBe('universidad');
    expect(singularize('regiones')).toBe('region');
    expect(singularize('privadas')).toBe('privada');
    expect(singularize('gas')).toBe('gas');
    expect(singularize('clases')).toBe('clase');
  });
});

const DOCS = [
  {
    id: 'chile',
    fields: { name: 'Universidad de Chile', extra: 'universidad estatal' },
  },
  {
    id: 'usach',
    fields: {
      name: 'Universidad de Santiago de Chile',
      extra: 'universidad estatal',
    },
  },
  {
    id: 'uc',
    fields: {
      name: 'Pontificia Universidad Católica de Chile',
      extra: 'universidad privada',
    },
  },
  {
    id: 'inacap',
    fields: {
      name: 'Instituto Profesional Inacap',
      extra: 'instituto profesional',
    },
  },
  {
    id: 'valpo',
    fields: { name: 'Universidad de Valparaíso', extra: 'universidad estatal' },
  },
];

describe('Bm25Index', () => {
  const index = new Bm25Index(DOCS, { weights: { name: 3 } });

  it('devuelve vacío para consultas vacías o solo con palabras vacías', () => {
    expect(index.search('')).toEqual([]);
    expect(index.search('de la')).toEqual([]);
  });

  it('encuentra por plural o singular', () => {
    expect(index.search('estatales').map((h) => h.id)).toContain('chile');
    expect(index.search('privada')[0].id).toBe('uc');
  });

  it('ignora tildes y mayúsculas', () => {
    expect(index.search('CATOLICA')[0].id).toBe('uc');
    expect(index.search('valparaiso')[0].id).toBe('valpo');
  });

  it('ordena por relevancia: el término más raro pesa más', () => {
    const hits = index.search('santiago');
    expect(hits.map((h) => h.id)).toEqual(['usach']);
    const chile = index.search('universidad chile').map((h) => h.id);
    expect(chile[0]).toBe('chile'); // coincide en ambos términos y es el nombre más corto
  });

  it('busca el último término como prefijo mientras se escribe', () => {
    expect(index.search('valpa')[0].id).toBe('valpo');
    expect(index.search('ca').length).toBe(0); // prefijos muy cortos no se expanden
  });

  it('un nombre pesa más que el texto auxiliar', () => {
    const idx = new Bm25Index(
      [
        { id: 'a', fields: { name: 'Alfa', extra: 'beta' } },
        { id: 'b', fields: { name: 'Beta', extra: 'alfa' } },
      ],
      { weights: { name: 3 } },
    );
    expect(idx.search('alfa').map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('es determinista ante empates', () => {
    const idx = new Bm25Index([
      { id: 'b', fields: { name: 'igual' } },
      { id: 'a', fields: { name: 'igual' } },
    ]);
    expect(idx.search('igual').map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('respeta el límite', () => {
    expect(index.search('universidad', 2)).toHaveLength(2);
  });

  it('un índice vacío no falla', () => {
    expect(new Bm25Index([]).search('x')).toEqual([]);
  });
});
