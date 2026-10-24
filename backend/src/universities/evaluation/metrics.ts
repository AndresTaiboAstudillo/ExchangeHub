/** Métricas clásicas de recuperación de información sobre una lista ordenada de resultados. */

/** Fracción de los K primeros resultados que son relevantes (el denominador es K, no lo devuelto). */
export function precisionAtK(
  ranked: readonly string[],
  relevant: ReadonlySet<string>,
  k: number,
): number {
  if (k <= 0) return 0;
  const hits = ranked.slice(0, k).filter((id) => relevant.has(id)).length;
  return hits / k;
}

/** Fracción de los relevantes que aparecen entre los K primeros resultados. */
export function recallAtK(
  ranked: readonly string[],
  relevant: ReadonlySet<string>,
  k: number,
): number {
  if (relevant.size === 0) return 0;
  const hits = ranked.slice(0, k).filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

/** 1 / posición del primer relevante (0 si no aparece). */
export function reciprocalRank(
  ranked: readonly string[],
  relevant: ReadonlySet<string>,
): number {
  const index = ranked.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

/** Precisión en la posición R = |relevantes|: no penaliza consultas con más de K relevantes. */
export function rPrecision(
  ranked: readonly string[],
  relevant: ReadonlySet<string>,
): number {
  if (relevant.size === 0) return 0;
  return precisionAtK(ranked, relevant, relevant.size);
}

export function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((a, b) => a + b, 0) / values.length;
}
