import { tokenize } from './normalize.js';

export interface SearchDoc {
  id: string;
  /** Texto por campo; cada campo puede pesar distinto (p. ej. el título más que el resto). */
  fields: Record<string, string>;
}

export interface SearchHit {
  id: string;
  score: number;
}

export interface Bm25Options {
  /** Multiplicador de frecuencia por campo (por defecto 1). */
  weights?: Record<string, number>;
  k1?: number;
  b?: number;
}

const PREFIX_MIN_LENGTH = 3;
const PREFIX_WEIGHT = 0.5;

/** Índice invertido con ranking Okapi BM25 y frecuencias ponderadas por campo. */
export class Bm25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly postings = new Map<string, Map<number, number>>();
  private readonly lengths: number[] = [];
  private readonly ids: string[] = [];
  private avgLength = 0;

  constructor(docs: SearchDoc[], options: Bm25Options = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    const weights = options.weights ?? {};
    let total = 0;
    docs.forEach((doc, index) => {
      let length = 0;
      for (const [field, text] of Object.entries(doc.fields)) {
        const weight = weights[field] ?? 1;
        for (const term of tokenize(text)) {
          const docs = this.postings.get(term) ?? new Map<number, number>();
          docs.set(index, (docs.get(index) ?? 0) + weight);
          this.postings.set(term, docs);
          length += weight;
        }
      }
      this.ids.push(doc.id);
      this.lengths.push(length);
      total += length;
    });
    this.avgLength = docs.length > 0 ? total / docs.length : 0;
  }

  get size(): number {
    return this.ids.length;
  }

  /**
   * Devuelve los documentos que contienen al menos un término de la consulta, de mayor a menor
   * puntaje. El último término también se busca como prefijo (útil mientras se escribe).
   */
  search(query: string, limit = 20): SearchHit[] {
    const terms = tokenize(query);
    if (terms.length === 0 || this.size === 0) return [];

    const weighted = new Map<string, number>();
    const add = (term: string, weight: number) =>
      weighted.set(term, Math.max(weighted.get(term) ?? 0, weight));
    terms.forEach((t) => add(t, 1));
    const last = terms[terms.length - 1];
    if (last.length >= PREFIX_MIN_LENGTH) {
      for (const vocab of this.postings.keys()) {
        if (vocab !== last && vocab.startsWith(last)) add(vocab, PREFIX_WEIGHT);
      }
    }

    const scores = new Map<number, number>();
    for (const [term, queryWeight] of weighted) {
      const docs = this.postings.get(term);
      if (!docs) continue;
      const idf = Math.log(
        1 + (this.size - docs.size + 0.5) / (docs.size + 0.5),
      );
      for (const [index, tf] of docs) {
        const norm =
          1 - this.b + this.b * (this.lengths[index] / (this.avgLength || 1));
        const value = idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm));
        scores.set(index, (scores.get(index) ?? 0) + queryWeight * value);
      }
    }

    return [...scores.entries()]
      .map(([index, score]) => ({ id: this.ids[index], score }))
      .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
      .slice(0, limit);
  }
}
