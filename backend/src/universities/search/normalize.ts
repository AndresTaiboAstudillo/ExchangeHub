/**
 * Normalización de texto en español para indexar y buscar.
 * Pasos: minúsculas → sin tildes → separar por no alfanuméricos → quitar palabras vacías →
 * singularización simple (sin diccionario, para no depender de librerías).
 */

const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'al',
  'ante',
  'con',
  'como',
  'de',
  'del',
  'desde',
  'e',
  'el',
  'en',
  'entre',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'que',
  'se',
  'sin',
  'sobre',
  'su',
  'sus',
  'un',
  'una',
  'unos',
  'unas',
  'y',
]);

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '');
}

/** Clave de comparación de nombres (misma regla que el pipeline de Python). */
export function nameKey(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function singularize(token: string): string {
  if (token.length <= 3) return token;
  // estatales→estatal, universidades→universidad, regiones→region, mayores→mayor
  if (/[lrndz]es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return nameKey(text)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(singularize);
}
